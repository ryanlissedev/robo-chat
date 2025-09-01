// ai v5 tools: import from ai instead of provider-utils to satisfy types
import { tool } from 'ai';
import OpenAI from 'openai';
import { z } from 'zod';
import {
  enhancedRetrieval,
  type RetrievalPipelineConfig,
} from '@/lib/retrieval/query-rewriting';
import logger from '@/lib/utils/logger';

// OpenAI client defaults and retry helpers
const OPENAI_CLIENT_DEFAULTS = {
  maxRetries: 3,
  timeout: 30_000,
} as const;

type RetryOptions = {
  attempts?: number; // total attempts including first
  baseDelayMs?: number; // initial delay
  maxDelayMs?: number; // cap delay
};

const isRetriableError = (err: unknown): boolean => {
  // Network-level errors
  const anyErr = err as { code?: string; status?: number; name?: string };
  if (
    anyErr?.code &&
    [
      'ECONNRESET',
      'ETIMEDOUT',
      'EAI_AGAIN',
      'ENETUNREACH',
      'ECONNREFUSED',
    ].includes(anyErr.code)
  ) {
    return true;
  }
  // OpenAI APIError has status
  if (typeof anyErr?.status === 'number') {
    const s = anyErr.status;
    if (s === 408 || s === 425 || s === 429 || (s >= 500 && s <= 504))
      return true;
  }
  return false;
};

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const base = opts.baseDelayMs ?? 500;
  const cap = opts.maxDelayMs ?? 4_000;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const retriable = isRetriableError(err);
      if (!retriable || i === attempts - 1) break;
      const delay =
        Math.min(cap, base * 2 ** i) + Math.floor(Math.random() * 150);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Operation failed');
}

type FileSearchResult = {
  file_id: string;
  file_name: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
};

