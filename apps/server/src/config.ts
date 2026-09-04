import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const DATA_DIR = path.join(ROOT, 'data');
export const LESSONS_DIR = path.join(ROOT, 'content/lessons');

export interface LlmConfig {
  baseURL: string;
  apiKey: string;
  model: string;
  maxTokens: number;
}

export interface AppConfig {
  llm: LlmConfig;
  server: { host: string; port: number };
  parentPin: string;
}

function defaults(): AppConfig {
  return {
    llm: { baseURL: 'https://open.bigmodel.cn/api/paas/v4', apiKey: '', model: 'glm-4.6', maxTokens: 400 },
    server: { host: '127.0.0.1', port: 8787 },
    parentPin: '1234',
  };
}

/** 首次启动把根目录的 config.example.json 复制为 data/config.json，之后只认 data/config.json */
export function loadConfig(): AppConfig {
  const base = defaults();
  const file = path.join(DATA_DIR, 'config.json');
  if (!fs.existsSync(file)) {
    const example = path.join(ROOT, 'config.example.json');
    if (fs.existsSync(example)) fs.copyFileSync(example, file);
    return base;
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8'));
    return {
      llm: { ...base.llm, ...raw.llm },
      server: { ...base.server, ...raw.server },
      parentPin: typeof raw.parentPin === 'string' && raw.parentPin ? raw.parentPin : base.parentPin,
    };
  } catch (e) {
    console.error('data/config.json 解析失败，使用默认配置：', e);
    return base;
  }
}

export function llmConfigured(cfg: AppConfig): boolean {
  const k = cfg.llm.apiKey.trim();
  return k.length > 0 && !k.includes('在这里填');
}

export function ensureDirs(): void {
  for (const dir of [DATA_DIR, LESSONS_DIR,
    path.join(DATA_DIR, 'progress'), path.join(DATA_DIR, 'projects'), path.join(DATA_DIR, 'chatlogs')]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
