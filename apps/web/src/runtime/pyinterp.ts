/**
 * 迷你 Python 解释器：真 Python 语法的极小子集，专为舞台命令集 + 数学课程设计。
 * 支持：变量与赋值、算术表达式（+ - * / 括号 负号）、比较（== != > < >= <=）、
 *       for 变量循环（range 单参/双参，真 Python 语义 0..n-1）、while、if-else、
 *       on_key/on_click/on_recognize 事件处理器、数学函数 sin/cos/sqrt/abs（角度制三角）、
 *       pi 常量、数字/字符串/True/False、# 注释、缩进块。
 * 零依赖零下载——支撑从小学数轴到高中三角函数的全部数学可视化。
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
  | { kind: 'var'; name: string }
  | { kind: 'call'; name: string; args: Expr[] }
  | { kind: 'bin'; op: '+' | '-' | '*' | '/' | '==' | '!=' | '>' | '<' | '>=' | '<='; l: Expr; r: Expr }
  | { kind: 'neg'; e: Expr };

export type Stmt =
  | { kind: 'call'; line: number; name: string; args: Expr[] }
  | { kind: 'assign'; line: number; name: string; value: Expr }
  | { kind: 'if'; line: number; cond: Expr; then: Stmt[]; else: Stmt[] }
  | { kind: 'for'; line: number; varName: string | null; range: Expr[]; body: Stmt[] }
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

const COMMANDS = new Set([
  'move', 'turn_right', 'turn_left', 'go_to', 'bounce', 'say', 'say_for', 'costume',
  'change_size', 'show', 'hide', 'play', 'wait',
]);
const FUNCS = new Set(['touching_edge', 'key_down', 'recognize', 'random', 'range', 'sin', 'cos', 'sqrt', 'abs', 'eq', 'print']);

/** 拼写纠错建议 */
export function didYouMean(name: string): string | undefined {
  let best: string | undefined;
  let bestDist = 3;
  for (const k of [...COMMANDS, ...FUNCS, 'on_key', 'on_click', 'on_recognize']) {
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

/** 表达式分词：数字、名字、字符串、运算符 */
interface Tok { t: 'num' | 'name' | 'str' | 'op'; v: string }

function tokenizeExpr(src: string, line: number): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ') { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      toks.push({ t: 'num', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_]/.test(src[j])) j++;
      toks.push({ t: 'name', v: src.slice(i, j) });
      i = j;
      continue;
    }
    if (ch === '"') {
      const end = src.indexOf('"', i + 1);
      if (end < 0) throw { line, message: '有个引号没关上（文字两边各一个 " 哦）' } as PyError;
      toks.push({ t: 'str', v: src.slice(i + 1, end) });
      i = end + 1;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (['==', '!=', '>=', '<='].includes(two)) { toks.push({ t: 'op', v: two }); i += 2; continue; }
    if ('+-*/()<>=,'.includes(ch)) { toks.push({ t: 'op', v: ch }); i++; continue; }
    throw { line, message: `看不懂这个符号：${ch}` } as PyError;
  }
  return toks;
}

/** 递归下降表达式解析 */
class ExprParser {
  pos = 0;
  constructor(private toks: Tok[], private line: number, private knownName: (n: string) => boolean) {}

  private peek(): Tok | undefined { return this.toks[this.pos]; }
  private next(): Tok | undefined { return this.toks[this.pos++]; }
  private expectOp(op: string): void {
    const t = this.next();
    if (!t || t.t !== 'op' || t.v !== op) throw { line: this.line, message: `这里少了一个 ${op}` } as PyError;
  }

  parse(): Expr {
    const e = this.compare();
    if (this.pos < this.toks.length) {
      throw { line: this.line, message: `表达式后面多了一段：${this.toks.slice(this.pos).map((t) => t.v).join(' ')}` } as PyError;
    }
    return e;
  }

  private compare(): Expr {
    let l = this.add();
    while (this.peek()?.t === 'op' && ['==', '!=', '>', '<', '>=', '<='].includes(this.peek()!.v)) {
      const op = this.next()!.v as Extract<Expr, { kind: 'bin' }>['op'];
      l = { kind: 'bin', op, l, r: this.add() };
    }
    return l;
  }

  private add(): Expr {
    let l = this.mul();
    while (this.peek()?.t === 'op' && (this.peek()!.v === '+' || this.peek()!.v === '-')) {
      const op = this.next()!.v as '+' | '-';
      l = { kind: 'bin', op, l, r: this.mul() };
    }
    return l;
  }

