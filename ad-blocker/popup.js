// 弹窗逻辑：全局拦截开关（网络层由 background 同步，样式/播放器层由各 content script 监听）

const enabledSwitch = document.getElementById('enabledSwitch');

init();

async function init() {
  const { adblockEnabled = true } = await chrome.storage.local.get('adblockEnabled');
  enabledSwitch.checked = adblockEnabled;
  enabledSwitch.addEventListener('change', () => {
    chrome.storage.local.set({ adblockEnabled: enabledSwitch.checked });
  });
}
