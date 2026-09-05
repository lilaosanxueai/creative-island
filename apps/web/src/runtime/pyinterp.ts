/**
 * 迷你 Python 解释器：真 Python 语法的极小子集，专为我们的舞台命令集设计。
 * 支持：函数调用、for _ in range(n)、while True/if-else、on_key/on_click/on_recognize 事件处理器、
 *       数字/字符串/True/False/random()/传感器调用、# 注释、缩进块。
 * 零依赖零下载——这是「积木 → 代码」过渡的安全桥。
 */

export interface PyError {
  line: number;
  message: string;
  hint?: string;
}

export type Expr =
  | { kind: 'num'; value: number }
  | { kind: 'str'; value: string }
  | { kind: 'bool'; value: boolean }
  | { kind: 'call'; name: string; args: Expr[] };

export type Stmt =
  | { kind: 'call'; line: number; name: string; args: Expr[] }
  | { kind: 'if'; line: number; cond: Expr; then: Stmt[]; else: Stmt[] }
  | { kind: 'for'; line: number; count: Expr; body: Stmt[] }
  | { kind: 'while'; line: number; cond: Expr; body: Stmt[] }
  | { kind: 'handler'; line: number; event: 'key' | 'click' | 'recognize'; arg?: string; body: Stmt[] };

export interface Program {
  body: Stmt[];
}

// ---------------- 词法 + 解析 ----------------

interface Line { no: number; indent: number; text: string }

