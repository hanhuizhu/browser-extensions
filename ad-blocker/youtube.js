// YouTube 播放器广告处理：
// 检测到播放器进入广告状态时，静音 + 快进到广告末尾 + 自动点击「跳过」按钮

(() => {
  const CHECK_INTERVAL_MS = 500;
  const SKIP_BUTTON_SELECTOR =
    '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button';

  let mutedByUs = false; // 是否由本插件静音（广告结束后要还原）
  let enabled = true;

  init();

  async function init() {
    ({ adblockEnabled: enabled = true } = await chrome.storage.local.get('adblockEnabled'));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.adblockEnabled) {
        enabled = changes.adblockEnabled.newValue;
      }
    });
    setInterval(tick, CHECK_INTERVAL_MS);
  }

  function tick() {
    if (!enabled) {
      return;
    }
    const player = document.querySelector('.html5-video-player');
    const video = document.querySelector('video.html5-main-video');
    if (!player || !video) {
      return;
    }

    const isAdShowing = player.classList.contains('ad-showing');

    if (isAdShowing) {
      // 静音并快进到广告末尾，跳过按钮出现时立即点击
      if (!video.muted) {
        video.muted = true;
        mutedByUs = true;
      }
      if (Number.isFinite(video.duration) && video.duration > 0.5) {
        video.currentTime = video.duration;
      }
      document.querySelector(SKIP_BUTTON_SELECTOR)?.click();
    } else if (mutedByUs) {
      // 广告结束，还原声音
      video.muted = false;
      mutedByUs = false;
    }

    // 关闭悬浮横幅广告
    document.querySelector('.ytp-ad-overlay-close-button')?.click();
  }
})();
