/** 共享类型定义：前后端共用，改这里要同时考虑两端 */

export interface Profile {
  id: string;
  name: string;
  avatar: string; // emoji
  createdAt: string;
}

export type CheckRule =
  | { type: 'block_used'; block: string }
  | { type: 'block_count_min'; block: string; count: number }
  | { type: 'block_count_total_min'; count: number }
  | { type: 'say_text' }
  | { type: 'actor_reach'; targetIndex: number; tolerance?: number }
  | { type: 'manual' };

export interface LessonTask {
  id: string;
  text: string;
  /** 分级提示词（AI 提示模式的参考材料，从方向到搭法） */
  hintPrompts: string[];
  check: CheckRule;
}

export interface StageTarget {
  emoji: string;
  x: number;
  y: number;
}

export interface Lesson {
  id: string;
  island: string;
  order: number;
  title: string;
  emoji: string;
  /** 开场故事，进入课程时展示 */
  story: string;
  goals: string[];
  /** 本课可用的积木类型列表 */
  toolbox: string[];
  starterXml?: string;
  actor: { costume: string; x: number; y: number; dir?: number };
  targets?: StageTarget[];
  tasks: LessonTask[];
  /** 综合创作课：无固定通关校验，任务多为自评 */
  freeplayLesson?: boolean;
  aiIntro: string;
  celebrate: string;
}

export interface TaskState {
  done: boolean;
  doneAt?: string;
}

export interface LessonProgress {
  status: 'in_progress' | 'completed';
  tasks: Record<string, TaskState>;
  completedAt?: string;
}

export interface ProfileProgress {
  profileId: string;
  lessons: Record<string, LessonProgress>;
  /** 每日使用分钟数，键为 YYYY-MM-DD */
  dailyUsage: Record<string, number>;
}

export interface Project {
  id: string;
  profileId: string;
  title: string;
  /** Blockly workspace XML */
  xml: string;
  /** 舞台截图 dataURL */
  thumb: string;
  lessonId?: string;
  /** 保存时的舞台配置，作品墙放映时还原 */
  stage?: { actor: Lesson['actor']; targets?: StageTarget[] };
  createdAt: string;
  updatedAt: string;
}

export type BuddyMode = 'idea' | 'hint' | 'explain' | 'review';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  mode?: BuddyMode;
  ts?: string;
}

/** 客户端发给服务端的对话上下文摘要（积木清单等，省 token 且不含敏感内容） */
export interface ChatContext {
  screen: 'lesson' | 'freeplay';
  lessonTitle?: string;
  lessonGoals?: string[];
  currentTask?: string;
  hintPrompts?: string[];
  blockCounts: Record<string, number>;
  runOk?: boolean;
  lastError?: string;
  projectTitle?: string;
}

export interface BuddySettings {
  name: string;
  emoji: string;
  /** 伙伴性格描述，注入 system prompt */
  persona: string;
}

export interface LimitSettings {
  dailyMinutes: number;
  /** 提示严格度：gentle 只给方向 / normal 给搭法 / direct 差一步的答案 */
  hintStrictness: 'gentle' | 'normal' | 'direct';
}

export interface Settings {
  buddy: BuddySettings;
  limits: LimitSettings;
}

export const DEFAULT_SETTINGS: Settings = {
  buddy: {
    name: '奇点',
    emoji: '🤖',
    persona: '热情、爱提问、把孩子当成一起创造的搭档；语气活泼、多鼓励、不说教，喜欢用表情符号，回复简短适合孩子阅读',
  },
  limits: { dailyMinutes: 40, hintStrictness: 'normal' },
};
