// 弹窗逻辑：给当前标签页注入/移除主题 CSS，皮肤状态按标签页记录在 storage.session

let currentTab = null;
let activeThemeKey = null;

const themesContainer = document.getElementById('themes');

init();

async function init() {
  [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const stored = await chrome.storage.session.get(stateKey());
  activeThemeKey = stored[stateKey()] || null;
  renderButtons();
}

function stateKey() {
  return `skin_${currentTab?.id}`;
}

function renderButtons() {
  const themeButtons = Object.entries(THEMES)
    .map(
      ([key, theme]) => `
        <button class="theme ${key === activeThemeKey ? 'is-active' : ''}" data-theme="${key}">
          <span class="theme__emoji">${theme.emoji}</span>
          <span>${theme.label}</span>
        </button>`
    )
    .join('');
  themesContainer.innerHTML = `${themeButtons}
    <button class="theme restore" data-theme=""><span class="theme__emoji">↩️</span><span>恢复原状</span></button>`;

  for (const button of themesContainer.querySelectorAll('.theme')) {
    button.addEventListener('click', () => applyTheme(button.dataset.theme || null));
  }
}

async function applyTheme(themeKey) {
  if (!currentTab?.id) {
    return;
  }
  try {
    // 先移除已有皮肤（removeCSS 需要与注入时完全相同的 css 文本）
    if (activeThemeKey && THEMES[activeThemeKey]) {
      await chrome.scripting.removeCSS({
        target: { tabId: currentTab.id },
        css: THEMES[activeThemeKey].css,
      });
    }
    if (themeKey && THEMES[themeKey]) {
      await chrome.scripting.insertCSS({
        target: { tabId: currentTab.id },
        css: THEMES[themeKey].css,
      });
    }
    activeThemeKey = themeKey;
    await chrome.storage.session.set({ [stateKey()]: themeKey });
    renderButtons();
  } catch {
    // 浏览器内置页面等无法注入，静默忽略
  }
}
