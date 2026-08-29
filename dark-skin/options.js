// 设置页逻辑：编辑排除列表（一行一个模式，支持 * 通配）

const patternsInput = document.getElementById('patterns');
const saveBtn = document.getElementById('saveBtn');
const saveTip = document.getElementById('saveTip');

init();

async function init() {
  const settings = await loadDarkSettings();
  patternsInput.value = settings.excludePatterns.join('\n');
  saveBtn.addEventListener('click', handleSave);
}

async function handleSave() {
  const excludePatterns = patternsInput.value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  await chrome.storage.local.set({ excludePatterns });
  saveTip.hidden = false;
  setTimeout(() => {
    saveTip.hidden = true;
  }, 1500);
}
