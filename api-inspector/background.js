// 后台 Service Worker：用 webRequest 观察各标签页的 XHR/Fetch 请求，
// 按 tabId 记录到 chrome.storage.session（SW 休眠后数据不丢，浏览器关闭自动清空）

importScripts('constants.js');

chrome.webRequest.onCompleted.addListener(handleRequest, { urls: ['<all_urls>'] });

// 标签页关闭时清理对应日志
chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.remove(logKey(tabId));
});

async function handleRequest(details) {
  const { tabId, type, method, url, statusCode, timeStamp } = details;
  if (tabId < 0) {
    return; // 非标签页发起的请求（扩展自身等）
  }
  if (type === 'main_frame') {
    await chrome.storage.session.set({ [logKey(tabId)]: [] }); // 页面导航，重置日志
    return;
  }
  if (type !== 'xmlhttprequest') {
    return; // 只关心 XHR/Fetch
  }
  if (url.startsWith(DEEPSEEK_API_URL)) {
    return; // 排除本插件自己的 AI 请求
  }

  const key = logKey(tabId);
  const stored = await chrome.storage.session.get(key);
  const log = stored[key] || [];
  log.push({ method, url, statusCode, timeStamp });
  if (log.length > MAX_LOG_SIZE) {
    log.splice(0, log.length - MAX_LOG_SIZE);
  }
  await chrome.storage.session.set({ [key]: log });
}

function logKey(tabId) {
  return `log_${tabId}`;
}
