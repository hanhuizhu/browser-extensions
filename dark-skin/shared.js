// 共用常量与工具函数（content script、popup、options 共同引入）

// 默认设置
const DARK_DEFAULTS = {
  enabled: true, // 全局开关
  strength: 0.92, // 暗度（invert 强度，0.8 ~ 1.0）
  baseColor: '#111418', // 暗黑底色
  excludePatterns: [], // 排除的 URL 模式，支持 * 通配，如 *tuhu*
};

// 读取设置（未设置项落回默认值）
async function loadDarkSettings() {
  const stored = await chrome.storage.local.get(Object.keys(DARK_DEFAULTS));
  return { ...DARK_DEFAULTS, ...stored };
}

// 判断 URL 是否命中排除列表：模式支持 * 通配，无 * 时按子串匹配
function isUrlExcluded(url, patterns) {
  return (patterns || []).some((pattern) => {
    const trimmed = pattern.trim();
    if (!trimmed) {
      return false;
    }
    const regexSource = trimmed
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // 转义正则特殊字符（保留 *）
      .replace(/\*/g, '.*');
    return new RegExp(regexSource, 'i').test(url);
  });
}

// 反转十六进制颜色：页面会被 invert 滤镜整体反色，
// 所以底色要先反转一次注入，最终呈现的才是用户选择的颜色
function invertHexColor(hex) {
  const normalized = hex.replace('#', '');
  const r = 255 - parseInt(normalized.slice(0, 2), 16);
  const g = 255 - parseInt(normalized.slice(2, 4), 16);
  const b = 255 - parseInt(normalized.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

// 生成暗黑皮肤 CSS：整页反色 + 色相还原，媒体元素再反回来保持原样
function buildDarkCss(strength, baseColor) {
  return `
    html {
      filter: invert(${strength}) hue-rotate(180deg) !important;
      background-color: ${invertHexColor(baseColor)} !important;
    }
    img, picture, video, canvas, iframe, embed, object,
    [style*="background-image"] {
      filter: invert(1) hue-rotate(180deg) !important;
    }
  `;
}
