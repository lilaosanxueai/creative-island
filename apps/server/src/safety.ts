/** 儿童安全过滤：纯函数，便于单测 */

/** 敏感话题关键词（命中则整条拒绝，给出温柔转移话术）。词库偏保守，家长可在代码里自行增删。 */
const SENSITIVE_WORDS: string[] = [
  '自杀', '自残', '杀', '毒品', '赌博', '色情', '裸', '做爱', '性交',
  '暴力', '血腥', '恐怖袭击', '枪', '刀伤',
];

/** 孩子输入中出现则提醒不要分享、且不转发给大模型的个人信息模式 */
const PERSONAL_INFO_PATTERNS: RegExp[] = [
  /1[3-9]\d{9}/,                                     // 手机号
  /\d{6}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]/, // 身份证
  /(\d{1,3}\.){3}\d{1,3}/,                           // IP 地址
  /(住址|家庭住址|我家在|学校在|几号院|几栋几楼|银行卡号|密码是|密码：)/,
];

const URL_RE = /https?:\/\/\S+|www\.\S+|\b[\w-]+\.(com|cn|net|org|io|xyz|top)\b\/?\S*/gi;

export function containsSensitive(text: string): boolean {
  return SENSITIVE_WORDS.some((w) => text.includes(w));
}

export function containsPersonalInfo(text: string): boolean {
  return PERSONAL_INFO_PATTERNS.some((re) => re.test(text));
}

/** 从模型输出里剥掉 URL（防外链） */
export function stripUrls(text: string): string {
  return text.replace(URL_RE, '（链接已隐藏）');
}

export const SENSITIVE_REFUSAL = '这个话题我们先不聊啦～我更想听听你的创作点子！比如你想让小机器人做什么有趣的事？🤖';

export const PERSONAL_INFO_REMINDER = '要保护好自己的小秘密哦！姓名、住址、手机号这些不要告诉我，也不不要告诉网上任何人。我们继续聊创作吧，你刚刚想做什么来着？😊';

/** 对孩子输入的统一安检。返回 null 表示安全放行，否则返回应回复的话术（不调用大模型）。 */
export function checkKidInput(text: string): string | null {
  if (containsSensitive(text)) return SENSITIVE_REFUSAL;
  if (containsPersonalInfo(text)) return PERSONAL_INFO_REMINDER;
  return null;
}

/** 注入到 system prompt 的护栏 */
export const SAFETY_RAILS = [
  '【安全规则（最高优先级，必须遵守）】',
  '1. 你只在"编程创作"话题内对话：积木搭建、剧场角色、游戏创意、课程任务。孩子聊其他话题时，温柔地把对话带回创作，如"我们回去看看小机器人吧！"',
  '2. 绝不询问或引导孩子提供任何个人信息（姓名、住址、学校、电话、密码等），若孩子主动说出，提醒他保护隐私。',
  '3. 不评价孩子本人，只评价作品与想法；不与"别人家孩子"比较。',
  '4. 不出现任何网址、链接、联系方式。',
  '5. 不讨论成人话题；遇到就转移到创作话题，不解释原因。',
  '6. 回复保持孩子能读懂的简短（一般不超过 120 字），多用表情符号，不用 Markdown 标题和表格。',
].join('\n');
