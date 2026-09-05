import { describe, expect, it } from 'vitest';
import { guideRespond, newGuideState } from './guideBrain.ts';

describe('引导大脑', () => {
  it('放下第一块积木会开口，且整个会话只说一次', () => {
    const s = newGuideState();
    expect(guideRespond({ type: 'first-block' }, s)).toBeTruthy();
    expect(guideRespond({ type: 'first-block' }, s)).toBeNull();
  });

  it('第一次运行失败走纠错安慰文案，并进入失败计数', () => {
    const s = newGuideState();
    const line = guideRespond({ type: 'first-run', ok: false }, s);
    expect(line).toBeTruthy();
    expect(s.failStreak).toBe(1);
  });

  it('连续失败 3 次后建议换思路', () => {
    const s = newGuideState();
    guideRespond({ type: 'run-error' }, s); // 占用冷却时间戳
    s.lastAt['run-error'] = 0; // 重置冷却以便测试
    guideRespond({ type: 'run-error' }, s);
    s.lastAt['run-error'] = 0;
    const third = guideRespond({ type: 'run-error' }, s);
    expect(s.failStreak).toBe(3);
    expect(third).toContain('拆');
  });

  it('冷却期内保持沉默（不唠叨）', () => {
    const s = newGuideState();
    const t0 = 1_000_000;
    expect(guideRespond({ type: 'idle', seconds: 60 }, s, t0)).toBeTruthy();
    expect(guideRespond({ type: 'idle', seconds: 60 }, s, t0 + 10_000)).toBeNull(); // 90s 内
    expect(guideRespond({ type: 'idle', seconds: 60 }, s, t0 + 100_000)).toBeTruthy();
  });

  it('discovery 事件不归引导大脑管（交给喝彩）', () => {
    expect(guideRespond({ type: 'discovery', label: 'x' }, newGuideState())).toBeNull();
  });
});
