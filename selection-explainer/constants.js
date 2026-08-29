// 全局常量定义（background 与 options 页面共用）

// DeepSeek API 请求地址
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

// 默认模型
const DEFAULT_MODEL = 'deepseek-v4-flash-vision-exp';

// 选中文字最大长度（字符数）
const MAX_SELECTION_LENGTH = 4000;

// 三种划词动作的提示词配置
const ACTION_PROMPTS = {
  explain: {
    label: '解释',
    system: `你是划词阅读助手。用户会提供网页中选中的一段内容，以及它所在的上下文。
请用简体中文简明地解释选中内容：它是什么意思，涉及哪些术语、概念或背景；如果是代码则解释它的作用。
控制在 200 字以内，可以用列表，直接给出解释，不要客套。`,
  },
  translate: {
    label: '翻译',
    system: `你是专业翻译。如果选中内容主要是中文，就翻译成地道的英文；否则翻译成地道的简体中文。
只输出译文本身，不要任何解释和说明。`,
  },
  simplify: {
    label: '大白话',
    system: `你是"大白话"助手。把选中内容用通俗易懂的大白话重新讲一遍，让非专业人士也能听懂，必要时可以打比方。
控制在 150 字以内，直接输出，不要客套。`,
  },
};
