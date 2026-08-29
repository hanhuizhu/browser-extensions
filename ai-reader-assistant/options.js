// 设置页逻辑：读写 API Key 与模型名称（仅保存在本机 chrome.storage.local）

const apiKeyInput = document.getElementById('apiKey');
const modelInput = document.getElementById('model');
const saveBtn = document.getElementById('saveBtn');
const saveTip = document.getElementById('saveTip');

init();

async function init() {
  const { apiKey, model } = await chrome.storage.local.get(['apiKey', 'model']);
  apiKeyInput.value = apiKey || '';
  modelInput.value = model || '';
  saveBtn.addEventListener('click', handleSave);
}

async function handleSave() {
  const apiKey = apiKeyInput.value.trim();
  const model = modelInput.value.trim() || DEFAULT_MODEL;

  if (!apiKey) {
    apiKeyInput.focus();
    return;
  }

  await chrome.storage.local.set({ apiKey, model });
  saveTip.hidden = false;
  setTimeout(() => {
    saveTip.hidden = true;
  }, 1500);
}
