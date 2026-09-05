import type { PyStageApi } from './pyinterp.ts';
import type { StageState } from './stageState.ts';

/** 舞台命令的 Python 名 → StageState api 方法桥 */
const CMD_MAP: Record<string, (stage: StageState, args: (number | string | boolean)[]) => Promise<void> | void> = {
  move: (s, a) => s.api.move(Number(a[0])),
  turn_right: (s, a) => s.api.turnRight(Number(a[0])),
  turn_left: (s, a) => s.api.turnLeft(Number(a[0])),
  go_to: (s, a) => s.api.goTo(Number(a[0]), Number(a[1])),
  bounce: (s) => s.api.bounce(),
  say: (s, a) => s.api.say(String(a[0] ?? '')),
  say_for: (s, a) => s.api.sayFor(String(a[0] ?? ''), Number(a[1])),
  costume: (s, a) => s.api.costume(String(a[0])),
  change_size: (s, a) => s.api.changeSize(Number(a[0])),
  show: (s) => s.api.show(),
  hide: (s) => s.api.hide(),
  play: (s, a) => s.api.play(String(a[0])),
  wait: (s, a) => s.api.wait(Number(a[0])),
};

export function pyStageApi(stage: StageState): PyStageApi {
  return {
    cmd: (name, args) => {
      const fn = CMD_MAP[name];
      if (!fn) return; // 解析期已挡住未知指令，运行期宽容
      return fn(stage, args);
    },
    sensor: (name, args) => {
      switch (name) {
        case 'touching_edge': return stage.api.touchingEdge();
        case 'key_down': return stage.api.keyDown(String(args[0]));
        case 'recognize': return stage.api.recognize(String(args[0]));
        case 'random': return stage.api.random(Number(args[0]), Number(args[1]));
        default: return false;
      }
    },
  };
}
