#!/usr/bin/env tsx
import { generateText } from 'ai';
import { openproviders } from '../../lib/openproviders';

// Mock fetch to avoid real network
const logs: Array<{ url: string; body?: any }> = [];
global.fetch = (async (url: any, init?: any) => {
  let body: any;
  try {
    body = init?.body ? JSON.parse(init.body) : undefined;
  } catch {
    body = init?.body;
  }
  logs.push({ url: String(url), body });

  const payload = {
    id: 'mock-resp',
    object: 'chat.completion',
    choices: [
      { message: { content: 'hello' }, finish_reason: 'stop' },
    ],
  };
  return {
    ok: true,
    status: 200,
    headers: new Map([['content-type', 'application/json']]) as any,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  } as any;
}) as any;

async function run() {
  const models = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano'] as const;
  for (const m of models) {
    const model = openproviders(m);
    await generateText({ model, prompt: 'test', maxTokens: 5 });
  }

  console.log('Captured requests:', logs.length);
  for (const { url, body } of logs) {
    console.log('-', url.includes('/responses') ? 'responses' : url, body?.model);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
