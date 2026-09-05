import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';
import type { StageState } from './stageState.ts';
import { sleep, yieldNow } from './stageState.ts';

/**
 * 把工作区里的帽子积木编译成 async JS 并在受控环境执行。
 * __guard 在每个循环迭代让出事件循环：孩子的死循环不会卡死页面，⏹ 随时可停。
 */

export type HatTrigger =
  | { type: 'run' }
  | { type: 'key'; key: string }
  | { type: 'click' }
  | { type: 'recognized'; label: string };

const STOP = Symbol('island-stop');

export class Executor {
  private token = 0;
  private _running = false;

  /** 最近一次运行错误（喂给 AI 伙伴做上下文），每次 run 前清空 */
  lastError: string | null = null;

  constructor(private ws: Blockly.Workspace, private stage: StageState) {}

  get running(): boolean { return this._running; }

  stop(): void {
    this.token++;
    this._running = false;
  }

  /** 触发一类帽子积木（▶开始 / 某按键 / 角色被点击），等它们全部执行完 */
  async trigger(trigger: HatTrigger): Promise<void> {
    const myToken = ++this.token;
    this._running = true;
    const guard = async () => {
      if (myToken !== this.token) throw STOP;
      await yieldNow(); // MessageChannel 让渡不受后台节流，⏹ 始终即时
    };
    const code = this.hatBlocks(trigger)
      .map((hat) => {
        // 帽子积木的后续在 nextConnection 上（island_when_* 均为 nextStatement）
        const first = hat.getNextBlock() ?? hat.getInputTargetBlock('STACK');
        return first ? javascriptGenerator.blockToCode(first) : '';
      })
      .join('\n');

    if (code.trim()) {
      try {
        const fn = new Function('api', '__guard', `return (async () => {\n${code}\n})();`) as
          (api: unknown, guard: () => Promise<void>) => Promise<void>;
        await fn(this.stage.api, guard);
      } catch (e) {
        if (e !== STOP) {
          console.warn('程序运行出错：', e);
          this.lastError = e instanceof Error ? e.message : String(e);
        }
      }
    }
    if (myToken === this.token) this._running = false;
  }

  /** ▶ 按钮：跑完主程序后回调（⏹ 中途停止也会走到回调，用于收集运行证据） */
  async run(onComplete: () => void): Promise<void> {
    this.lastError = null;
    await this.trigger({ type: 'run' });
    onComplete();
  }

  private hatBlocks(trigger: HatTrigger): Blockly.Block[] {
    return this.ws.getTopBlocks(false).filter((b) => {
      if (trigger.type === 'key') return b.type === 'island_when_key' && b.getFieldValue('KEY') === trigger.key;
      if (trigger.type === 'click') return b.type === 'island_when_clicked';
      if (trigger.type === 'recognized') return b.type === 'island_when_recognized' && b.getFieldValue('CLASS') === trigger.label;
      return b.type === 'island_when_run';
    });
  }
}