  private mul(): Expr {
    let l = this.unary();
    while (this.peek()?.t === 'op' && (this.peek()!.v === '*' || this.peek()!.v === '/')) {
      const op = this.next()!.v as '*' | '/';
      l = { kind: 'bin', op, l, r: this.unary() };
    }
    return l;
  }

  private unary(): Expr {
    if (this.peek()?.t === 'op' && this.peek()!.v === '-') {
      this.next();
      return { kind: 'neg', e: this.unary() };
    }
    return this.atom();
  }

  private atom(): Expr {
    const t = this.next();
    if (!t) throw { line: this.line, message: '表达式在这里断了，检查是不是少了内容' } as PyError;
    if (t.t === 'num') return { kind: 'num', value: Number(t.v) };
    if (t.t === 'str') return { kind: 'str', value: t.v };
    if (t.t === 'name') {
      if (t.v === 'True') return { kind: 'bool', value: true };
      if (t.v === 'False') return { kind: 'bool', value: false };
      if (this.peek()?.t === 'op' && this.peek()!.v === '(') {
        this.next();
        if (!this.knownName(t.v)) {
          throw { line: this.line, message: `我不认识 ${t.v} 这个指令`, hint: didYouMean(t.v) ? `你是不是想写 ${didYouMean(t.v)}？` : undefined } as PyError;
        }
        const args: Expr[] = [];
        if (!(this.peek()?.t === 'op' && this.peek()!.v === ')')) {
          args.push(this.compare());
          while (this.peek()?.t === 'op' && this.peek()!.v === ',') {
            this.next();
            args.push(this.compare());
          }
        }
        this.expectOp(')');
        return { kind: 'call', name: t.v, args };
      }
      return { kind: 'var', name: t.v };
    }
    if (t.t === 'op' && t.v === '(') {
      const e = this.compare();
      this.expectOp(')');
      return e;
    }
    throw { line: this.line, message: `看不懂这部分：${t.v}` } as PyError;
  }
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
    const known = (n: string) => COMMANDS.has(n) || FUNCS.has(n);
    const exprOf = (src: string): Expr => new ExprParser(tokenizeExpr(src, line.no), line.no, known).parse();

