// 后台 Service Worker：定时采样统计浏览时长
// 每分钟触发一次 alarm：若用户未空闲且 Chrome 窗口在前台，给当前活跃标签页的站点记 1 分钟

importScripts('constants.js');

chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);

function ensureAlarm() {
  chrome.alarms.create('sample-tick', { periodInMinutes: SAMPLE_INTERVAL_MINUTES });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'sample-tick') {
    return;
  }
  try {
    await sampleOnce();
  } catch {
    // 单次采样失败不影响后续
  }
});

async function sampleOnce() {
  // 用户空闲（无键鼠操作）或锁屏时不计时
  const idleState = await chrome.idle.queryState(IDLE_THRESHOLD_SECONDS);
  if (idleState !== 'active') {
    return;
  }

  // Chrome 窗口不在前台时不计时
  const focusedWindow = await chrome.windows.getLastFocused().catch(() => null);
  if (!focusedWindow?.focused) {
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, windowId: focusedWindow.id });
  const host = extractHost(tab?.url);
  if (!host) {
    return;
  }

  await addSeconds(host, SAMPLE_INTERVAL_MINUTES * 60);
}

// 提取可统计的站点域名，浏览器内置页面返回 null
function extractHost(url) {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.hostname;
  } catch {
    return null;
  }
}

// 累加时长并清理过期数据，结构：ledger = { '2026-08-29': { 'github.com': 秒数 } }
async function addSeconds(host, seconds) {
  const { ledger = {} } = await chrome.storage.local.get('ledger');
  const dayKey = localDateKey(new Date());
  ledger[dayKey] = ledger[dayKey] || {};
  ledger[dayKey][host] = (ledger[dayKey][host] || 0) + seconds;
  pruneOldDays(ledger);
  await chrome.storage.local.set({ ledger });
}

function pruneOldDays(ledger) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS_KEPT);
  const cutoffKey = localDateKey(cutoff);
  for (const dayKey of Object.keys(ledger)) {
    if (dayKey < cutoffKey) {
      delete ledger[dayKey];
    }
  }
}

// 本地时区的日期键：YYYY-MM-DD
function localDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
