interface SourcePart {
  type: 'source';
  source: unknown;
}

interface ToolInvocationPart {
  type: 'tool-invocation';
  toolInvocation: {
    state: string;
    toolName: string;
    result: unknown;
  };
}

type MessagePart = SourcePart | ToolInvocationPart | { type: string };

export function getSources(parts: MessagePart[]) {
  const sources = parts
    ?.filter(
      (part): part is SourcePart | ToolInvocationPart =>
        part.type === 'source' || part.type === 'tool-invocation'
    )
    .map((part) => {
      if (part.type === 'source') {
        return part.source;
      }

      if (
        part.type === 'tool-invocation' &&
        part.toolInvocation.state === 'result'
      ) {
        const result = part.toolInvocation.result as
          | Record<string, unknown>
          | { sources?: unknown }
          | unknown[];

        // Prefer explicit `sources` arrays when tools return structured results
        if (
          result &&
          typeof result === 'object' &&
          'sources' in result &&
          Array.isArray((result as { sources?: unknown[] }).sources)
        ) {
          return (result as { sources: unknown[] }).sources;
        }

        if (
          part.toolInvocation.toolName === 'summarizeSources' &&
          typeof result === 'object' &&
          result &&
          'result' in result &&
          Array.isArray((result as { result: unknown[] }).result) &&
          (result as { result: { citations?: unknown[] }[] }).result[0]?.citations
        ) {
          return (result as { result: { citations?: unknown[] }[] }).result.flatMap(
            (item) => item.citations || []
          );
        }

        return Array.isArray(result) ? result.flat() : result;
      }

      return null;
    })
    .filter(Boolean)
    .flat();

  // Normalize to a unified shape and allow entries without URLs
  const normalized = (sources || [])
    .filter((source): source is Record<string, unknown> =>
      Boolean(source && typeof source === 'object')
    )
    .map((source) => {
      const s = source as Record<string, unknown>;
      const url = typeof s.url === 'string' ? s.url : '';
      const title =
        (typeof s.title === 'string' && s.title) ||
        (typeof s.name === 'string' && s.name) ||
        (typeof s.file_name === 'string' && s.file_name) ||
        (url ? url : 'Untitled');
      const id =
        (typeof s.id === 'string' && s.id) ||
        (typeof s.file_id === 'string' && s.file_id) ||
        `${title}-${Math.random().toString(36).slice(2, 8)}`;

      return { id, url, title };
    });

  return normalized;
}
