#!/usr/bin/env -S node --import tsx
/**
 * Live GPT‑5 Mini probe via AI SDK v5 and our openproviders factory.
 * Requires: OPENAI_API_KEY in environment.
 */
import { generateText } from 'ai';
import { openproviders } from '../../lib/openproviders';

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY; cannot run live test.');
    process.exit(2);
  }
  console.log('🔎 Probing gpt-5-mini via Responses API...');
  const model = openproviders('gpt-5-mini');
  const { text, finishReason } = await generateText({
    model,
    prompt: 'Reply with a single short sentence confirming streaming works.',
  });
  console.log('✅ Response:', text.trim());
  console.log('Finish:', finishReason);
}

main().catch((err) => {
  console.error('❌ Live GPT-5 test failed:', err);
  process.exit(1);
});

