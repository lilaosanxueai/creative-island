import type { CheckRule } from '@shared/types.ts';

/** 关卡校验引擎（纯函数，单测覆盖） */

export interface RunEvidence {
  /** 工作区各类型积木数量 */
  blockCounts: Record<string, number>;
  /** 本次课程里角色说过的话（跨运行累积） */
  saidTexts: string[];
  /** 已到达过的目标点索引（跨运行累积） */
  reachedTargets: number[];
  /** 是否成功跑过至少一次 */
  hasRun: boolean;
}

export function checkRule(rule: CheckRule, ev: RunEvidence): boolean {
  switch (rule.type) {
    case 'block_used':
      return (ev.blockCounts[rule.block] ?? 0) >= 1;
    case 'block_used_any':
      return rule.blocks.some((b) => (ev.blockCounts[b] ?? 0) >= 1);
    case 'block_count_min':
      return (ev.blockCounts[rule.block] ?? 0) >= rule.count;
    case 'block_count_total_min':
      return Object.values(ev.blockCounts).reduce((a, b) => a + b, 0) >= rule.count;
    case 'say_text':
      return ev.saidTexts.some((t) => t.trim().length > 0);
    case 'actor_reach':
      return ev.reachedTargets.includes(rule.targetIndex);
    case 'manual':
      return false; // 自评任务由孩子在任务面板勾选，不参与自动校验
  }
}

/** 校验一组任务，返回每个任务是否通过（manual 任务保留传入状态） */
export function evaluateTasks(
  tasks: { id: string; check: CheckRule }[],
  ev: RunEvidence,
  prev: Record<string, boolean>,
): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const t of tasks) {
    out[t.id] = t.check.type === 'manual' ? (prev[t.id] ?? false) : checkRule(t.check, ev);
  }
  return out;
}

/** 通关条件：所有「必做」任务（不含 ⭐挑战）全部完成 */
export function requiredTasksDone(
  tasks: { id: string; optional?: boolean }[],
  states: Record<string, boolean>,
): boolean {
  return tasks.filter((t) => !t.optional).every((t) => states[t.id]);
}
