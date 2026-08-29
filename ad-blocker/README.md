# 净网卫士

拦截常规广告与视频广告的三层方案。无 AI、无网络请求，工具栏徽标实时显示当前页拦截数。

## 三层拦截

1. **网络层**（`declarativeNetRequest` 静态规则）：拦截 60+ 条广告/追踪域名规则
   - 国际广告联盟：DoubleClick、AdSense、Criteo、Taboola、Outbrain 等
   - 国内广告联盟：阿里妈妈/Tanx、百度联盟、广点通、秒针、AdMaster 等
   - 视频广告接口：爱奇艺 cupid、优酷 atm、腾讯视频 livew/lives.l.qq.com、B站 cm.bilibili.com、芒果 da.mgtv.com、YouTube pagead
2. **样式层**（content script）：隐藏页面广告位——AdSense 插槽、Taboola/Outbrain 推荐流，以及 B站/知乎/CSDN/YouTube 的站点定制选择器
3. **播放器层**（YouTube 专用）：检测到播放器进入广告状态时自动静音 + 快进到广告末尾 + 秒点「跳过」按钮

## 使用

安装即生效。弹窗里有总开关（切换后刷新页面完全生效），徽标数字是当前页拦截的请求数。

## 效果预期（诚实说明）

- **常规网页广告 / YouTube**：效果好，覆盖大部分场景
- **B站**：信息流/横幅推广能去掉；正片贴片本来就少
- **腾爱优长视频**：拦截其广告接口后，贴片广告通常表现为跳过或短暂等待，但这些平台反拦截很强、策略经常变，**不保证一直有效**；会员专属推荐位、剧内口播无法去除
- 广告拦截是持续的猫鼠游戏，失效时更新 `rules.json` / 选择器即可，重度需求建议 uBlock Origin Lite

## 维护

- 加域名规则：改 `rules.json`（注意 id 不能重复），扩展页点刷新
- 加广告位选择器：改 `content.js` 的 `GENERIC_SELECTORS` / `SITE_SELECTORS`
