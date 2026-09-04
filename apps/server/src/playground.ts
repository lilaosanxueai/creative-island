import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './config.ts';
import type { PlaygroundModel } from '@shared/types.ts';

/** AI 训练场模型存取：仅本机 JSON 文件，特征向量不离开这台电脑 */

const MAX_CLASSES = 3;
const MAX_SAMPLES = 40;

function file(profileId: string): string {
  return path.join(DATA_DIR, 'playground', `${profileId}.json`);
}

export function getPlayground(profileId: string): PlaygroundModel {
  try {
    const m = JSON.parse(fs.readFileSync(file(profileId), 'utf-8')) as PlaygroundModel;
    sanitize(m);
    return m;
  } catch {
    return { classes: [] };
  }
}

export function savePlayground(profileId: string, model: PlaygroundModel): PlaygroundModel {
  const m = sanitize({ ...model, updatedAt: new Date().toISOString() });
  fs.mkdirSync(path.join(DATA_DIR, 'playground'), { recursive: true });
  fs.writeFileSync(file(profileId), JSON.stringify(m), 'utf-8');
  return m;
}

function sanitize(m: PlaygroundModel): PlaygroundModel {
  m.classes = Array.isArray(m.classes) ? m.classes.slice(0, MAX_CLASSES) : [];
  for (const c of m.classes) {
    c.name = String(c.name ?? '').slice(0, 12) || '类别';
    c.emoji = String(c.emoji ?? '').slice(0, 4);
    c.samples = Array.isArray(c.samples)
      ? c.samples.filter((s) => Array.isArray(s) && s.length > 0 && s.length <= 256).slice(0, MAX_SAMPLES)
      : [];
  }
  return m;
}
