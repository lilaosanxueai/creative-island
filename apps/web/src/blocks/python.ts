import { pythonGenerator, Order } from 'blockly/python';

/**
 * 积木 → 真 Python：与 pyinterp.ts 迷你解释器严格同方言。
 * 事件帽子积木导出为 on_key("up"): 等处理器；当▶开始 的链条导出为顶层代码。
 */

const CMD: Record<string, (b: import('blockly').Block) => string[]> = {
  island_move: (b) => args(b, 'STEPS', '0'),
  island_turn_right: (b) => [num(b.getFieldValue('DEG'))],
  island_turn_left: (b) => [num(b.getFieldValue('DEG'))],
  island_goto: (b) => [val(b, 'X', '0'), val(b, 'Y', '0')],
  island_say: (b) => [str(b.getFieldValue('TEXT'))],
  island_say_for: (b) => [str(b.getFieldValue('TEXT')), num(b.getFieldValue('SECS'))],
  island_costume: (b) => [str(b.getFieldValue('COSTUME'))],
  island_change_size: (b) => [val(b, 'NUM', '0')],
  island_play: (b) => [str(b.getFieldValue('SOUND'))],
  island_wait: (b) => [num(b.getFieldValue('SECS'))],
} as const;

const str = (v: unknown): string => JSON.stringify(String(v ?? ''));
const num = (v: unknown): string => String(Number(v) || 0);
const val = (b: import('blockly').Block, name: string, fallback: string): string =>
  pythonGenerator.valueToCode(b, name, Order.NONE) || fallback;

function args(b: import('blockly').Block, name: string, fallback: string): string[] {
  return [val(b, name, fallback)];
}

for (const [type, argFn] of Object.entries(CMD)) {
  pythonGenerator.forBlock[type] = (b) => `${type.slice('island_'.length)}(${argFn(b).join(', ')})\n`;
}
pythonGenerator.forBlock['island_bounce'] = () => 'bounce()\n';
pythonGenerator.forBlock['island_show'] = () => 'show()\n';
pythonGenerator.forBlock['island_hide'] = () => 'hide()\n';

pythonGenerator.forBlock['island_when_run'] = (b) => {
  // Blockly 对返回空串的帽子会丢弃 next 链，手动展开「当开始」的子链为顶层代码
  let code = '';
  let child = b.getNextBlock();
  while (child) {
    code += pythonGenerator.blockToCode(child, true);
    child = child.getNextBlock();
  }
  return code;
};
pythonGenerator.forBlock['island_when_key'] = (b) => `on_key(${str(b.getFieldValue('KEY'))}):\n${pythonGenerator.statementToCode(b, 'STACK') || '    pass\n'}`;
pythonGenerator.forBlock['island_when_clicked'] = (b) => `on_click():\n${pythonGenerator.statementToCode(b, 'STACK') || '    pass\n'}`;
pythonGenerator.forBlock['island_when_recognized'] = (b) => `on_recognize(${str(b.getFieldValue('CLASS'))}):\n${pythonGenerator.statementToCode(b, 'STACK') || '    pass\n'}`;

pythonGenerator.forBlock['island_repeat'] = (b) => {
  const n = val(b, 'TIMES', '4') || num(b.getFieldValue('TIMES'));
  return `for _ in range(${n}):\n${pythonGenerator.statementToCode(b, 'STACK') || '    pass\n'}`;
};
pythonGenerator.forBlock['island_forever'] = (b) => `while True:\n${pythonGenerator.statementToCode(b, 'STACK') || '    pass\n'}`;
pythonGenerator.forBlock['island_if'] = (b) => `if ${pythonGenerator.valueToCode(b, 'COND', Order.NONE) || 'False'}:\n${pythonGenerator.statementToCode(b, 'STACK') || '    pass\n'}`;
pythonGenerator.forBlock['island_if_else'] = (b) =>
  `if ${pythonGenerator.valueToCode(b, 'COND', Order.NONE) || 'False'}:\n${pythonGenerator.statementToCode(b, 'STACK') || '    pass\n'}else:\n${pythonGenerator.statementToCode(b, 'STACK2') || '    pass\n'}`;

pythonGenerator.forBlock['island_touching_edge'] = () => ['touching_edge()', Order.ATOMIC];
pythonGenerator.forBlock['island_key_down'] = (b) => [`key_down(${str(b.getFieldValue('KEY'))})`, Order.ATOMIC];
pythonGenerator.forBlock['island_recognize'] = (b) => [`recognize(${str(b.getFieldValue('CLASS'))})`, Order.ATOMIC];
pythonGenerator.forBlock['island_number'] = (b) => [num(b.getFieldValue('NUM')), Order.ATOMIC];
pythonGenerator.forBlock['island_random'] = (b) => [`random(${val(b, 'FROM', '1')}, ${val(b, 'TO', '10')})`, Order.ATOMIC];

/** 工作区 → Python 代码（过滤空行） */
export function workspaceToPython(ws: import('blockly').Workspace): string {
  try {
    return pythonGenerator.workspaceToCode(ws).split('\n').filter((l) => l.trim()).join('\n');
  } catch (e) {
    (window as unknown as { __islandPyError?: string }).__islandPyError = String(e);
    console.error('Python 生成失败：', e);
    return '';
  }
}
