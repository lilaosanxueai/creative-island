import { describe, expect, it } from 'vitest';
import { classify, cosineSim, featuresFromRGBA } from './recognizer.ts';
import type { PlaygroundModel } from '@shared/types.ts';

const vec = (base: number, n = 8): number[] => Array.from({ length: n }, (_, i) => Math.min(1, Math.max(0, base + i * 0.01)));

const model = (counts: number[]): PlaygroundModel => ({
  classes: counts.map((n, i) => ({ name: `c${i}`, emoji: 'x', samples: Array.from({ length: n }, () => vec(i * 0.3)) })),
});

describe('特征提取', () => {
  it('RGBA 转归一化灰度', () => {
    const f = featuresFromRGBA(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]));
    expect(f[0]).toBeCloseTo(1);
    expect(f[1]).toBe(0);
  });
});

describe('余弦相似度', () => {
  it('同向为 1，正交为 0', () => {
    expect(cosineSim([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSim([1, 0], [0, 1])).toBeCloseTo(0);
  });
});

describe('KNN 分类', () => {
  it('样本不足两类时拒绝预测', () => {
    expect(classify(vec(0), model([5, 0, 0]))).toBeNull();
    expect(classify(vec(0), model([5, 2, 0]))).toBeNull(); // 少于 3 个样本的类不算数
  });
  it('新画面归到最像的类别', () => {
    const r = classify(vec(0), model([8, 8, 8]));
    expect(r?.label).toBe(0);
    const r2 = classify(vec(0.6), model([8, 8, 8]));
    expect(r2?.label).toBe(2);
  });
});
