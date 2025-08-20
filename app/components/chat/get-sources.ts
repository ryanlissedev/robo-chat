import type { UIMessage as MessageAISDK } from 'ai';

// Types for source parts from AI SDK message parts
type SourceUrlPart = {
  type: 'source-url';
  url?: string;
  title?: string;
};

type SourceDocumentPart = {
  type: 'source-document';
  title?: string;
};

type ToolPart = {
  type: string;
  state?: string;
  output?: unknown;
  toolName?: string;
};

type SourceItem = {
  id: string;
  title: string;
  url: string;
};

export function getSources(parts: MessageAISDK['parts']): SourceItem[] {
  const sources = parts
    ?.filter(
      (part) =>
        part.type === 'source-url' ||
        part.type === 'source-document' ||
        (typeof part.type === 'string' && part.type.startsWith('tool-'))
    )
    .flatMap((part) => {
      if (part.type === 'source-url') {
        const urlPart = part as SourceUrlPart;
        return [
          {
            id: urlPart.url || `url-${Math.random()}`,
            title: urlPart.title || urlPart.url || 'Source',
            url: urlPart.url || '#',
          },
        ];
      }
      if (part.type === 'source-document') {
        const docPart = part as SourceDocumentPart;
        return [
          {
            id: docPart.title || `doc-${Math.random()}`,
            title: docPart.title || 'Document',
            url: docPart.title || '#',
          },
        ];
      }

      // tool parts – v5 exposes state and structured output; try common shapes we use
      const toolPart = part as ToolPart;
      const state = toolPart.state;
      const output = toolPart.output;
      const toolName = toolPart.toolName;

      if (
        (state === 'done' || state === 'output-available') &&
        toolName === 'summarizeSources'
      ) {
        const res = (output as { result?: unknown })?.result;
        if (Array.isArray(res)) {
          return res.flatMap((item: unknown) => 
            (item as { citations?: SourceItem[] })?.citations || []
          );
        }
      }

      if (state === 'result' && Array.isArray(output)) {
        return output.flat();
      }

      return [];
    });

  const validSources =
    sources?.filter(
      (source): source is SourceItem =>
        source && typeof source === 'object' && 'url' in source && source.url && source.url !== ''
    ) || [];

  return validSources;
}