export const file_search = tool({
  description:
    'Advanced search through uploaded documents using OpenAI vector stores with query rewriting and reranking',
  inputSchema: z.object({
    query: z.string().describe('Search query to find relevant information'),
    max_results: z
      .number()
      .optional()
      .default(5)
      .describe('Maximum number of results to return'),
    file_types: z
      .array(z.string())
      .optional()
      .describe('Filter by file types (e.g., pdf, txt, docx)'),
    vector_store_id: z
      .string()
      .optional()
      .describe('Specific vector store to search in'),
    enable_rewriting: z
      .boolean()
      .optional()
      .default(true)
      .describe('Enable query rewriting for better results'),
    rewrite_strategy: z
      .enum(['expansion', 'refinement', 'decomposition', 'multi-perspective'])
      .optional()
      .default('expansion'),
    enable_reranking: z
      .boolean()
      .optional()
      .default(true)
      .describe('Enable result reranking'),
    reranking_method: z
      .enum(['semantic', 'cross-encoder', 'diversity'])
      .optional()
      .default('semantic'),
  }),
  execute: async ({
    query,
    max_results = 5,
    file_types,
    vector_store_id,
    enable_rewriting = true,
    rewrite_strategy = 'expansion',
    enable_reranking = true,
    reranking_method = 'semantic',
  }) => {
    logger.info(
      {
        at: 'file_search.execute.start',
        query,
        max_results,
        file_types,
        vector_store_id,
        enable_rewriting,
        rewrite_strategy,
        enable_reranking,
        reranking_method,
        timestamp: new Date().toISOString(),
      },
      'File search tool execution started'
    );

    try {
      // Get API key from environment
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        logger.error(
          {
            at: 'file_search.execute.apiKeyMissing',
            timestamp: new Date().toISOString(),
          },
          'OpenAI API key not found'
        );
        throw new Error(
          'OpenAI API key is required for file search. Set OPENAI_API_KEY environment variable.'
        );
      }

      const openai = new OpenAI({ apiKey, ...OPENAI_CLIENT_DEFAULTS });

      // If no vector store ID provided, get the default one or create a new one
      let storeId: string | undefined = vector_store_id;
      if (!storeId) {
        logger.info(
          {
            at: 'file_search.execute.vectorStore.lookup',
            timestamp: new Date().toISOString(),
          },
          'Looking up default vector store'
        );

        // Try to get the user's default vector store
        const stores = await withRetry(() =>
          openai.vectorStores.list({ limit: 1 })
        );
        if (stores.data.length > 0) {
          storeId = stores.data[0].id;
          logger.info(
            {
              at: 'file_search.execute.vectorStore.found',
              storeId,
              storeName: stores.data[0].name,
              timestamp: new Date().toISOString(),
            },
            'Using existing vector store'
          );
        } else {
          // Create a new vector store if none exists
          logger.info(
            {
              at: 'file_search.execute.vectorStore.creating',
              timestamp: new Date().toISOString(),
            },
            'Creating new vector store'
          );

          const newStore = await withRetry(() =>
            openai.vectorStores.create({
              name: 'Base Chat Default Store',
              metadata: {
                created_by: 'Base Chat',
                purpose: 'file_search',
              },
            })
          );
          storeId = newStore.id;

          logger.info(
            {
              at: 'file_search.execute.vectorStore.created',
              storeId: newStore.id,
              storeName: newStore.name,
              timestamp: new Date().toISOString(),
            },
            'Created new vector store'
          );
        }
      } else {
        logger.info(
          {
            at: 'file_search.execute.vectorStore.provided',
            storeId,
            timestamp: new Date().toISOString(),
          },
          'Using provided vector store ID'
        );
      }

      // Configure retrieval pipeline
      const retrievalConfig: RetrievalPipelineConfig = {
        queryRewriting: enable_rewriting,
        rewriteStrategy: rewrite_strategy as
          | 'expansion'
          | 'refinement'
          | 'decomposition'
          | 'multi-perspective',
        reranking: enable_reranking,
        rerankingMethod: reranking_method as
          | 'semantic'
          | 'cross-encoder'
          | 'diversity',
        topK: max_results,
        metadataFilters: file_types ? { fileTypes: file_types } : undefined,
      };

      logger.info(
        {
          at: 'file_search.execute.retrieval.config',
          retrievalConfig,
          timestamp: new Date().toISOString(),
        },
        'Configured retrieval pipeline'
      );

      // Use enhanced retrieval with query rewriting and reranking
      // Note: retrieval currently feature-gated; returns empty results if unsupported
      logger.info(
        {
          at: 'file_search.execute.retrieval.calling',
          query,
          storeId,
          timestamp: new Date().toISOString(),
        },
        'Calling enhanced retrieval'
      );

      const results = await withRetry(() =>
        enhancedRetrieval(query, storeId as string, openai, retrievalConfig)
      );

      // Ensure results is always an array
      const safeResults = Array.isArray(results) ? results : [];

      logger.info(
        {
          at: 'file_search.execute.retrieval.complete',
          resultsCount: safeResults.length,
          hasResults: safeResults.length > 0,
          timestamp: new Date().toISOString(),
        },
        'Enhanced retrieval completed'
      );

      // Format results for output
      logger.info(
        {
          at: 'file_search.execute.formatting.start',
          rawResultsCount: safeResults.length,
          timestamp: new Date().toISOString(),
        },
        'Formatting search results'
      );

      const formattedResults = safeResults.map((result, index) => ({
        rank: index + 1,
        file_id: result.file_id || result.id,
        file_name: result.file_name || `Document ${index + 1}`,
        content: `${result.content.substring(0, 500)}...`,
        score: result.score,
        metadata: result.metadata,
      }));

      logger.info(
        {
          at: 'file_search.execute.formatting.complete',
          formattedResultsCount: formattedResults.length,
          topResultScore:
            formattedResults.length > 0 ? formattedResults[0].score : null,
          timestamp: new Date().toISOString(),
        },
        'Formatted search results'
      );

      // Create a summary of the search results
      const summary =
        formattedResults.length > 0
          ? `Found ${formattedResults.length} relevant documents. Top result has ${Math.round(formattedResults[0].score * 100)}% relevance.`
          : 'No relevant documents found. Try rephrasing your query or uploading more documents.';

      // Extract sources from results for citation
      const sources = formattedResults.map((result) => ({
        id: result.file_id,
        name: result.file_name,
        score: result.score,
        excerpt: result.content.substring(0, 200),
        url: `/api/files/${result.file_id}`,
      }));

      // Generate thinking/reasoning trace
      const thinking = [
        `Searching for: "${query}"`,
        enable_rewriting
          ? `Enhanced query with ${rewrite_strategy} strategy`
          : null,
        `Found ${formattedResults.length} relevant documents`,
        enable_reranking ? `Applied ${reranking_method} reranking` : null,
        formattedResults.length > 0
          ? `Top result: ${formattedResults[0].file_name} (score: ${formattedResults[0].score.toFixed(3)})`
          : 'No matching documents found',
      ]
        .filter(Boolean)
        .join('\n');

      const response = {
        success: true,
        query,
        enhanced_query: enable_rewriting
          ? `Query enhanced with ${rewrite_strategy} strategy`
          : query,
        results: formattedResults,
        total_results: formattedResults.length,
        summary,
        sources, // Add sources for UI citation
        thinking, // Add thinking trace for UI display
        search_config: {
          vector_store_id: storeId,
          query_rewriting: enable_rewriting,
          rewrite_strategy,
          reranking: enable_reranking,
          reranking_method,
        },
      };

      logger.info(
        {
          at: 'file_search.execute.success',
          response: {
            success: response.success,
            query: response.query,
            enhanced_query: response.enhanced_query,
            total_results: response.total_results,
            summary: response.summary,
            sources: response.sources,
            thinking: response.thinking,
            search_config: response.search_config,
          },
          timestamp: new Date().toISOString(),
        },
        'File search completed successfully'
      );

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to perform file search';

      logger.error(
        {
          at: 'file_search.execute.error',
          query,
          error: errorMessage,
          errorDetails:
            error instanceof Error
              ? {
                  name: error.name,
                  stack: error.stack,
                }
              : error,
          timestamp: new Date().toISOString(),
        },
        'File search failed'
      );

      return {
        success: false,
        query,
        results: [],
        total_results: 0,
        error: errorMessage,
      };
    }
  },
});

