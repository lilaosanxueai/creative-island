import type { LlmConfig } from './config.ts';

/** OpenAI 兼容接口的流式客户端：逐段 yield 文本增量；未配置 key 时走 mock 降级 */

export interface LlmMessage { role: 'system' | 'user' | 'assistant'; content: string }

const MOCK_REPLIES = [
  '（我是离线替身 🤖 还没接上真正的大模型——请爸爸妈妈在 data/config.json 里填上 apiKey，我马上变得超级聪明！）',
  '先偷偷告诉你：等接上大脑之后，我可以陪你头脑风暴、讲解积木、给你只差一步的提示～现在你先拖几块积木试试？',
];

export async function* streamChat(
  cfg: LlmConfig,
  messages: LlmMessage[],
  opts: { mock: boolean },
): AsyncGenerator<string> {
  if (opts.mock) {
    for (const line of MOCK_REPLIES) {
      for (const ch of line) {
        yield ch;
        await new Promise((r) => setTimeout(r, 12));
      }
      yield '\n\n';
      await new Promise((r) => setTimeout(r, 300));
    }
    return;
  }

  const resp = await fetch(`${cfg.baseURL.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.apiKey}` },
    body: JSON.stringify({ model: cfg.model, messages, max_tokens: cfg.maxTokens, temperature: 0.7, stream: true }),
  });

  if (!resp.ok || !resp.body) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`LLM 接口返回 ${resp.status}：${detail.slice(0, 300)}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line.startsWith('data:')) continue;
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) yield delta;
      } catch { /* 忽略半包 */ }
    }
  }
}
