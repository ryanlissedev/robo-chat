import { describe, expect, it } from 'vitest';
import {
  selectRetrievalMode,
  shouldEnableFileSearchTools,
  shouldUseFallbackRetrieval,
} from '@/lib/retrieval/gating';

describe('retrieval gating helpers', () => {
  it('should enable file search tools only when search is enabled and model supports tools', () => {
    expect(shouldEnableFileSearchTools(true, true)).toBe(true);
    expect(shouldEnableFileSearchTools(true, false)).toBe(false);
    expect(shouldEnableFileSearchTools(false, true)).toBe(false);
    expect(shouldEnableFileSearchTools(false, false)).toBe(false);
  });

  it('should use fallback retrieval when search is enabled but model does not support tools', () => {
    expect(shouldUseFallbackRetrieval(true, false)).toBe(true);
    expect(shouldUseFallbackRetrieval(true, true)).toBe(false);
    expect(shouldUseFallbackRetrieval(false, false)).toBe(false);
    expect(shouldUseFallbackRetrieval(false, true)).toBe(false);
  });

  it('should select retrieval mode based on two-pass flag', () => {
    expect(selectRetrievalMode(true)).toBe('two-pass');
    expect(selectRetrievalMode(false)).toBe('vector');
  });

  it('enables tools and disables fallback when fileSearchTools is true and search enabled', () => {
    const enableSearch = true;
    const modelSupportsFileSearchTools = true;

    expect(
      shouldEnableFileSearchTools(enableSearch, modelSupportsFileSearchTools)
    ).toBe(true);
    expect(
      shouldUseFallbackRetrieval(enableSearch, modelSupportsFileSearchTools)
    ).toBe(false);
  });
});
