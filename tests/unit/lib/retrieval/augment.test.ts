import { describe, expect, it } from 'vitest';
import { buildAugmentedSystemPrompt } from '@/lib/retrieval/augment';

describe('buildAugmentedSystemPrompt', () => {
  it('includes base system text and sources list', () => {
    const base = 'You are a helpful assistant.';
    const docs = [
      {
        fileId: '1',
        fileName: 'a.md',
        score: 0.9,
        content: 'alpha content'.repeat(20),
      },
      {
        fileId: '2',
        fileName: 'b.md',
        score: 0.7,
        content: 'beta content'.repeat(20),
        url: 'http://example.com/b',
      },
    ];

    const out = buildAugmentedSystemPrompt(base, docs, { budgetTokens: 200 });

    expect(out).toContain(base);
    expect(out).toContain('[Retrieved Context]');
    expect(out).toContain('[Sources]');
    expect(out).toContain('a.md');
    expect(out).toContain('b.md');
    expect(out).toContain('(90.0%)');
  });

  it('respects budget by clipping content length', () => {
    const base = 'System';
    const long = 'x'.repeat(8000);
    const docs = [
      { fileId: '1', fileName: 'long.txt', score: 0.5, content: long },
    ];

    const outSmall = buildAugmentedSystemPrompt(base, docs, {
      budgetTokens: 100,
    });
    const outLarge = buildAugmentedSystemPrompt(base, docs, {
      budgetTokens: 2000,
    });

    // Roughly, larger budget should include more characters
    expect(outLarge.length).toBeGreaterThan(outSmall.length);
  });
});