    // 事件处理器
    let m = t.match(/^on_key\s*\(\s*("[^"]*")\s*\)\s*:$/);
    if (m) return { kind: 'handler', line: line.no, event: 'key', arg: JSON.parse(m[1]), body: this.parseChild(line) };
    if (/^on_click\s*\(\s*\)\s*:$/.test(t)) return { kind: 'handler', line: line.no, event: 'click', body: this.parseChild(line) };
    m = t.match(/^on_recognize\s*\(\s*("[^"]*")\s*\):$/);
    if (m) return { kind: 'handler', line: line.no, event: 'recognize', arg: JSON.parse(m[1]), body: this.parseChild(line) };

    // for 变量 in range(...):
    m = t.match(/^for\s+([A-Za-z_]\w*)\s+in\s+range\s*\((.*)\)\s*:$/);
    if (m) {
      // range 参数：单参或 a, b（逗号顶层分割）
      const args = splitTopComma(m[2]).map((p) => exprOf(p));
      return { kind: 'for', line: line.no, varName: m[1], range: args, body: this.parseChild(line) };
    }

    // while 条件:
    m = t.match(/^while\s+(.+)\s*:$/);
    if (m) return { kind: 'while', line: line.no, cond: exprOf(m[1]), body: this.parseChild(line) };

    // if / else
    m = t.match(/^if\s+(.+)\s*:$/);
    if (m) {
      const then = this.parseChild(line);
      let elseBody: Stmt[] = [];
      const nxt = this.peek();
      if (nxt && nxt.indent === line.indent && /^else\s*:$/.test(nxt.text)) {
        this.next();
        elseBody = this.parseChild(line);
      }
      return { kind: 'if', line: line.no, cond: exprOf(m[1]), then, else: elseBody };
    }
    if (/^else\s*:$/.test(t)) {
      throw { line: line.no, message: 'else 需要跟在 if 的后面，而且要对齐 if 的缩进' } as PyError;
    }

    // 赋值：x = 表达式（== 是比较不算赋值）
    m = t.match(/^([A-Za-z_]\w*)\s*=(?!=)\s*(.+)$/);
    if (m) return { kind: 'assign', line: line.no, name: m[1], value: exprOf(m[2]) };

    // 调用语句（只能是可以「做」的命令）
    if (/^[A-Za-z_]\w*\s*\(/.test(t)) {
      const e = exprOf(t);
      if (e.kind !== 'call') throw { line: line.no, message: '这一行要是一个指令（比如 move(100)）' } as PyError;
      if (!COMMANDS.has(e.name)) {
        throw {
          line: line.no,
          message: `${e.name} 是用来「算」的，不是用来「做」的——把它放进别的指令的括号里试试`,
          hint: didYouMean(e.name) ? `你是不是想写 ${didYouMean(e.name)}？` : undefined,
        } as PyError;
      }
      return { kind: 'call', line: line.no, name: e.name, args: e.args };
    }

    throw { line: line.no, message: `我看不懂这一行：${t.slice(0, 30)}`, hint: '指令长这样：move(100)、say("你好")、x = 3 + 5' } as PyError;
  }

  private parseChild(parent: Line): Stmt[] {
    const nxt = this.peek();
    if (!nxt || nxt.indent <= parent.indent) {
      throw { line: parent.no, message: '这一行下面少了缩进的代码块（先用 4 个空格缩进，再写要做的事）' } as PyError;
    }
    return this.parseBlock(nxt.indent);
  }
}

/** 顶层逗号分割（忽略括号内逗号） */
function splitTopComma(src: string): string[] {
  const parts: string[] = [];
  let depth = 0, cur = '';
  for (const ch of src) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; continue; }
    cur += ch;
  }
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
const MATH_FUNCS = new Set(['sin', 'cos', 'sqrt', 'abs']);

export class PyRunner {
  private token = 0;
  running = false;
  lastError: string | null = null;
  private vars: Record<string, number | string | boolean> = { pi: Math.PI };
  private handlers: { key: Record<string, Stmt[]>; click: Stmt[][]; recognize: Record<string, Stmt[]> } = { key: {}, click: [], recognize: {} };

  constructor(private ast: Program, private api: PyStageApi) {}

  stop(): void { this.token++; this.running = false; }

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
    // MessageChannel 让渡不受后台定时器节流，⏹ 停止始终即时
    await new Promise<void>((resolve) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => { ch.port1.close(); resolve(); };
      ch.port2.postMessage(0);
    });
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
        case 'assign':
          this.vars[st.name] = await this.evalExpr(st.value, my);
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
          const range = await this.evalArgs(st.range, my);
          let start = 0, stop = 0;
          if (range.length === 2) { start = Number(range[0]); stop = Number(range[1]); }
          else { stop = Number(range[0] ?? 0); }
          const total = Math.min(2000, Math.max(0, Math.ceil(stop - start)));
          for (let i = 0; i < total; i++) {
            await this.guard(my);
            if (st.varName) this.vars[st.varName] = start + i;
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
      case 'var': {
        const v = this.vars[e.name];
        if (v === undefined) throw new Error(`还没给 ${e.name} 赋值就用了它（先写 ${e.name} = 数字）`);
        return v;
      }
      case 'neg': return -(await this.evalExpr(e.e, my) as number);
      case 'bin': {
        const l = await this.evalExpr(e.l, my);
        const r = await this.evalExpr(e.r, my);
        switch (e.op) {
          case '+': {
            if (typeof l === 'string' || typeof r === 'string') return String(l) + String(r);
            return Number(l) + Number(r);
          }
          case '-': return Number(l) - Number(r);
          case '*': return Number(l) * Number(r);
          case '/': {
            if (Number(r) === 0) throw new Error('除以 0 了！任何数都不能除以 0');
            return Number(l) / Number(r);
          }
          case '==': return Number(l) === Number(r);
          case '!=': return Number(l) !== Number(r);
          case '>': return Number(l) > Number(r);
          case '<': return Number(l) < Number(r);
          case '>=': return Number(l) >= Number(r);
          case '<=': return Number(l) <= Number(r);
        }
        return false;
      }
      case 'call': {
        if (e.name === 'range') {
          // range 在 for 头部已单独处理；作为表达式时返回首参数值
          return e.args.length ? Number(await this.evalExpr(e.args[0], my)) : 0;
        }
        if (MATH_FUNCS.has(e.name)) {
          const a = e.args.length ? Number(await this.evalExpr(e.args[0], my)) : 0;
          switch (e.name) {
            case 'sin': return Math.round(Math.sin((a * Math.PI) / 180) * 1e6) / 1e6; // 角度制，贴合课标
            case 'cos': return Math.round(Math.cos((a * Math.PI) / 180) * 1e6) / 1e6;
            case 'sqrt': {
              if (a < 0) throw new Error('负数没有平方根哦');
              return Math.round(Math.sqrt(a) * 1e6) / 1e6;
            }
            case 'abs': return Math.abs(a);
          }
          return 0;
        }
        if (SENSORS.has(e.name)) {
          return this.api.sensor(e.name, await this.evalArgs(e.args, my));
        }
        return false;
      }
    }
  }
}
