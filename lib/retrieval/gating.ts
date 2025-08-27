export function shouldEnableFileSearchTools(
  enableSearch: boolean,
  modelSupportsFileSearchTools: boolean
): boolean {
  return enableSearch && modelSupportsFileSearchTools;
}

export function shouldUseFallbackRetrieval(
  enableSearch: boolean,
  modelSupportsFileSearchTools: boolean
): boolean {
  // Fallback retrieval is used when search is enabled but tools are not supported by the model
  return enableSearch && !modelSupportsFileSearchTools;
}

export function selectRetrievalMode(
  twoPassEnabled: boolean
): 'two-pass' | 'vector' {
  return twoPassEnabled ? 'two-pass' : 'vector';
}
