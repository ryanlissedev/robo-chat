import { tool } from 'ai';
import { z } from 'zod';

/**
 * Native OpenAI file search tool using the responses API
 * Based on: https://sdk.vercel.ai/docs/reference/ai-sdk-providers/openai#file-search
 */
export const openaiNativeFileSearchTool = tool({
  description:
    'Search through uploaded documents using OpenAI native file search',
  inputSchema: z.object({
    query: z.string().describe('Search query to find relevant information'),
    vectorStoreIds: z
      .array(z.string())
      .optional()
      .describe('Vector store IDs to search in'),
    maxResults: z
      .number()
      .optional()
      .default(10)
      .describe('Maximum number of results to return (1-50)'),
    filters: z
      .object({
        after: z.string().optional().describe('Return results after this date'),
        before: z
          .string()
          .optional()
          .describe('Return results before this date'),
      })
      .optional()
      .describe('Optional filters for the search'),
  }),
  execute: async () => {
    // This tool is configured at the model level for GPT-5 responses API
    // The actual execution is handled by OpenAI's native file search
    return {
      success: true,
      message: 'File search executed via OpenAI native implementation',
    };
  },
});

/**
 * Configure file search for OpenAI responses API
 * This returns the configuration to be passed to the model
 */
export function configureNativeFileSearch(
  vectorStoreIds: string[] = [],
  options?: {
    maxResults?: number;
    rankingOptions?: {
      ranker?: string;
      scoreThreshold?: number;
    };
  }
) {
  return {
    type: 'file_search' as const,
    fileSearch: {
      vectorStoreIds,
      maxResults: options?.maxResults ?? 10,
      ...(options?.rankingOptions && {
        rankingOptions: options.rankingOptions,
      }),
    },
  };
}

/**
 * Helper to configure tool choice for forcing file search
 */
export function forceFileSearchToolChoice() {
  return {
    type: 'tool' as const,
    toolName: 'file_search',
  };
}
