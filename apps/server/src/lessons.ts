import fs from 'node:fs';
import path from 'node:path';
import { LESSONS_DIR } from './config.ts';
import type { Lesson } from '@shared/types.ts';

/** 每次请求都重读 content/lessons，家长改 JSON 立即生效，不用重启 */

export function loadLessons(): Lesson[] {
  const lessons: Lesson[] = [];
  for (const f of fs.readdirSync(LESSONS_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      lessons.push(JSON.parse(fs.readFileSync(path.join(LESSONS_DIR, f), 'utf-8')) as Lesson);
    } catch (e) {
      console.error(`课程文件 ${f} 解析失败，已跳过：`, e);
    }
  }
  return lessons.sort((a, b) => a.order - b.order);
}

export function findLesson(id: string): Lesson | undefined {
  return loadLessons().find((l) => l.id === id);
}
