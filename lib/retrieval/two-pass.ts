import { type LanguageModel, streamText } from 'ai';
import type { ExtendedUIMessage } from '@/app/types/ai-extended';
import { RETRIEVAL_RETRIEVER_MODEL_ID } from '@/lib/config';
import { getModelInfo } from '@/lib/models';
import { fileSearchTool } from '@/lib/tools/file-search';
import logger from '@/lib/utils/logger';
import { performVectorRetrieval, type RetrievedDoc } from './vector-retrieval';

type ToolInvocationResultSource = {
  id?: string;
  name?: string;
  score?: number;
  url?: string;
};

type FileSearchResultItem = {
  file_id?: string;
  file_name?: string;
  content?: string;
  score?: number;
};

type FileSearchToolResult = {
  results?: Array<FileSearchResultItem>;
  sources?: Array<ToolInvocationResultSource>;
};

export async function retrieveWithGpt41(
  query: string,
  _messages: ExtendedUIMessage[],
  options?: { topK?: number }
): Promise<RetrievedDoc[]> {
  const retrieverId = RETRIEVAL_RETRIEVER_MODEL_ID || 'gpt-4.1';
  const modelConfig = getModelInfo(retrieverId);
  const apiKey = process.env.OPENAI_API_KEY;

  if (!modelConfig?.apiSdk || !apiKey) {
    logger.info({
      at: 'retrieval.twoPass.fallback',
      reason: 'no retriever model or api key',
    });
    return performVectorRetrieval(query, { topK: options?.topK ?? 5 });
  }

  try {
    const model = modelConfig.apiSdk(apiKey, {
      enableSearch: false,
    }) as LanguageModel;
    const retrieved = await new Promise<RetrievedDoc[]>((resolve) => {
      const results: RetrievedDoc[] = [];
      streamText({
        model,
        system:
          'You are a retrieval assistant. Use the fileSearch tool to find relevant documents for the user query. Return the search results to help answer their question.',
        messages: [
          {
            role: 'user',
            content: `Retrieve top ${options?.topK ?? 5} documents relevant to: ${query}`,
          },
        ],
        tools: { fileSearch: fileSearchTool },
        onFinish: async ({ response }) => {
          try {
            const msgs = (response.messages || []) as Array<
              { toolInvocations?: Array<unknown> } | Record<string, unknown>
            >;
            const last = msgs[msgs.length - 1] as {
              toolInvocations?: Array<{
                toolName?: string;
                result?: FileSearchToolResult;
              }>;
            };
            const invocations = last?.toolInvocations || [];
            for (const inv of invocations) {
              const t = inv as {
                toolName?: string;
                result?: FileSearchToolResult;
              };
              if (t.toolName === 'fileSearch' && t.result) {
                const r = t.result.results || [];
                for (let i = 0; i < r.length; i++) {
                  const it = r[i] as FileSearchResultItem;
                  results.push({
                    fileId: it.file_id || `doc-${i + 1}`,
                    fileName: it.file_name || `Document ${i + 1}`,
                    score: typeof it.score === 'number' ? it.score : 0,
                    content: it.content || '',
                    url: it.file_id ? `/api/files/${it.file_id}` : undefined,
                  });
                }
              }
            }
          } catch (err) {
            logger.error({ at: 'retrieval.twoPass.parseError', err });
          }
          resolve(results);
        },
        onError: () => resolve(results),
      });
    });

    if (!retrieved.length) {
      return performVectorRetrieval(query, { topK: options?.topK ?? 5 });
    }
    return retrieved;
  } catch (err) {
    logger.error({ at: 'retrieval.twoPass.error', err });
    return performVectorRetrieval(query, { topK: options?.topK ?? 5 });
  }
}
