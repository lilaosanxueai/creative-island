import type { Lesson, StageTarget } from '@shared/types.ts';
import { playSound } from './sounds.ts';

/** 舞台坐标系：480×360，中心为原点，x 向右 y 向上（模仿 Scratch，方便以后迁移） */
export const STAGE_W = 480;
export const STAGE_H = 360;
const BOUND_X = STAGE_W / 2 - 20;
const BOUND_Y = STAGE_H / 2 - 20;

export interface StageTargetState extends StageTarget { reached: boolean }

/** 小剧场状态机：角色状态 + 命令 API + 运行证据（供关卡校验） */
export class StageState {
  x = 0;
  y = 0;
  dir = 90; // 度，0 朝上，90 朝右
  size = 100; // 百分比
  costume = '🤖';
  visible = true;
  bubble: { text: string; until: number } | null = null;
  targets: StageTargetState[] = [];
  keysHeld = new Set<string>();

  /** 运行证据（跨多次运行累积，通关校验用） */
  saidTexts: string[] = [];

  reset(actor: Lesson['actor'], targets?: StageTarget[]): void {
    this.x = actor.x; this.y = actor.y;
    this.dir = actor.dir ?? 90;
    this.size = 100; this.costume = actor.costume;
    this.visible = true; this.bubble = null;
    this.targets = (targets ?? []).map((t) => ({ ...t, reached: false }));
    this.saidTexts = [];
    this.keysHeld.clear();
  }

  private reachCheck(): void {
    for (const [i, t] of this.targets.entries()) {
      if (!t.reached && Math.hypot(this.x - t.x, this.y - t.y) <= 45) {
        t.reached = true;
        playSound('ding');
        void i; // 索引在证据读取时使用
      }
    }
  }

  reachedTargetIndices(): number[] {
    return this.targets.flatMap((t, i) => (t.reached ? [i] : []));
  }

  /** 生成器调用的命令集（在执行器里以 api 名字注入） */
  readonly api = {
    move: async (steps: number) => {
      const rad = (this.dir * Math.PI) / 180;
      this.x = clamp(this.x + steps * Math.sin(rad), -BOUND_X, BOUND_X);
      this.y = clamp(this.y + steps * Math.cos(rad), -BOUND_Y, BOUND_Y);
      this.reachCheck();
      await sleep(60);
    },
    turnRight: async (deg: number) => { this.dir = norm(this.dir + deg); await sleep(60); },
    turnLeft: async (deg: number) => { this.dir = norm(this.dir - deg); await sleep(60); },
    goTo: async (x: number, y: number) => {
      this.x = clamp(x, -BOUND_X, BOUND_X);
      this.y = clamp(y, -BOUND_Y, BOUND_Y);
      this.reachCheck();
      await sleep(60);
    },
    bounce: async () => {
      const hitX = Math.abs(this.x) >= BOUND_X - 1;
      const hitY = Math.abs(this.y) >= BOUND_Y - 1;
      if (hitX) this.dir = norm(-this.dir);
      if (hitY) this.dir = norm(180 - this.dir);
      await sleep(40);
    },
    say: async (text: string) => {
      if (text) this.saidTexts.push(text);
      this.bubble = { text, until: performance.now() + 2600 };
      await sleep(200);
    },
    sayFor: async (text: string, secs: number) => {
      if (text) this.saidTexts.push(text);
      this.bubble = { text, until: performance.now() + secs * 1000 };
      await sleep(secs * 1000);
      this.bubble = null;
    },
    costume: async (c: string) => { this.costume = c; await sleep(60); },
    changeSize: async (n: number) => { this.size = clamp(this.size + n, 10, 400); await sleep(40); },
    show: async () => { this.visible = true; await sleep(40); },
    hide: async () => { this.visible = false; this.bubble = null; await sleep(40); },
    play: async (name: string) => { playSound(name); await sleep(220); },
    wait: async (secs: number) => { await sleep(Math.max(0.1, secs) * 1000); },
    touchingEdge: (): boolean => Math.abs(this.x) >= BOUND_X - 15 || Math.abs(this.y) >= BOUND_Y - 15,
    keyDown: (key: string): boolean => this.keysHeld.has(key),
    random: (from: number, to: number): number => {
      const lo = Math.min(from, to), hi = Math.max(from, to);
      return Math.floor(Math.random() * (hi - lo + 1)) + lo;
    },
  };
}

function clamp(v: number, lo: number, hi: number): number { return Math.min(hi, Math.max(lo, v)); }
function norm(deg: number): number { return ((deg % 360) + 360) % 360; }
export function sleep(ms: number): Promise<void> { return new Promise((r) => setTimeout(r, ms)); }
