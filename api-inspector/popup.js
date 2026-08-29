// 弹窗逻辑：展示当前标签页捕获到的接口请求（去重聚合），一键让 AI 解说

const els = {
  list: document.getElementById('list'),
  countText: document.getElementById('countText'),
  errorBox: document.getElementById('errorBox'),
  result: document.getElementById('result'),
  clearBtn: document.getElementById('clearBtn'),
  explainBtn: document.getElementById('explainBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
};

let currentTab = null;
let dedupedList = []; // 聚合后的接口清单

init();

async function init() {
  els.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  els.clearBtn.addEventListener('click', handleClear);
  els.explainBtn.addEventListener('click', handleExplain);

  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await loadAndRender();
}

async function loadAndRender() {
  const key = `log_${currentTab?.id}`;
  const stored = await chrome.storage.session.get(key);
  dedupedList = dedupe(stored[key] || []);
  renderList();
}

// 按「方法 + 去掉 query 的 URL」聚合，记录调用次数与查询参数名
function dedupe(log) {
  const map = new Map();
  for (const item of log) {
    let parsed;
    try {
      parsed = new URL(item.url);
    } catch {
      continue;
    }
    const pathKey = `${item.method} ${parsed.origin}${parsed.pathname}`;
    const existing = map.get(pathKey);
    const queryKeys = [...parsed.searchParams.keys()];
    if (existing) {
      existing.count += 1;
      existing.statusCode = item.statusCode;
      for (const queryKey of queryKeys) {
        existing.queryKeys.add(queryKey);
      }
    } else {
      map.set(pathKey, {
        method: item.method,
        origin: parsed.origin,
        pathname: parsed.pathname,
        statusCode: item.statusCode,
        count: 1,
        queryKeys: new Set(queryKeys),
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function renderList() {
  els.countText.textContent = dedupedList.length
    ? `${dedupedList.length} 个接口（本页加载以来）`
    : '';
  if (!dedupedList.length) {
    els.list.innerHTML = '<div class="empty">还没有捕获到 XHR/Fetch 请求。<br/>安装插件后需要刷新一次页面才能开始记录。</div>';
    els.explainBtn.disabled = true;
    return;
  }
  els.explainBtn.disabled = false;
  els.list.innerHTML = dedupedList
    .map((item) => {
      const methodClass = `m-${item.method.toLowerCase()}`;
      const safeClass = ['m-get', 'm-post', 'm-put', 'm-patch', 'm-delete'].includes(methodClass)
        ? methodClass
        : 'm-other';
      const statusHtml =
        item.statusCode >= 400
          ? `<span class="err">${item.statusCode}</span>`
          : `${item.statusCode}`;
      return `<div class="row" title="${escapeHtml(item.origin + item.pathname)}">
        <span class="row__method ${safeClass}">${escapeHtml(item.method)}</span>
        <span class="row__path">${escapeHtml(item.pathname)}</span>
        <span class="row__meta">×${item.count} · ${statusHtml}</span>
      </div>`;
    })
    .join('');
}

async function handleClear() {
  await chrome.storage.session.set({ [`log_${currentTab?.id}`]: [] });
  els.result.hidden = true;
  els.result.innerHTML = '';
  await loadAndRender();
}

// 调用 DeepSeek 流式解说接口清单
async function handleExplain() {
  els.errorBox.hidden = true;
  const { apiKey, model } = await chrome.storage.local.get(['apiKey', 'model']);
  if (!apiKey) {
    showError('请先点击右上角 ⚙ 配置 DeepSeek API Key');
    return;
  }

  els.explainBtn.disabled = true;
  els.result.hidden = false;
  els.result.innerHTML = '<p>AI 解说中…</p>';
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
          { role: 'user', content: buildUserPrompt() },
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
    els.explainBtn.disabled = false;
  }
}

function buildUserPrompt() {
  const lines = dedupedList.map((item) => {
    const query = item.queryKeys.size ? ` query[${[...item.queryKeys].join(',')}]` : '';
    return `${item.method} ${item.origin}${item.pathname} ×${item.count} [${item.statusCode}]${query}`;
  });
  return [
    `页面标题：${currentTab?.title || ''}`,
    `页面地址：${currentTab?.url || ''}`,
    '',
    '捕获到的接口清单：',
    ...lines,
  ].join('\n');
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
