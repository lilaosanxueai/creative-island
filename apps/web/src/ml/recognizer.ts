import type { PlaygroundModel } from '@shared/types.ts';

/**
 * AI 训练场识别器：纯前端图像识别（零依赖、零下载、画面不离开浏览器）。
 * 原理 = Teachable Machine v1 同款思路：把画面压成特征向量，用 KNN 最近邻投票分类。
 * 教学价值：AI 是从例子里「学」出来的；样本越多越准；它也可能出错——所以要验证。
 */

export const GRID_W = 16;
export const GRID_H = 12;
export const MAX_SAMPLES_PER_CLASS = 40;

/** ImageData(RGBA) → 归一化灰度特征向量（纯函数，可单测） */
export function featuresFromRGBA(data: Uint8ClampedArray): number[] {
  const v = new Array<number>(data.length / 4);
  for (let i = 0; i < v.length; i++) {
    const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
    v[i] = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }
  return v;
}

export function cosineSim(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / Math.sqrt(na * nb);
}

/** KNN 投票分类。返回胜出类别索引与置信度；训练不足（<2 个类别有样本）时返回 null */
export function classify(features: number[], model: PlaygroundModel, k = 5): { label: number; conf: number } | null {
  const sims: { label: number; sim: number }[] = [];
  model.classes.forEach((c, ci) => {
    for (const s of c.samples) sims.push({ label: ci, sim: cosineSim(features, s) });
  });
  const classesWithData = model.classes.filter((c) => c.samples.length >= 3);
  if (classesWithData.length < 2) return null;
  sims.sort((x, y) => y.sim - x.sim);
  const top = sims.slice(0, k);
  const votes = new Array<number>(model.classes.length).fill(0);
  for (const t of top) votes[t.label]++;
  let label = 0;
  for (let i = 1; i < votes.length; i++) if (votes[i] > votes[label]) label = i;
  return { label, conf: votes[label] / top.length };
}

/** 把任意画面源（video/canvas）压成特征向量 */
export function extractFeatures(source: CanvasImageSource): number[] {
  const cv = document.createElement('canvas');
  cv.width = GRID_W;
  cv.height = GRID_H;
  const ctx = cv.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0, GRID_W, GRID_H);
  return featuresFromRGBA(ctx.getImageData(0, 0, GRID_W, GRID_H).data);
}

/** 摄像头 + 模型状态的单例（工作台与训练场共用一路视频流） */
class Recognizer {
  model: PlaygroundModel = { classes: [] };
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;

  resetModel(): void {
    this.model = { classes: [0, 1, 2].map((i) => ({ name: `类别 ${i + 1}`, emoji: `${i + 1}\uFE0F\u20E3`, samples: [] })) };
  }

  ensureModel(): void {
    if (this.model.classes.length !== 3) this.resetModel();
  }

  hasModel(): boolean {
    this.ensureModel();
    return this.model.classes.filter((c) => c.samples.length >= 3).length >= 2;
  }

  async ensureCamera(video: HTMLVideoElement): Promise<void> {
    if (this.stream && this.video === video && video.srcObject) return;
    this.stopCamera();
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 320, height: 240, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = this.stream;
    this.video = video;
    await video.play().catch(() => { /* autoplay 拒绝时静默，画面仍会渲染 */ });
  }

  stopCamera(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
    this.video = null;
  }

  get cameraOn(): boolean { return !!this.stream; }

  capture(classIdx: number): number {
    this.ensureModel();
    if (!this.video || this.video.readyState < 2) return this.model.classes[classIdx]?.samples.length ?? 0;
    const f = extractFeatures(this.video);
    const c = this.model.classes[classIdx];
    if (c.samples.length < MAX_SAMPLES_PER_CLASS) c.samples.push(f);
    return c.samples.length;
  }

  clearClass(classIdx: number): void {
    this.ensureModel();
    this.model.classes[classIdx].samples = [];
  }

  /** 从当前画面预测（要求摄像头已开） */
  predict(): { label: number; conf: number } | null {
    if (!this.video || this.video.readyState < 2) return null;
    return classify(extractFeatures(this.video), this.model);
  }

  /** 每类样本与当前画面的最大相似度（测试区的置信条用） */
  similarityByClass(): number[] {
    this.ensureModel();
    if (!this.video || this.video.readyState < 2) return [0, 0, 0];
    const f = extractFeatures(this.video);
    return this.model.classes.map((c) =>
      c.samples.length ? Math.max(...c.samples.slice(-15).map((s) => cosineSim(f, s))) : 0,
    );
  }

  loadModel(m: PlaygroundModel): void {
    this.model = m;
    this.ensureModel();
    // 样本数/长度兜底
    for (const c of this.model.classes) {
      c.samples = c.samples.filter((s) => Array.isArray(s) && s.length > 0).slice(0, MAX_SAMPLES_PER_CLASS);
    }
  }
}

export const recognizer = new Recognizer();
