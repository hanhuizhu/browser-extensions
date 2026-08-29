// 后台 Service Worker：同步开关状态到 DNR 规则集，工具栏徽标显示每页拦截数

// 徽标显示当前标签页的拦截请求数
try {
  chrome.declarativeNetRequest.setExtensionActionOptions({ displayActionCountAsBadgeText: true });
} catch {
  // 部分旧版本不支持，忽略
}

chrome.runtime.onInstalled.addListener(syncEnabledState);
chrome.runtime.onStartup.addListener(syncEnabledState);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.adblockEnabled) {
    syncEnabledState();
  }
});

// 按开关状态启用/停用静态规则集（样式层由 content script 自行监听开关）
async function syncEnabledState() {
  const { adblockEnabled = true } = await chrome.storage.local.get('adblockEnabled');
  await chrome.declarativeNetRequest.updateEnabledRulesets(
    adblockEnabled ? { enableRulesetIds: ['ads'] } : { disableRulesetIds: ['ads'] }
  );
}
