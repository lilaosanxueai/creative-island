import { describe, expect, it } from 'vitest';
import { parsePy, PyRunner, type PyStageApi } from './pyinterp.ts';

function recordApi(): { api: PyStageApi; calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    api: {
      cmd: (name, args) => { calls.push(`${name}(${args.join(',')})`); },
      sensor: (name, args) => (name === 'random' ? Number(args[0]) + 1 : true),
    },
  };
}

async function run(src: string): Promise<string[]> {
  const { api, calls } = recordApi();
  const { program, error } = parsePy(src);
  expect(error).toBeUndefined();
  await new PyRunner(program!, api).run(() => {});
  return calls;
}

describe('解释器升级：变量与表达式', () => {
  it('变量赋值与算术表达式', async () => {
    const calls = await run('x = 3 + 5 * 2\nsay(x)');
    expect(calls).toEqual(['say(13)']);
  });

  it('括号改变优先级', async () => {
    const calls = await run('x = (3 + 5) * 2\nsay(x)');
    expect(calls).toEqual(['say(16)']);
  });

  it('负号与减法', async () => {
    const calls = await run('x = -5 + 2\ny = 10 - x\nsay(y)');
    expect(calls).toEqual(['say(13)']);
  });

  it('for 循环变量（真 Python 语义 0..n-1）', async () => {
    const calls = await run('for i in range(3):\n    say(i)');
    expect(calls).toEqual(['say(0)', 'say(1)', 'say(2)']);
  });

  it('range 双参 for i in range(2, 5)', async () => {
    const calls = await run('for i in range(2, 5):\n    move(i * 10)');
    expect(calls).toEqual(['move(20)', 'move(30)', 'move(40)']);
  });

  it('比较运算驱动分支', async () => {
    const calls = await run('x = 7\nif x > 5:\n    say("big")\nelse:\n    say("small")');
    expect(calls).toEqual(['say(big)']);
  });

  it('sin/cos 角度制（sin(30)=0.5）', async () => {
    const calls = await run('say(sin(30))\nsay(cos(60))');
    expect(calls).toEqual(['say(0.5)', 'say(0.5)']);
  });

  it('sqrt 勾股定理 3-4-5', async () => {
    const calls = await run('a = 3\nb = 4\nc = sqrt(a * a + b * b)\nsay(c)');
    expect(calls).toEqual(['say(5)']);
  });

  it('除以 0 的儿童友好报错', async () => {
    const { api } = recordApi();
    const { program } = parsePy('say(1 / 0)');
    const r = new PyRunner(program!, api);
    await r.run(() => {});
    expect(r.lastError).toContain('除以 0');
  });

  it('未赋值就使用的报错', async () => {
    const { api } = recordApi();
    const { program } = parsePy('say(x + 1)');
    const r = new PyRunner(program!, api);
    await r.run(() => {});
    expect(r.lastError).toContain('x');
  });

  it('累加器模式：等差数列求和 1+2+...+10', async () => {
    const calls = await run('total = 0\nfor i in range(1, 11):\n    total = total + i\nsay(total)');
    expect(calls).toEqual(['say(55)']);
  });

  it('指数翻倍：2 的 10 次方', async () => {
    const calls = await run('p = 1\nfor i in range(10):\n    p = p * 2\nsay(p)');
    expect(calls).toEqual(['say(1024)']);
  });

  it('字符串拼接', async () => {
    const calls = await run('name = "小明"\nsay(name + "得了 " + 100 + " 分")');
    expect(calls).toEqual(['say(小明得了 100 分)']);
  });
});
