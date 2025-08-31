import OpenAI from 'openai';
import {
  enhancedRetrieval,
  type RetrievalPipelineConfig,
} from '@/lib/retrieval/query-rewriting';
import logger from '@/lib/utils/logger';

export type RetrievedDoc = {
  fileId: string;
  fileName: string;
  score: number;
  content: string;
  url?: string;
  metadata?: Record<string, unknown>;
};

const OPENAI_CLIENT_DEFAULTS = {
  maxRetries: 3,
  timeout: 30_000,
} as const;

async function getDefaultVectorStoreId(openai: OpenAI): Promise<string | null> {
  try {
    const stores = await openai.beta.vectorStores.list({ limit: 1 });
    if (stores.data.length > 0) return stores.data[0].id;
  } catch (err) {
    logger.error(
      { at: 'retrieval.vector.getDefaultVectorStoreId', err },
      'Failed to list vector stores'
    );
  }
  return null;
}

export async function performVectorRetrieval(
  query: string,
  options: {
    topK?: number;
    vectorStoreId?: string;
    fileTypes?: string[];
    reranking?: boolean;
    rerankingMethod?: 'semantic' | 'cross-encoder' | 'diversity';
    rewriteStrategy?:
      | 'expansion'
      | 'refinement'
      | 'decomposition'
      | 'multi-perspective';
  } = {}
): Promise<RetrievedDoc[]> {
  const {
    topK = 5,
    vectorStoreId,
    fileTypes,
    reranking = true,
    rerankingMethod = 'semantic',
    rewriteStrategy = 'expansion',
  } = options;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logger.warn(
      { at: 'retrieval.vector.apiKey.missing' },
      'OPENAI_API_KEY is not set; returning empty retrieval results'
    );
    return [];
  }

  const openai = new OpenAI({ apiKey, ...OPENAI_CLIENT_DEFAULTS });

  // Resolve store id
  let storeId = vectorStoreId || null;
  if (!storeId) {
    storeId = await getDefaultVectorStoreId(openai);
  }
  if (!storeId) {
    logger.info(
      { at: 'retrieval.vector.store.none' },
      'No vector store available'
    );
    return [];
  }

  const retrievalConfig: RetrievalPipelineConfig = {
    queryRewriting: true,
    rewriteStrategy,
    reranking,
    rerankingMethod,
    topK,
    metadataFilters: fileTypes ? { fileTypes } : undefined,
  };

  try {
    const results = await enhancedRetrieval(
      query,
      storeId,
      openai,
      retrievalConfig
    );

    const mapped: RetrievedDoc[] = results.map((r, i) => {
      const anyR = r as unknown as {
        id?: string;
        file_id?: string;
        file_name?: string;
        content?: string;
        score: number;
        metadata?: Record<string, unknown>;
      };

      const fileId = anyR.file_id || anyR.id || `doc-${i + 1}`;
      const fileName =
        anyR.file_name ||
        (anyR.metadata?.title as string) ||
        `Document ${i + 1}`;

      return {
        fileId,
        fileName,
        score: anyR.score,
        content: anyR.content || '',
        url: `/api/files/${fileId}`,
        metadata: anyR.metadata,
      };
    });

    return mapped.sort((a, b) => b.score - a.score).slice(0, topK);
  } catch (err) {
    logger.error(
      { at: 'retrieval.vector.error', err },
      'performVectorRetrieval failed'
    );
    return [];
  }
}
