// 全局常量定义（popup 与 options 页面共用）

// DeepSeek API 请求地址
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// 默认模型
const DEFAULT_MODEL = 'deepseek-v4-flash-vision-exp';

// 页面正文最大截取长度（字符数），避免超出上下文
const MAX_CONTENT_LENGTH = 20000;

// 无法注入脚本的受限页面前缀
const RESTRICTED_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'edge://',
  'about:',
  'view-source:',
  'https://chrome.google.com/webstore',
  'https://chromewebstore.google.com',
];

// 总结的系统提示词
const SYSTEM_PROMPT = `你是一个网页阅读助手，帮助用户快速判断一个网页值不值得读、讲了什么。
根据用户提供的网页标题、URL 和正文，用简体中文输出总结，严格遵循以下结构：

**一句话概括**：这个网页是什么（类型 + 核心内容），不超过 40 字。

**核心要点**：3~6 条要点，每条一行，抓最有信息量的内容；如有关键数据、结论、观点务必保留。

**适合谁读**：一句话说明什么人/什么场景值得细读，或者明确说"可以不用细读"。

只基于正文内容总结，不要编造正文中没有的信息。`;
