// 样式层拦截（document_start 注入）：隐藏页面上的常见广告位
// 通用选择器 + 按站点定制选择器，开关变化实时生效

(() => {
  const STYLE_ID = '__ad_blocker_style__';

  // 通用广告位选择器（保守挑选，避免误伤正常内容）
  const GENERIC_SELECTORS = [
    'ins.adsbygoogle',
    '.adsbygoogle',
    '[id^="div-gpt-ad"]',
    '[id^="google_ads_iframe"]',
    'iframe[src*="doubleclick.net"]',
    'iframe[src*="googlesyndication"]',
    'iframe[src*="adnxs.com"]',
    '#carbonads',
    '[id^="taboola-"]',
    '.OUTBRAIN',
  ];

  // 按站点定制的广告位选择器（hostname 后缀匹配）
  const SITE_SELECTORS = {
    'bilibili.com': ['.ad-report', '.slide-ad-exp', '.adblock-tips'],
    'zhihu.com': ['.TopstoryItem--advertCard', '.Pc-word', '.Pc-feedAd-container'],
    'csdn.net': ['.ad-box', '[id^="kp_box_"]'],
    'youtube.com': [
      '#masthead-ad',
      '#player-ads',
      'ytd-ad-slot-renderer',
      'ytd-in-feed-ad-layout-renderer',
      'ytd-display-ad-renderer',
    ],
  };

  init();

  async function init() {
    await applyFromSettings();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.adblockEnabled) {
        applyFromSettings();
      }
    });
  }

  async function applyFromSettings() {
    const { adblockEnabled = true } = await chrome.storage.local.get('adblockEnabled');
    if (!adblockEnabled) {
      document.getElementById(STYLE_ID)?.remove();
      return;
    }
    upsertStyle(buildCss());
  }

  function buildCss() {
    const selectors = [...GENERIC_SELECTORS];
    for (const [siteSuffix, siteSelectors] of Object.entries(SITE_SELECTORS)) {
      if (location.hostname === siteSuffix || location.hostname.endsWith(`.${siteSuffix}`)) {
        selectors.push(...siteSelectors);
      }
    }
    return `${selectors.join(',\n')} { display: none !important; }`;
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
})();
