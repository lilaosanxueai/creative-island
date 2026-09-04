import * as Blockly from 'blockly';
import * as zhHans from 'blockly/msg/zh-hans';

/** 小剧场全部积木定义（全部为 island_ 前缀的自定义积木，不依赖内置积木） */

Blockly.setLocale(zhHans as unknown as Record<string, string>);

export const KEY_OPTIONS: [string, string][] = [
  ['↑ 上箭头', 'up'], ['↓ 下箭头', 'down'], ['← 左箭头', 'left'], ['→ 右箭头', 'right'], ['空格', 'space'],
];

export const COSTUME_OPTIONS: [string, string][] = [
  ['🤖 机器人', '🤖'], ['🐱 小猫', '🐱'], ['🚀 火箭', '🚀'], ['🦊 小狐狸', '🦊'],
  ['⭐ 星星', '⭐'], ['🎂 蛋糕', '🎂'], ['🏀 篮球', '🏀'],
];

export const SOUND_OPTIONS: [string, string][] = [
  ['🔔 叮咚', 'ding'], ['🎉 欢呼', 'cheer'], ['🐱 喵', 'meow'], ['💥 砰', 'pop'],
];

const C = { event: '#FFBF00', motion: '#4C97FF', looks: '#9966FF', sound: '#CF63CF', control: '#FFAB19', sensing: '#5CB1D6', ops: '#59C059' };

export const BLOCK_CATEGORIES: Record<string, { name: string; colour: string; blocks: string[] }> = {
  event:   { name: '⚡ 事件', colour: C.event,   blocks: ['island_when_run', 'island_when_key', 'island_when_clicked'] },
  motion:  { name: '🏃 运动', colour: C.motion,  blocks: ['island_move', 'island_turn_right', 'island_turn_left', 'island_goto', 'island_bounce'] },
  looks:   { name: '🎭 外观', colour: C.looks,   blocks: ['island_say', 'island_say_for', 'island_costume', 'island_change_size', 'island_show', 'island_hide'] },
  sound:   { name: '🔊 声音', colour: C.sound,   blocks: ['island_play'] },
  control: { name: '🔁 控制', colour: C.control, blocks: ['island_repeat', 'island_forever', 'island_wait', 'island_if', 'island_if_else'] },
  sensing: { name: '👀 侦测', colour: C.sensing, blocks: ['island_touching_edge', 'island_key_down'] },
  ops:     { name: '🎲 运算', colour: C.ops,     blocks: ['island_number', 'island_random'] },
};

export const ALL_BLOCK_TYPES = Object.values(BLOCK_CATEGORIES).flatMap((c) => c.blocks);

