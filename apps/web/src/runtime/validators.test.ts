import { describe, expect, it } from 'vitest';
import { checkRule, evaluateTasks, requiredTasksDone, type RunEvidence } from './validators.ts';

const ev = (over: Partial<RunEvidence> = {}): RunEvidence => ({
  blockCounts: {},
  saidTexts: [],
  reachedTargets: [],
  hasRun: false,
  ...over,
});

describe('checkRule 各类规则', () => {
  it('block_used：用了才算过', () => {
    expect(checkRule({ type: 'block_used', block: 'island_repeat' }, ev({ blockCounts: { island_repeat: 1 } }))).toBe(true);
    expect(checkRule({ type: 'block_used', block: 'island_repeat' }, ev())).toBe(false);
  });

  it('block_used_any：任一积木用过即过', () => {
    const rule: import('@shared/types.ts').CheckRule = { type: 'block_used_any', blocks: ['island_costume', 'island_change_size'] };
    expect(checkRule(rule, ev({ blockCounts: { island_change_size: 1 } }))).toBe(true);
    expect(checkRule(rule, ev({ blockCounts: { island_say: 3 } }))).toBe(false);
  });

  it('block_count_min：数量要达标', () => {
    const e = ev({ blockCounts: { island_wait: 2 } });
    expect(checkRule({ type: 'block_count_min', block: 'island_wait', count: 2 }, e)).toBe(true);
    expect(checkRule({ type: 'block_count_min', block: 'island_wait', count: 3 }, e)).toBe(false);
  });

  it('block_count_total_min：统计全部积木', () => {
    const e = ev({ blockCounts: { island_when_run: 1, island_move: 3, island_say: 4 } });
    expect(checkRule({ type: 'block_count_total_min', count: 8 }, e)).toBe(true);
    expect(checkRule({ type: 'block_count_total_min', count: 9 }, e)).toBe(false);
  });

  it('say_text：空字符串不算说话', () => {
    expect(checkRule({ type: 'say_text' }, ev({ saidTexts: ['你好'] }))).toBe(true);
    expect(checkRule({ type: 'say_text' }, ev({ saidTexts: ['  '] }))).toBe(false);
    expect(checkRule({ type: 'say_text' }, ev())).toBe(false);
  });

  it('actor_reach：到过目标点才算过', () => {
    expect(checkRule({ type: 'actor_reach', targetIndex: 0 }, ev({ reachedTargets: [0] }))).toBe(true);
    expect(checkRule({ type: 'actor_reach', targetIndex: 1 }, ev({ reachedTargets: [0] }))).toBe(false);
  });

  it('manual：自动校验恒 false，交给面板勾选', () => {
    expect(checkRule({ type: 'manual' }, ev({ hasRun: true }))).toBe(false);
  });
});

describe('evaluateTasks', () => {
  const tasks = [
    { id: 'a', check: { type: 'block_used', block: 'island_when_run' } as const },
    { id: 'b', check: { type: 'manual' } as const },
  ];

  it('自动任务按证据更新，manual 保留原状态', () => {
    const out = evaluateTasks(tasks, ev({ blockCounts: { island_when_run: 1 } }), { b: true });
    expect(out).toEqual({ a: true, b: true });
  });

  it('manual 原状态为空时保持未完成', () => {
    const out = evaluateTasks(tasks, ev(), {});
    expect(out).toEqual({ a: false, b: false });
  });
});

describe('requiredTasksDone 通关条件', () => {
  const tasks = [
    { id: 'a', check: { type: 'manual' } as const },
    { id: 'b', check: { type: 'manual' } as const, optional: true },
  ];

  it('⭐挑战（optional）不做完也能通关', () => {
    expect(requiredTasksDone(tasks, { a: true, b: false })).toBe(true);
  });
  it('必做任务缺一个都不行', () => {
    expect(requiredTasksDone(tasks, { a: false, b: true })).toBe(false);
  });
});
