/**
 * 引导大脑：在孩子需要的时刻主动开口，而不是等他提问。
 * 纯函数规则表 —— 输入「刚刚发生的事件 + 已说过什么」，输出要不要说话、说什么。
 * 原则：少说、在点上、永远给孩子下一步的选择权（而不是指令）。
 */

export type GuideEvent =
  | { type: 'first-block' }                    // 放下第一块积木
  | { type: 'first-run'; ok: boolean }         // 第一次点 ▶
  | { type: 'run-error' }                      // 程序出错了
  | { type: 'idle'; seconds: number }          // 发呆了一阵
  | { type: 'discovery'; label: string }       // 点亮一个发现
  | { type: 'empty-stage' }                    // 画布空着，还没开始
  | { type: 'repeat-same-fail'; times: number }; // 连续几次运行都没进展

/** 同类引导的最小间隔（毫秒），避免唠叨 */
const COOLDOWN: Partial<Record<GuideEvent['type'], number>> = {
  'idle': 90_000,
  'run-error': 60_000,
  'first-block': Number.MAX_SAFE_INTEGER, // 一次会话只说一次
  'first-run': Number.MAX_SAFE_INTEGER,
  'empty-stage': 120_000,
  'repeat-same-fail': 180_000,
};

const LINES: Partial<Record<GuideEvent['type'], string[]>> = {
  'discovery': [], // discovery 由喝彩系统处理，这里不需要文案
  'first-block': [
    '第一块积木落位！它现在还不会动——想让它动，找找黄色那块「当 ▶ 开始」🚦',
  ],
  'first-run': [
    '跑起来了！这就是你的程序在执行。想再进一步吗——比如让它听键盘的？试试「当按下某键」🎮',
    '它动了！你刚刚让机器听懂了人话。下一步想让它说什么、去哪里，都可以告诉它～',
  ],
  'run-error': [
    '程序出了点小状况——这不是失败，是它在给你线索！看看哪里和你想的不一样？🔍',
    '嗯…和预期不一样对吧。创作者都是这样：改一下、再跑一次。要不要我陪你找找哪里不一样？',
  ],
  'idle': [
    '在想什么呢？跟我说说你想让它做什么，我们一起拆步骤 🤔',
    '卡住了也没关系——要不要我给一点点提示？就一点点 💡',
  ],
  'empty-stage': [
    '画布还空着呢～左边工具箱里随便拖一块出来玩，坏了也无所谓，这是你的岛 🏝',
    '不知道从哪开始？跟我说说你想做什么（比如「让它跳舞」），我陪你一步步搭！',
  ],
  'repeat-same-fail': [
    '试了好几次都差一点…要不要换个思路？有时候把大步拆成小步就通了 🧩',
  ],
};

export interface GuideState {
  said: Set<GuideEvent['type']>;
  lastAt: Partial<Record<GuideEvent['type'], number>>;
  failStreak: number;
}

export function newGuideState(): GuideState {
  return { said: new Set(), lastAt: {}, failStreak: 0 };
}

/**
 * 事件进来，决定要不要说话。返回 null = 沉默（沉默也是一种引导）。
 * discovery 事件不走这里——那是喝彩系统的事。
 */
export function guideRespond(ev: GuideEvent, state: GuideState, now = Date.now()): string | null {
  if (ev.type === 'discovery') return null;
  if (ev.type === 'first-run' && !ev.ok) {
    // 第一次跑就出错：走 run-error 文案，同样计入失败次数
    state.failStreak++;
    return pick('run-error', state, now);
  }
  if (ev.type === 'first-run') {
    state.failStreak = 0;
    return pick('first-run', state, now);
  }
  if (ev.type === 'run-error') {
    state.failStreak++;
    if (state.failStreak >= 3) return pick('repeat-same-fail', state, now);
    return pick('run-error', state, now);
  }
  return pick(ev.type, state, now);
}

function pick(type: GuideEvent['type'], state: GuideState, now: number): string | null {
  const cooldown = COOLDOWN[type] ?? 30_000;
  if (state.lastAt[type] && now - (state.lastAt[type] ?? 0) < cooldown) return null;
  if (cooldown === Number.MAX_SAFE_INTEGER && state.said.has(type)) return null;
  const pool = LINES[type];
  if (!pool || pool.length === 0) return null;
  const line = pool[Math.floor(Math.random() * pool.length)];
  state.said.add(type);
  state.lastAt[type] = now;
  return line;
}