function toLines(src: string): Line[] {
  const out: Line[] = [];
  src.split('\n').forEach((raw, i) => {
    const noComment = raw.replace(/#.*$/, '');
    if (!noComment.trim()) return;
    const indent = noComment.match(/^ */)![0].length;
    out.push({ no: i + 1, indent, text: noComment.trim() });
  });
  return out;
}

const KNOWN = new Set([
  'move', 'turn_right', 'turn_left', 'go_to', 'bounce', 'say', 'say_for', 'costume',
  'change_size', 'show', 'hide', 'play', 'wait',
  'touching_edge', 'key_down', 'recognize', 'random',
  'range', 'on_key', 'on_click', 'on_recognize', 'print', 'eq',
]);

/** 拼写纠错建议 */
export function didYouMean(name: string): string | undefined {
  let best: string | undefined;
  let bestDist = 3;
  for (const k of KNOWN) {
    const d = levenshtein(name, k);
    if (d < bestDist) { bestDist = d; best = k; }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

class Parser {
  private i = 0;
  constructor(private lines: Line[]) {}

  private peek(): Line | undefined { return this.lines[this.i]; }
  private next(): Line | undefined { return this.lines[this.i++]; }

  parseBlock(indent: number): Stmt[] {
    const stmts: Stmt[] = [];
    while (this.peek() && this.peek()!.indent >= indent) {
      if (this.peek()!.indent > indent) {
        throw { line: this.peek()!.no, message: '这一行缩进太多了，检查一下空格对不对齐' } as PyError;
      }
      stmts.push(this.parseStmt());
    }
    return stmts;
  }

  parseStmt(): Stmt {
    const line = this.next()!;
    const t = line.text;

    // 事件处理器：on_key("up"): / on_click(): / on_recognize("0"):
    let m = t.match(/^on_key\s*\(\s*("[^"]*")\s*\)\s*:$/);
    if (m) return { kind: 'handler', line: line.no, event: 'key', arg: JSON.parse(m[1]), body: this.parseChild(line) };
    if (/^on_click\s*\(\s*\)\s*:$/.test(t)) return { kind: 'handler', line: line.no, event: 'click', body: this.parseChild(line) };
    m = t.match(/^on_recognize\s*\(\s*("[^"]*")\s*\):$/);
    if (m) return { kind: 'handler', line: line.no, event: 'recognize', arg: JSON.parse(m[1]), body: this.parseChild(line) };

    // for _ in range(n):
    m = t.match(/^for\s+\w+\s+in\s+range\s*\((.*)\)\s*:$/);
    if (m) return { kind: 'for', line: line.no, count: this.parseExpr(m[1], line.no), body: this.parseChild(line) };

    // while True: / while 条件:
    m = t.match(/^while\s+(.+)\s*:$/);
    if (m) return { kind: 'while', line: line.no, cond: this.parseExpr(m[1], line.no), body: this.parseChild(line) };

    // if 条件: / else:
    m = t.match(/^if\s+(.+)\s*:$/);
    if (m) {
      const then = this.parseChild(line);
      let elseBody: Stmt[] = [];
      const nxt = this.peek();
      if (nxt && nxt.indent === line.indent && /^else\s*:$/.test(nxt.text)) {
        this.next();
        elseBody = this.parseChild(line);
      }
      return { kind: 'if', line: line.no, cond: this.parseExpr(m[1], line.no), then, else: elseBody };
    }
    if (/^else\s*:?$/.test(t)) {
      throw { line: line.no, message: 'else 需要跟在 if 的后面，而且要对齐 if 的缩进' } as PyError;
    }

    // 普通调用语句
    if (/^\w+\s*\(.*\)$/.test(t)) {
      const call = this.parseExpr(t, line.no);
      if (call.kind !== 'call') throw { line: line.no, message: '这一行要是一个指令（比如 move(100)）' } as PyError;
      return { kind: 'call', line: line.no, name: call.name, args: call.args };
    }

    throw { line: line.no, message: `我看不懂这一行：${t.slice(0, 30)}`, hint: '指令长这样：move(100)、say("你好")、wait(1)' } as PyError;
  }

  private parseChild(parent: Line): Stmt[] {
    const nxt = this.peek();
    if (!nxt || nxt.indent <= parent.indent) {
      throw { line: parent.no, message: '这一行下面少了缩进的代码块（先用 4 个空格缩进，再写要做的事）' } as PyError;
    }
    return this.parseBlock(nxt.indent);
  }

  /** 解析一个表达式（或逗号分隔的多个，返回第一个；内部用于参数列表） */
  private parseExpr(src: string, line: number): Expr {
    const parts = splitArgs(src, line);
    const one = this.parseSingle(parts[0] ?? 'True', line);
    return one;
  }

  parseArgs(src: string, line: number): Expr[] {
    return splitArgs(src, line).map((p) => this.parseSingle(p, line));
  }

  private parseSingle(t: string, line: number): Expr {
    t = t.trim();
    if (t === '') throw { line, message: '括号里少了一个内容（比如 move(  ) 里要有数字）' } as PyError;
    if (/^-?\d+(\.\d+)?$/.test(t)) return { kind: 'num', value: Number(t) };
    if (/^"[^"]*"$/.test(t)) return { kind: 'str', value: JSON.parse(t) };
    if (t === 'True') return { kind: 'bool', value: true };
    if (t === 'False') return { kind: 'bool', value: false };
    const m = t.match(/^(\w+)\s*\((.*)\)$/);
    if (m) {
      const name = m[1];
      if (!KNOWN.has(name)) {
        throw { line, message: `我不认识 ${name} 这个指令`, hint: didYouMean(name) ? `你是不是想写 ${didYouMean(name)}？` : undefined } as PyError;
      }
      return { kind: 'call', name, args: this.parseArgs(m[2], line) };
    }
    throw { line, message: `看不懂这部分：${t.slice(0, 20)}`, hint: '数字、"文字"、True/False 或 random(1, 10) 这样写' } as PyError;
  }
}

function splitArgs(src: string, line: number): string[] {
  const parts: string[] = [];
  let depth = 0, inStr = false, cur = '';
  for (const ch of src) {
    if (ch === '"') inStr = !inStr;
    if (!inStr) {
      if (ch === '(' || ch === '[') depth++;
      if (ch === ')' || ch === ']') depth--;
      if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    }
    cur += ch;
  }
  if (inStr) throw { line, message: '有个引号没关上（文字两边各一个 " 哦）' } as PyError;
  if (depth !== 0) throw { line, message: '括号没有配对，数一下 ( 和 ) 的数量' } as PyError;
  if (cur.trim()) parts.push(cur);
  return parts;
}

export function parsePy(src: string): { program?: Program; error?: PyError } {
  try {
    const lines = toLines(src);
    if (lines.length === 0) return { program: { body: [] } };
    const parser = new Parser(lines);
    return { program: { body: parser.parseBlock(lines[0].indent) } };
  } catch (e) {
    return { error: e as PyError };
  }
}

// ---------------- 执行 ----------------

export interface PyStageApi {
  cmd(name: string, args: (number | string | boolean)[]): Promise<void> | void;
  sensor(name: string, args: (number | string | boolean)[]): boolean | number;
}

const SENSORS = new Set(['touching_edge', 'key_down', 'recognize', 'random', 'eq']);

export class PyRunner {
  private token = 0;
  running = false;
  lastError: string | null = null;
  private handlers: { key: Record<string, Stmt[]>; click: Stmt[][]; recognize: Record<string, Stmt[]> } = { key: {}, click: [], recognize: {} };

  constructor(private ast: Program, private api: PyStageApi) {}

  stop(): void { this.token++; this.running = false; }

  /** 执行主程序；完成后回调。事件处理器在 fire() 里触发 */
  async run(onComplete: () => void): Promise<void> {
    const my = ++this.token;
    this.running = true;
    this.lastError = null;
    try {
      await this.execBlock(this.ast.body, my);
    } catch (e) {
      if (!this.isStop(e)) {
        this.lastError = e instanceof Error ? e.message : String(e);
      }
    }
    if (my === this.token) this.running = false;
    onComplete();
  }

  fire(kind: 'key' | 'click' | 'recognize', arg?: string): void {
    const body =
      kind === 'key' ? this.handlers.key[arg ?? '']
        : kind === 'click' ? this.handlers.click.flat()
          : this.handlers.recognize[arg ?? ''];
    if (!body || body.length === 0) return;
    const my = ++this.token;
    this.running = true;
    void this.execBlock(body, my)
      .catch((e) => { if (!this.isStop(e)) this.lastError = e instanceof Error ? e.message : String(e); })
      .finally(() => { if (my === this.token) this.running = false; });
  }

  private isStop(e: unknown): boolean { return typeof e === 'object' && e !== null && (e as { stop?: boolean }).stop === true; }

  private async guard(my: number): Promise<void> {
    if (my !== this.token) throw { stop: true };
    await new Promise<void>((r) => setTimeout(r, 0)); // 让出事件循环，⏹ 才能生效
  }

  private async execBlock(stmts: Stmt[], my: number): Promise<void> {
    for (const st of stmts) {
      await this.guard(my);
      switch (st.kind) {
        case 'handler':
          if (st.event === 'key') this.handlers.key[st.arg ?? ''] = st.body;
          else if (st.event === 'click') this.handlers.click.push(st.body);
          else this.handlers.recognize[st.arg ?? ''] = st.body;
          break;
        case 'call':
          await this.api.cmd(st.name, await this.evalArgs(st.args, my));
          break;
        case 'if': {
          const c = await this.evalExpr(st.cond, my);
          await this.execBlock(c ? st.then : st.else, my);
          break;
        }
        case 'for': {
          const n = await this.evalExpr(st.count, my);
          for (let i = 0; i < Math.min(200, Number(n) || 0); i++) {
            await this.guard(my);
            await this.execBlock(st.body, my);
          }
          break;
        }
        case 'while': {
          for (;;) {
            await this.guard(my);
            const c = await this.evalExpr(st.cond, my);
            if (!c) break;
            await this.execBlock(st.body, my);
          }
          break;
        }
      }
    }
  }

  private async evalArgs(args: Expr[], my: number): Promise<(number | string | boolean)[]> {
    const out: (number | string | boolean)[] = [];
    for (const a of args) out.push(await this.evalExpr(a, my));
    return out;
  }

  private async evalExpr(e: Expr, my: number): Promise<number | string | boolean> {
    switch (e.kind) {
      case 'num': return e.value;
      case 'str': return e.value;
      case 'bool': return e.value;
      case 'call': {
        if (e.name === 'range') {
          const n = await this.evalExpr(e.args[0], my);
          return Number(n) || 0;
        }
        if (SENSORS.has(e.name)) {
          return this.api.sensor(e.name, await this.evalArgs(e.args, my));
        }
        // 命令当表达式用（不该发生，宽容处理）
        return false;
      }
    }
  }
}
