// 弹窗逻辑：开关 / 暗度 / 底色实时写入设置（content script 监听变化即时生效），
// 并支持一键把当前站点加入/移出排除列表

const els = {
  enabledSwitch: document.getElementById('enabledSwitch'),
  strengthRange: document.getElementById('strengthRange'),
  strengthValue: document.getElementById('strengthValue'),
  colorPicker: document.getElementById('colorPicker'),
  excludeBtn: document.getElementById('excludeBtn'),
  settingsBtn: document.getElementById('settingsBtn'),
};

let settings = null;
let currentHost = '';

init();

async function init() {
  settings = await loadDarkSettings();
  [{ url: currentHost = '' } = {}] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentHost = extractHost(currentHost);

  els.enabledSwitch.checked = settings.enabled;
  els.strengthRange.value = Math.round(settings.strength * 100);
  els.colorPicker.value = settings.baseColor;
  updateStrengthLabel();
  updateExcludeButton();

  els.settingsBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());
  els.enabledSwitch.addEventListener('change', () => save({ enabled: els.enabledSwitch.checked }));
  els.strengthRange.addEventListener('input', () => {
    updateStrengthLabel();
    save({ strength: Number(els.strengthRange.value) / 100 });
  });
  els.colorPicker.addEventListener('input', () => save({ baseColor: els.colorPicker.value }));
  els.excludeBtn.addEventListener('click', toggleExcludeCurrentSite);
}

function extractHost(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

async function save(patch) {
  Object.assign(settings, patch);
  await chrome.storage.local.set(patch);
}

function updateStrengthLabel() {
  els.strengthValue.textContent = `${els.strengthRange.value}%`;
}

// 当前站点的排除模式统一写成 *host* 形式
function currentSitePattern() {
  return `*${currentHost}*`;
}

function isCurrentSiteExcluded() {
  return settings.excludePatterns.includes(currentSitePattern());
}

function updateExcludeButton() {
  if (!currentHost) {
    els.excludeBtn.disabled = true;
    els.excludeBtn.textContent = '当前页面不适用';
    return;
  }
  if (isCurrentSiteExcluded()) {
    els.excludeBtn.classList.add('is-excluded');
    els.excludeBtn.textContent = `已排除 ${currentHost}（点击恢复暗黑）`;
  } else {
    els.excludeBtn.classList.remove('is-excluded');
    els.excludeBtn.textContent = `排除当前站点 ${currentHost}`;
  }
}

async function toggleExcludeCurrentSite() {
  const pattern = currentSitePattern();
  const excludePatterns = isCurrentSiteExcluded()
    ? settings.excludePatterns.filter((item) => item !== pattern)
    : [...settings.excludePatterns, pattern];
  await save({ excludePatterns });
  updateExcludeButton();
}
