// 弹窗逻辑：展示今日 / 近 7 天各站点浏览时长，一键生成 AI 周报点评

const els = {
  totalText: document.getElementById('totalText'),
  todayTab: document.getElementById('todayTab'),
  weekTab: document.getElementById('weekTab'),
  list: document.getElementById('list'),
  errorBox: document.getElementById('errorBox'),
  result: document.getElementById('result'),
  reportBtn: document.getElementById('reportBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
};

let ledger = {}; // { 'YYYY-MM-DD': { host: 秒数 } }
let currentRange = 1; // 当前视图天数：1 = 今日，7 = 近 7 天

init();

async function init() {
  els.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  els.todayTab.addEventListener('click', () => switchRange(1));
  els.weekTab.addEventListener('click', () => switchRange(7));
  els.reportBtn.addEventListener('click', handleReport);

  ({ ledger = {} } = await chrome.storage.local.get('ledger'));
  renderList();
}

function switchRange(days) {
  currentRange = days;
  els.todayTab.classList.toggle('is-active', days === 1);
  els.weekTab.classList.toggle('is-active', days === 7);
  renderList();
}

// 聚合最近 N 天的各站点时长（秒），按时长倒序
function aggregate(days) {
  const totals = {};
  for (const dayKey of recentDayKeys(days)) {
    const dayData = ledger[dayKey] || {};
    for (const [host, seconds] of Object.entries(dayData)) {
      totals[host] = (totals[host] || 0) + seconds;
    }
  }
  return Object.entries(totals).sort((a, b) => b[1] - a[1]);
}

function recentDayKeys(days) {
  const keys = [];
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    keys.push(localDateKey(date));
  }
  return keys;
}

function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function renderList() {
  const entries = aggregate(currentRange);
  const totalSeconds = entries.reduce((sum, [, seconds]) => sum + seconds, 0);
  els.totalText.textContent = totalSeconds
    ? `${currentRange === 1 ? '今日' : '近 7 天'}共 ${formatDuration(totalSeconds)}`
    : '';

  if (!entries.length) {
    els.list.innerHTML = '<div class="empty">还没有数据。<br/>插件安装后每分钟采样一次，逛一会儿再来看。</div>';
    return;
  }

  const maxSeconds = entries[0][1];
  els.list.innerHTML = entries
    .slice(0, 30)
    .map(([host, seconds]) => {
      const percent = Math.max(3, Math.round((seconds / maxSeconds) * 100));
      return `<div class="site">
        <div class="site__row">
          <span class="site__host">${escapeHtml(host)}</span>
          <span class="site__time">${formatDuration(seconds)}</span>
        </div>
        <div class="site__bar-track"><div class="site__bar" style="width:${percent}%"></div></div>
      </div>`;
    })
    .join('');
}

function formatDuration(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) {
    return '<1m';
  }
  if (minutes < 60) {
    return `${minutes}m`;
  }
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// 调用 DeepSeek 流式生成周报点评
async function handleReport() {
  els.errorBox.hidden = true;
  const { apiKey, model } = await chrome.storage.local.get(['apiKey', 'model']);
  if (!apiKey) {
    showError('请先点击右上角 ⚙ 配置 DeepSeek API Key');
    return;
  }
  const entries = aggregate(7);
  if (!entries.length) {
    showError('近 7 天还没有数据，先逛一会儿');
    return;
  }

  els.reportBtn.disabled = true;
  els.result.hidden = false;
  els.result.innerHTML = '<p>AI 点评中…</p>';
  let rawText = '';

  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        stream: true,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildReportPrompt(entries) },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(await readApiError(response));
    }

    await consumeSseStream(response, (delta) => {
      rawText += delta;
      els.result.innerHTML = renderMarkdown(rawText);
      els.result.scrollTop = els.result.scrollHeight;
    });
    if (!rawText) {
      throw new Error('模型未返回内容，请检查模型名称是否正确');
    }
  } catch (error) {
    els.result.hidden = true;
    showError(error.message || '发生未知错误');
  } finally {
    els.reportBtn.disabled = false;
  }
}

function buildReportPrompt(entries) {
  const siteLines = entries.slice(0, 40).map(([host, seconds]) => `${host}: ${Math.round(seconds / 60)} 分钟`);
  const dayLines = recentDayKeys(7).map((dayKey) => {
    const daySeconds = Object.values(ledger[dayKey] || {}).reduce((sum, s) => sum + s, 0);
    return `${dayKey}: ${Math.round(daySeconds / 60)} 分钟`;
  });
  return ['近 7 天各站点浏览时长：', ...siteLines, '', '每日总时长：', ...dayLines].join('\n');
}

function showError(message) {
  els.errorBox.textContent = message;
  els.errorBox.hidden = false;
}

// ===== 通用工具：SSE 解析 / API 错误 / Markdown 渲染 =====

async function consumeSseStream(response, onDelta) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data:')) {
        continue;
      }
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') {
        continue;
      }
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (delta) {
          onDelta(delta);
        }
      } catch {
        // 忽略无法解析的分片
      }
    }
  }
}

async function readApiError(response) {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message || JSON.stringify(body);
  } catch {
    detail = await response.text().catch(() => '');
  }
  if (response.status === 401) {
    return `API Key 无效或已过期，请检查设置（${detail}）`;
  }
  return `请求失败（HTTP ${response.status}）：${detail}`;
}

function escapeHtml(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderMarkdown(text) {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = escaped.split('\n');
  const html = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    const isListItem = /^[-*]\s+/.test(trimmed) || /^\d+[.、]\s+/.test(trimmed);

    if (isListItem && !inList) {
      html.push('<ul>');
      inList = true;
    }
    if (!isListItem && inList) {
      html.push('</ul>');
      inList = false;
    }

    if (isListItem) {
      html.push(`<li>${renderInline(trimmed.replace(/^([-*]|\d+[.、])\s+/, ''))}</li>`);
    } else if (/^#{1,4}\s+/.test(trimmed)) {
      html.push(`<h3>${renderInline(trimmed.replace(/^#{1,4}\s+/, ''))}</h3>`);
    } else if (trimmed) {
      html.push(`<p>${renderInline(trimmed)}</p>`);
    }
  }
  if (inList) {
    html.push('</ul>');
  }
  return html.join('');
}

function renderInline(text) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}
