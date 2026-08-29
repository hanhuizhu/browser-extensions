// 弹窗主逻辑：打开即自动抓取当前页正文并调用 DeepSeek 流式总结

const els = {
  setupView: document.getElementById('setupView'),
  mainView: document.getElementById('mainView'),
  pageInfo: document.getElementById('pageInfo'),
  pageTitle: document.getElementById('pageTitle'),
  pageUrl: document.getElementById('pageUrl'),
  status: document.getElementById('status'),
  statusText: document.getElementById('statusText'),
  errorBox: document.getElementById('errorBox'),
  summary: document.getElementById('summary'),
  retryBtn: document.getElementById('retryBtn'),
  copyBtn: document.getElementById('copyBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
  openOptionsBtn: document.getElementById('openOptionsBtn'),
};

let summaryRawText = ''; // 当前总结的原始 Markdown 文本

init();

async function init() {
  els.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  els.openOptionsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  els.retryBtn.addEventListener('click', handleSummarize);
  els.copyBtn.addEventListener('click', handleCopy);

  const { apiKey } = await chrome.storage.local.get(['apiKey']);
  if (!apiKey) {
    els.setupView.hidden = false;
    return;
  }
  els.mainView.hidden = false;
  handleSummarize();
}

// 执行一次完整的「抓取 + 总结」流程
async function handleSummarize() {
  resetView();
  setStatus('正在读取页面内容…');

  try {
    const tab = await getActiveTab();
    if (!tab || isRestrictedUrl(tab.url)) {
      throw new Error('当前页面不支持总结（浏览器内置页面或应用商店页面）');
    }

    const page = await extractFromTab(tab.id);
    if (!page || !page.text) {
      throw new Error('未能提取到页面正文内容');
    }

    els.pageTitle.textContent = page.title || tab.title || '';
    els.pageUrl.textContent = page.url;
    els.pageInfo.hidden = false;

    setStatus('AI 总结中…');
    await streamSummary(page);
    hideStatus();
    els.retryBtn.hidden = false;
    els.copyBtn.hidden = false;
  } catch (error) {
    hideStatus();
    showError(error.message || '发生未知错误');
    els.retryBtn.hidden = false;
  }
}

function resetView() {
  summaryRawText = '';
  els.errorBox.hidden = true;
  els.summary.hidden = true;
  els.summary.innerHTML = '';
  els.retryBtn.hidden = true;
  els.copyBtn.hidden = true;
}

function setStatus(text) {
  els.statusText.textContent = text;
  els.status.hidden = false;
}

function hideStatus() {
  els.status.hidden = true;
}

function showError(message) {
  els.errorBox.textContent = message;
  els.errorBox.hidden = false;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function isRestrictedUrl(url) {
  if (!url) {
    return true;
  }
  return RESTRICTED_URL_PREFIXES.some((prefix) => url.startsWith(prefix));
}

// 向目标标签页注入脚本，提取标题、描述与正文
async function extractFromTab(tabId) {
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const title = document.title || '';
      const desc = document.querySelector('meta[name="description"]')?.content || '';
      // 优先取语义化正文区域，减少导航/侧栏噪音
      const root =
        document.querySelector('article') || document.querySelector('main') || document.body;
      const text = (root?.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
      return { title, desc, url: location.href, text };
    },
  });
  return injection?.result;
}

// 调用 DeepSeek API，SSE 流式渲染总结
async function streamSummary(page) {
  const { apiKey, model } = await chrome.storage.local.get(['apiKey', 'model']);
  const userPrompt = buildUserPrompt(page);

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
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  els.summary.hidden = false;
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
    buffer = lines.pop() || ''; // 末尾可能是不完整行，留到下一轮

    for (const line of lines) {
      const data = line.trim().replace(/^data:\s*/, '');
      if (!data || data === '[DONE]' || !line.startsWith('data:')) {
        continue;
      }
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (delta) {
          summaryRawText += delta;
          els.summary.innerHTML = renderMarkdown(summaryRawText);
        }
      } catch {
        // 忽略无法解析的分片
      }
    }
  }

  if (!summaryRawText) {
    throw new Error('模型未返回内容，请检查模型名称是否正确');
  }
}

function buildUserPrompt(page) {
  const content = page.text.slice(0, MAX_CONTENT_LENGTH);
  return [
    `网页标题：${page.title}`,
    `URL：${page.url}`,
    page.desc ? `页面描述：${page.desc}` : '',
    '',
    '网页正文：',
    content,
  ]
    .filter(Boolean)
    .join('\n');
}

// 解析 API 错误响应，给出可读的错误信息
async function readApiError(response) {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message || JSON.stringify(body);
  } catch {
    detail = await response.text().catch(() => '');
  }
  if (response.status === 401) {
    return `API Key 无效或已过期，请到设置中检查（${detail}）`;
  }
  return `请求失败（HTTP ${response.status}）：${detail}`;
}

// 极简 Markdown 渲染：仅支持总结场景用到的加粗、标题、列表、行内代码
function renderMarkdown(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

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

async function handleCopy() {
  if (!summaryRawText) {
    return;
  }
  await navigator.clipboard.writeText(summaryRawText);
  els.copyBtn.textContent = '已复制 ✓';
  setTimeout(() => {
    els.copyBtn.textContent = '复制总结';
  }, 1500);
}