Blockly.defineBlocksWithJsonArray([
  // ---------- 事件（帽子积木） ----------
  { type: 'island_when_run', message0: '当 ▶ 开始被点击', nextStatement: null, colour: C.event, tooltip: '点下面的 ▶ 按钮时，从这里开始执行' },
  { type: 'island_when_key', message0: '当按下 %1 键', args0: [{ type: 'field_dropdown', name: 'KEY', options: KEY_OPTIONS }], nextStatement: null, colour: C.event, tooltip: '运行中按下这个键时触发' },
  { type: 'island_when_clicked', message0: '当角色被点击', nextStatement: null, colour: C.event, tooltip: '运行中点击舞台上的角色时触发' },

  // ---------- 运动 ----------
  { type: 'island_move', message0: '移动 %1 步', args0: [{ type: 'input_value', name: 'STEPS', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C.motion, tooltip: '朝当前朝向移动（可以塞进随机数）' },
  { type: 'island_turn_right', message0: '右转 %1 度', args0: [{ type: 'field_number', name: 'DEG', value: 15, min: -360, max: 360 }], previousStatement: null, nextStatement: null, colour: C.motion, tooltip: '顺时针旋转' },
  { type: 'island_turn_left', message0: '左转 %1 度', args0: [{ type: 'field_number', name: 'DEG', value: 15, min: -360, max: 360 }], previousStatement: null, nextStatement: null, colour: C.motion, tooltip: '逆时针旋转' },
  { type: 'island_goto', message0: '移到 x：%1 y：%2', args0: [{ type: 'input_value', name: 'X', check: 'Number' }, { type: 'input_value', name: 'Y', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C.motion, tooltip: '瞬移到舞台某个位置，中心是 (0, 0)' },
  { type: 'island_bounce', message0: '碰到边缘就反弹', previousStatement: null, nextStatement: null, colour: C.motion, tooltip: '如果在边缘，就转身弹回来' },

  // ---------- 外观 ----------
  { type: 'island_say', message0: '说 %1', args0: [{ type: 'field_input', name: 'TEXT', text: '你好！' }], previousStatement: null, nextStatement: null, colour: C.looks, tooltip: '显示一个说话气泡' },
  { type: 'island_say_for', message0: '说 %1 停 %2 秒', args0: [{ type: 'field_input', name: 'TEXT', text: '看我！' }, { type: 'field_number', name: 'SECS', value: 2, min: 0.1, max: 30 }], previousStatement: null, nextStatement: null, colour: C.looks, tooltip: '显示气泡，几秒后消失' },
  { type: 'island_costume', message0: '变成 %1', args0: [{ type: 'field_dropdown', name: 'COSTUME', options: COSTUME_OPTIONS }], previousStatement: null, nextStatement: null, colour: C.looks, tooltip: '换一个角色造型' },
  { type: 'island_change_size', message0: '大小改变 %1', args0: [{ type: 'input_value', name: 'NUM', check: 'Number' }], previousStatement: null, nextStatement: null, colour: C.looks, tooltip: '正数变大，负数变小' },
  { type: 'island_show', message0: '显示', previousStatement: null, nextStatement: null, colour: C.looks, tooltip: '让角色出现' },
  { type: 'island_hide', message0: '隐藏', previousStatement: null, nextStatement: null, colour: C.looks, tooltip: '让角色消失' },

  // ---------- 声音 ----------
  { type: 'island_play', message0: '播放声音 %1', args0: [{ type: 'field_dropdown', name: 'SOUND', options: SOUND_OPTIONS }], previousStatement: null, nextStatement: null, colour: C.sound, tooltip: '播放一个音效' },

  // ---------- 控制 ----------
  { type: 'island_repeat', message0: '重复 %1 次', args0: [{ type: 'field_number', name: 'TIMES', value: 4, min: 1, max: 200 }], message1: '%1', args1: [{ type: 'input_statement', name: 'STACK' }], previousStatement: null, nextStatement: null, colour: C.control, tooltip: '把里面的积木重复做几遍' },
  { type: 'island_forever', message0: '一直重复', message1: '%1', args1: [{ type: 'input_statement', name: 'STACK' }], previousStatement: null, colour: C.control, tooltip: '永不停止地重复（直到按 ⏹）' },
  { type: 'island_wait', message0: '等待 %1 秒', args0: [{ type: 'field_number', name: 'SECS', value: 1, min: 0.1, max: 60 }], previousStatement: null, nextStatement: null, colour: C.control, tooltip: '停一下再继续' },
  { type: 'island_if', message0: '如果 %1 那么', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }], message1: '%1', args1: [{ type: 'input_statement', name: 'STACK' }], previousStatement: null, nextStatement: null, colour: C.control, tooltip: '条件成立才做里面的积木' },
  { type: 'island_if_else', message0: '如果 %1 那么', args0: [{ type: 'input_value', name: 'COND', check: 'Boolean' }], message1: '%1', args1: [{ type: 'input_statement', name: 'STACK' }], message2: '否则 %1', args2: [{ type: 'input_statement', name: 'STACK2' }], previousStatement: null, nextStatement: null, colour: C.control, tooltip: '条件成立做一块，不成立做另一块' },

  // ---------- 侦测 ----------
  { type: 'island_touching_edge', message0: '碰到边缘？', output: 'Boolean', colour: C.sensing, tooltip: '角色是否碰到了舞台边缘' },
  { type: 'island_key_down', message0: '按下 %1 键？', args0: [{ type: 'field_dropdown', name: 'KEY', options: KEY_OPTIONS }], output: 'Boolean', colour: C.sensing, tooltip: '某个键此刻是否被按着' },

  // ---------- 运算 ----------
  { type: 'island_number', message0: '%1', args0: [{ type: 'field_number', name: 'NUM', value: 1 }], output: 'Number', colour: C.ops, tooltip: '一个数字，可以塞进别的积木空位里' },
  { type: 'island_random', message0: '在 %1 和 %2 之间取随机数', args0: [{ type: 'input_value', name: 'FROM', check: 'Number' }, { type: 'input_value', name: 'TO', check: 'Number' }], output: 'Number', colour: C.ops, tooltip: '每次都抽一个不一样的数' },
]);

/** 积木类型 → 中文名（给 AI 上下文摘要用） */
export const BLOCK_LABELS: Record<string, string> = {
  island_when_run: '当开始被点击', island_when_key: '当按下某键', island_when_clicked: '当角色被点击',
  island_move: '移动', island_turn_right: '右转', island_turn_left: '左转', island_goto: '移到xy', island_bounce: '边缘反弹',
  island_say: '说', island_say_for: '说几秒', island_costume: '换造型', island_change_size: '改变大小', island_show: '显示', island_hide: '隐藏',
  island_play: '播放声音', island_repeat: '重复几次', island_forever: '一直重复', island_wait: '等待', island_if: '如果', island_if_else: '如果否则',
  island_touching_edge: '碰到边缘?', island_key_down: '按下某键?', island_number: '数字', island_random: '随机数',
};
