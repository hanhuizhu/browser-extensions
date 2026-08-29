// 后台 Service Worker：负责实际调用 DeepSeek API（扩展有 host_permissions，无 CORS 限制），
// 通过长连接 Port 把流式结果转发给 content script

importScripts('constants.js');

// 点击工具栏图标 → 打开设置页
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

// content script 请求打开设置页
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'openOptions') {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ai-request') {
    return;
  }
  const controller = new AbortController();
  port.onDisconnect.addListener(() => controller.abort()); // 气泡关闭时中断请求

  port.onMessage.addListener((message) => {
    if (message?.type !== 'request') {
      return;
    }
    handleRequest(port, message, controller).catch((error) => {
      if (error?.name !== 'AbortError') {
        trySend(port, { type: 'error', message: error.message || '发生未知错误' });
      }
    });
  });
});

// 处理一次划词请求：读取配置 → 流式调用 → 转发增量内容
async function handleRequest(port, message, controller) {
  const { apiKey, model } = await chrome.storage.local.get(['apiKey', 'model']);
  if (!apiKey) {
    trySend(port, { type: 'needKey' });
    return;
  }

  const actionConf = ACTION_PROMPTS[message.action];
  if (!actionConf) {
    trySend(port, { type: 'error', message: `未知操作：${message.action}` });
    return;
  }

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || DEFAULT_MODEL,
      stream: true,
      messages: [
        { role: 'system', content: actionConf.system },
        { role: 'user', content: buildUserPrompt(message) },
      ],
    }),
  });

  if (!response.ok) {
    trySend(port, { type: 'error', message: await readApiError(response) });
    return;
  }

  await relayStream(response, port);
  trySend(port, { type: 'done' });
}

function buildUserPrompt(message) {
  const selection = (message.text || '').slice(0, MAX_SELECTION_LENGTH);
  return [
    `页面标题：${message.title || ''}`,
    message.context ? `选中内容所在的上下文：\n${message.context}` : '',
    '',
    '选中内容：',
    selection,
  ]
    .filter(Boolean)
    .join('\n');
}

// 解析 SSE 流，把增量文本逐段发给 content script
async function relayStream(response, port) {
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
          trySend(port, { type: 'delta', content: delta });
        }
      } catch {
        // 忽略无法解析的分片
      }
    }
  }
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
    return `API Key 无效或已过期，请点击扩展图标检查设置（${detail}）`;
  }
  return `请求失败（HTTP ${response.status}）：${detail}`;
}

// Port 可能已断开，发送失败时静默忽略
function trySend(port, message) {
  try {
    port.postMessage(message);
  } catch {
    // 忽略
  }
}
