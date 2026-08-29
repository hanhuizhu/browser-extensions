// content script（document_start 注入）：
// 按设置给页面套上暗黑皮肤；设置变化时实时增删/更新，无需刷新页面

(() => {
  const STYLE_ID = '__dark_skin_style__';

  init();

  async function init() {
    await applyFromSettings();
    // 监听设置变化（popup/options 修改后实时生效）
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        applyFromSettings();
      }
    });
  }

  async function applyFromSettings() {
    const settings = await loadDarkSettings();
    const shouldApply =
      settings.enabled && !isUrlExcluded(location.href, settings.excludePatterns);

    if (!shouldApply) {
      removeStyle();
      return;
    }
    upsertStyle(buildDarkCss(settings.strength, settings.baseColor));
  }

  function upsertStyle(css) {
    let styleEl = document.getElementById(STYLE_ID);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      // document_start 时 head 可能还不存在，挂到 documentElement 上同样生效
      (document.head || document.documentElement).appendChild(styleEl);
    }
    styleEl.textContent = css;
  }

  function removeStyle() {
    document.getElementById(STYLE_ID)?.remove();
  }
})();
