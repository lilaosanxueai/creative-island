import type { Block } from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

/** 每块自定义积木 → 带 await 的 JS 代码。命令经 api.* 落到舞台状态机 */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const str = (v: unknown): string => JSON.stringify(String(v ?? ''));

javascriptGenerator.forBlock['island_when_run'] = () => '';
javascriptGenerator.forBlock['island_when_key'] = () => '';
javascriptGenerator.forBlock['island_when_clicked'] = () => '';
javascriptGenerator.forBlock['island_when_recognized'] = () => '';

const valOr = (b: Block, name: string, fallback: string): string =>
  javascriptGenerator.valueToCode(b, name, Order.NONE) || fallback;

javascriptGenerator.forBlock['island_move'] = (b) => `await api.move(${valOr(b, 'STEPS', '0')});\n`;
javascriptGenerator.forBlock['island_turn_right'] = (b) => `await api.turnRight(${num(b.getFieldValue('DEG'))});\n`;
javascriptGenerator.forBlock['island_turn_left'] = (b) => `await api.turnLeft(${num(b.getFieldValue('DEG'))});\n`;
javascriptGenerator.forBlock['island_goto'] = (b) => `await api.goTo(${valOr(b, 'X', '0')}, ${valOr(b, 'Y', '0')});\n`;
javascriptGenerator.forBlock['island_bounce'] = () => 'await api.bounce();\n';

javascriptGenerator.forBlock['island_say'] = (b) => `await api.say(${str(b.getFieldValue('TEXT'))});\n`;
javascriptGenerator.forBlock['island_say_for'] = (b) => `await api.sayFor(${str(b.getFieldValue('TEXT'))}, ${num(b.getFieldValue('SECS'))});\n`;
javascriptGenerator.forBlock['island_costume'] = (b) => `await api.costume(${str(b.getFieldValue('COSTUME'))});\n`;
javascriptGenerator.forBlock['island_change_size'] = (b) => `await api.changeSize(${valOr(b, 'NUM', '0')});\n`;
javascriptGenerator.forBlock['island_show'] = () => 'await api.show();\n';
javascriptGenerator.forBlock['island_hide'] = () => 'await api.hide();\n';

javascriptGenerator.forBlock['island_play'] = (b) => `await api.play(${str(b.getFieldValue('SOUND'))});\n`;

javascriptGenerator.forBlock['island_repeat'] = (b) => {
  const times = num(b.getFieldValue('TIMES'));
  const stack = javascriptGenerator.statementToCode(b, 'STACK') || '';
  return `for (let __i = 0; __i < ${times}; __i++) {\nawait __guard();\n${stack}}\n`;
};
javascriptGenerator.forBlock['island_forever'] = (b) => {
  const stack = javascriptGenerator.statementToCode(b, 'STACK') || '';
  return `while (true) {\nawait __guard();\n${stack}}\n`;
};
javascriptGenerator.forBlock['island_wait'] = (b) => `await api.wait(${num(b.getFieldValue('SECS'))});\n`;
javascriptGenerator.forBlock['island_if'] = (b) => {
  const cond = javascriptGenerator.valueToCode(b, 'COND', Order.NONE) || 'false';
  const stack = javascriptGenerator.statementToCode(b, 'STACK') || '';
  return `if (${cond}) {\n${stack}}\n`;
};
javascriptGenerator.forBlock['island_if_else'] = (b) => {
  const cond = javascriptGenerator.valueToCode(b, 'COND', Order.NONE) || 'false';
  const s1 = javascriptGenerator.statementToCode(b, 'STACK') || '';
  const s2 = javascriptGenerator.statementToCode(b, 'STACK2') || '';
  return `if (${cond}) {\n${s1}} else {\n${s2}}\n`;
};

javascriptGenerator.forBlock['island_touching_edge'] = () => ['api.touchingEdge()', Order.ATOMIC];
javascriptGenerator.forBlock['island_key_down'] = (b) => [`api.keyDown(${str(b.getFieldValue('KEY'))})`, Order.ATOMIC];
javascriptGenerator.forBlock['island_recognize'] = (b) => [`api.recognize(${str(b.getFieldValue('CLASS'))})`, Order.ATOMIC];
javascriptGenerator.forBlock['island_number'] = (b) => [String(num(b.getFieldValue('NUM'))), Order.ATOMIC];
javascriptGenerator.forBlock['island_random'] = (b) =>
  [`api.random(${valOr(b, 'FROM', '1')}, ${valOr(b, 'TO', '10')})`, Order.ATOMIC];
