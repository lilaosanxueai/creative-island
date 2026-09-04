import type { utils } from 'blockly';
import { BLOCK_CATEGORIES } from './definitions.ts';

/** 值输入积木在工具箱里的默认阴影数字（拖出来就带一个可改的数字） */
const SHADOW_DEFAULTS: Record<string, Record<string, number>> = {
  island_move: { STEPS: 100 },
  island_goto: { X: 0, Y: 0 },
  island_change_size: { NUM: 20 },
  island_random: { FROM: 1, TO: 10 },
};

/** 按课程允许的积木列表生成分类工具箱 */
export function buildToolbox(allowed: string[]): utils.toolbox.ToolboxDefinition {
  const allow = new Set(allowed);
  const contents: Record<string, unknown>[] = [];
  for (const cat of Object.values(BLOCK_CATEGORIES)) {
    const blocks = cat.blocks.filter((b) => allow.has(b));
    if (blocks.length === 0) continue;
    contents.push({
      kind: 'category',
      name: cat.name,
      colour: cat.colour,
      contents: blocks.map((type) => {
        const shadows = SHADOW_DEFAULTS[type];
        if (!shadows) return { kind: 'block', type };
        const inputs: Record<string, unknown> = {};
        for (const [input, value] of Object.entries(shadows)) {
          inputs[input] = { shadow: { type: 'island_number', fields: { NUM: value } } };
        }
        return { kind: 'block', type, inputs };
      }),
    });
  }
  return { kind: 'categoryToolbox', contents } as unknown as utils.toolbox.ToolboxDefinition;
}