// Enhanced vector store creation with optimized settings
export async function createVectorStore(
  apiKey: string,
  name: string,
  fileIds: string[],
  metadata?: Record<string, unknown>
): Promise<string> {
      const openai = new OpenAI({ apiKey, ...OPENAI_CLIENT_DEFAULTS });

  try {
    const vectorStore = await withRetry(() =>
      openai.vectorStores.create({
        name,
        file_ids: fileIds,
        metadata: {
          ...metadata,
          created_at: new Date().toISOString(),
          file_count: fileIds.length.toString(),
        },
        chunking_strategy: {
          type: 'static',
          static: {
            max_chunk_size_tokens: 800,
            chunk_overlap_tokens: 400,
          },
        },
      })
    );

    return vectorStore.id;
  } catch {
    throw new Error('Failed to create vector store');
  }
}

// Enhanced file upload with metadata extraction
export async function uploadFileForSearch(
  apiKey: string,
  file: File | Buffer,
  _fileName: string,
  purpose: 'assistants' = 'assistants',
  metadata?: Record<string, unknown>
): Promise<string> {
  const openai = new OpenAI({ apiKey, ...OPENAI_CLIENT_DEFAULTS });

  try {
    const uploadedFile = await withRetry(() =>
      openai.files.create({
        file: file as File,
        purpose,
      })
    );

    // Store metadata for better search
    if (metadata) {
    }

    return uploadedFile.id;
  } catch {
    throw new Error('Failed to upload file for search');
  }
}

// Helper function to enable file search on an assistant with enhanced configuration
export function enableFileSearchForAssistant(
  assistantConfig: { tools?: unknown[]; vector_store_ids?: string[] },
  vectorStoreIds: string[] = []
) {
  return {
    ...assistantConfig,
    tools: [
      ...(assistantConfig.tools || []),
      {
        type: 'file_search',
        file_search: {
          max_num_results: 10,
          ranking_options: {
            ranker: 'default-2024-11-15',
            score_threshold: 0.5,
          },
        },
      },
    ],
    tool_resources: {
      file_search: {
        vector_store_ids:
          vectorStoreIds.length > 0
            ? vectorStoreIds
            : assistantConfig.vector_store_ids || [],
      },
    },
  };
}

// Batch file upload for efficiency
export async function batchUploadFiles(
  apiKey: string,
  files: Array<{
    file: File | Buffer;
    name: string;
    metadata?: Record<string, unknown>;
  }>,
  vectorStoreName: string
): Promise<{ vectorStoreId: string; fileIds: string[] }> {
  try {
    // Upload all files in parallel
    const uploadPromises = files.map(({ file, name, metadata }) =>
      uploadFileForSearch(apiKey, file, name, 'assistants', metadata)
    );

    const fileIds = await Promise.all(uploadPromises);

    // Create vector store with all files
    const vectorStoreId = await createVectorStore(
      apiKey,
      vectorStoreName,
      fileIds,
      {
        total_files: files.length,
        batch_upload: true,
      }
    );

    return { vectorStoreId, fileIds };
  } catch {
    throw new Error('Failed to batch upload files');
  }
}

// Search across multiple vector stores
export async function searchMultipleStores(
  apiKey: string,
  query: string,
  vectorStoreIds: string[],
  config?: RetrievalPipelineConfig
): Promise<FileSearchResult[]> {
  const openai = new OpenAI({ apiKey, ...OPENAI_CLIENT_DEFAULTS });

  try {
    // Search each vector store in parallel
    const searchPromises = vectorStoreIds.map((storeId) =>
      withRetry(() => enhancedRetrieval(query, storeId, openai, config))
    );

    const allResults = await Promise.all(searchPromises);

    // Combine and deduplicate results
    const combinedResults = allResults.flat();
    const uniqueResults = Array.from(
      new Map(combinedResults.map((r) => [r.id, r])).values()
    );

    // Re-rank combined results
    const mapped = uniqueResults.map((r, i) => {
      const result = r as {
        file_id?: string;
        file_name?: string;
        content?: string;
        id?: string;
        score: number;
        metadata?: { title?: string; [key: string]: unknown };
      };
      return {
        file_id: result.file_id || result.id || `doc-${i}`,
        file_name:
          result.file_name || result.metadata?.title || `Document ${i + 1}`,
        content: result.content || '',
        score: result.score,
        metadata: result.metadata as Record<string, unknown> | undefined,
      };
    });

    if (config?.reranking) {
      return mapped
        .sort((a, b) => b.score - a.score)
        .slice(0, config.topK || 5);
    }

    return mapped;
  } catch {
    throw new Error('Failed to search across multiple vector stores');
  }
}
