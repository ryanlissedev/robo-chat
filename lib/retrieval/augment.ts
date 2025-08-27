import { RETRIEVAL_MAX_TOKENS } from '@/lib/config';

export type RetrievedDoc = {
  fileId: string;
  fileName: string;
  score: number; // 0..1 similarity
  content: string;
  url?: string;
};

/**
 * Build a single system prompt string that augments the base system instructions
 * with retrieved context snippets and a sources list.
 *
 * The function clips snippet content to a rough token budget using a 4 char/token heuristic.
 */
export function buildAugmentedSystemPrompt(
  baseSystem: string,
  docs: RetrievedDoc[],
  opts?: { budgetTokens?: number }
): string {
  const budgetMax = Math.max(200, opts?.budgetTokens ?? RETRIEVAL_MAX_TOKENS);
  let budget = budgetMax;
  const snippets: string[] = [];

  for (const doc of docs) {
    if (budget <= 0) break;
    const maxChars = Math.min(doc.content.length, Math.max(200, Math.floor(budget / 2)));
    const snippet = doc.content.slice(0, maxChars);
    budget -= Math.ceil(snippet.length / 4); // rough token estimate
    snippets.push(`Source: ${doc.fileName} (${(doc.score * 100).toFixed(1)}%)\n${snippet}`);
  }

  const sourcesList = docs
    .map((d) => `- ${d.fileName}${d.url ? ` (${d.url})` : ''}`)
    .join('\n');

  const augmentation = `Use the following retrieved context from the user's files to answer. If it is not relevant, say so and proceed without it.\n\n[Retrieved Context]\n${snippets.join('\n\n')}\n\n[Sources]\n${sourcesList}`;

  return [baseSystem, augmentation].filter(Boolean).join('\n\n');
}
