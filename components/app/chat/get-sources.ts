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
      (part): part is SourcePart | ToolInvocationPart => part.type === 'source' || part.type === 'tool-invocation'
    )
    .map((part) => {
      if (part.type === 'source') {
        return part.source;
      }

      if (
        part.type === 'tool-invocation' &&
        part.toolInvocation.state === 'result'
      ) {
        const result = part.toolInvocation.result as Record<string, unknown> | unknown[];

        if (
          part.toolInvocation.toolName === 'summarizeSources' &&
          typeof result === 'object' && result &&
          'result' in result && Array.isArray((result as { result: unknown[] }).result) &&
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

  const validSources =
    sources?.filter(
      (source): source is { url: string } =>
        Boolean(source && typeof source === 'object' && 'url' in source && 
        typeof (source as { url: unknown }).url === 'string' && (source as { url: string }).url !== '')
    ) || [];

  return validSources;
}
