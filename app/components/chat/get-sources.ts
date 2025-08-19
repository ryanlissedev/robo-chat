import type { UIMessage as MessageAISDK } from 'ai';

export function getSources(parts: MessageAISDK['parts']) {
  const sources = parts
    ?.filter(
      (part) => part.type === 'source-url' || part.type === 'source-document' || part.type.startsWith('tool-')
    )
    .map((part) => {
      // Handle source-url and source-document parts
      if (part.type === 'source-url' || part.type === 'source-document') {
        return (part as { source?: unknown }).source || part;
      }

      // Handle tool parts
      if (part.type.startsWith('tool-') && 'state' in part) {
        const toolPart = part as { state: string; output?: unknown; toolName?: string };
        if (toolPart.state === 'result') {
          const result = toolPart.output;

          if (
            toolPart.toolName === 'summarizeSources' &&
            (result as { result?: Array<{ citations?: unknown[] }> })?.result?.[0]?.citations
          ) {
            return (result as { result: Array<{ citations?: unknown[] }> }).result.flatMap(
              (item: { citations?: unknown[] }) => item.citations || []
            );
          }

          return Array.isArray(result) ? result.flat() : result;
        }
      }

      return null;
    })
    .filter(Boolean)
    .flat();

  const validSources =
    sources?.filter(
      (source) =>
        source && typeof source === 'object' && (source as { url?: string }).url && (source as { url?: string }).url !== ''
    ) || [];

  return validSources;
}