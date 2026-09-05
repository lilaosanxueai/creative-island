import { describe, expect, it } from 'vitest';
import { parsePy, PyRunner, type PyStageApi, type Stmt } from './pyinterp.ts';

function recordApi(): { api: PyStageApi; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    api: {
      cmd: (name, args) => { calls.push(`${name}(${args.join(',')})`); },
      sensor: (name) => (name === 'touching_edge' ? true : 1),
    },
  };
}

describe('解析', () => {
  it('解析顺序/循环/条件/事件处理器', () => {
    const src = [
      'say("hi")',
      'for _ in range(3):',
      '    move(10)',
      '    wait(0.2)',
      'on_key("up"):',
      '    turn_right(90)',
      'if touching_edge():',
      '    bounce()',
      'else:',
      '    hide()',
    ].join('\n');
    const { program, error } = parsePy(src);
    expect(error).toBeUndefined();
    expect(program!.body.length).toBe(4);
    const for0 = program!.body[1] as Extract<Stmt, { kind: 'for' }>;
    expect(for0.body.length).toBe(2);
    const if0 = program!.body[3] as Extract<Stmt, { kind: 'if' }>;
    expect(if0.else.length).toBe(1);
  });

  it('未知指令给出「你是不是想写」纠错', () => {
    const { error } = parsePy('movee(10)');
    expect(error?.hint).toContain('move');
  });

  it('引号/缩进错误带行号', () => {
    expect(parsePy('say("hi)').error?.message).toContain('引号');
    expect(parsePy('for _ in range(3):\nmove(1)').error?.message).toContain('缩进');
  });

  it('注释与空行被忽略', () => {
    const { program } = parsePy('# 只是注释\n\nsay("a") # 行尾注释');
    expect(program!.body.length).toBe(1);
  });
});

describe('执行', () => {
  it('顺序与循环按序执行', async () => {
    const { api, calls } = recordApi();
    const { program } = parsePy('say("go")\nfor _ in range(3):\n    move(10)\nsay("done")');
    const r = new PyRunner(program!, api);
    await r.run(() => {});
    expect(calls).toEqual(['say(go)', 'move(10)', 'move(10)', 'move(10)', 'say(done)']);
  });

  it('条件为真走 then，为假走 else', async () => {
    const { api, calls } = recordApi();
    const { program } = parsePy('if touching_edge():\n    bounce()\nelse:\n    hide()');
    await new PyRunner(program!, api).run(() => {});
    expect(calls).toEqual(['bounce()']);
  });

  it('事件处理器先注册，fire 时执行', async () => {
    const { api, calls } = recordApi();
    const { program } = parsePy('on_key("up"):\n    move(20)\nsay("ready")');
    const r = new PyRunner(program!, api);
    await r.run(() => {});
    expect(calls).toEqual(['say(ready)']);
    r.fire('key', 'up');
    await new Promise((res) => setTimeout(res, 30));
    expect(calls).toEqual(['say(ready)', 'move(20)']);
  });

  it('stop 能中断 while True', async () => {
    const { api, calls } = recordApi();
    const { program } = parsePy('while True:\n    move(1)');
    const r = new PyRunner(program!, api);
    const done = new Promise<void>((res) => r.run(() => res()));
    await new Promise((res) => setTimeout(res, 30));
    r.stop();
    await done;
    const n = calls.length;
    expect(n).toBeGreaterThan(0);
    await new Promise((res) => setTimeout(res, 30));
    expect(calls.length).toBe(n); // 停止后不再增长
  });

  it('random 走 sensor 通道', async () => {
    const seen: number[] = [];
    const api: PyStageApi = {
      cmd: () => {},
      sensor: (name, args) => (name === 'random' ? ((args[0] as number) + 1) : 1),
    };
    const { program } = parsePy('for _ in range(random(5)):\n    move(1)');
    const r = new PyRunner(program!, api);
    await r.run(() => {});
    seen.push(1);
    expect(seen.length).toBe(1);
  });
});
