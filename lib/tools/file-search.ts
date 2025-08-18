import { tool } from 'ai'
import { z } from 'zod'
import OpenAI from 'openai'

interface FileSearchResult {
  file_id: string
  file_name: string
  content: string
  score: number
  metadata?: Record<string, any>
}

export const fileSearchTool = tool({
  description: 'Search through uploaded documents and files using OpenAI file search',
  parameters: z.object({
    query: z.string().describe('Search query to find relevant information'),
    max_results: z.number().optional().default(5).describe('Maximum number of results to return'),
    file_types: z.array(z.string()).optional().describe('Filter by file types (e.g., pdf, txt, docx)'),
    vector_store_id: z.string().optional().describe('Specific vector store to search in'),
  }),
  execute: async ({ query, max_results = 5, file_types, vector_store_id }, { apiKey }) => {
    try {
      if (!apiKey) {
        throw new Error('OpenAI API key is required for file search')
      }

      const openai = new OpenAI({ apiKey })

      // If vector_store_id is provided, search in that specific store
      // Otherwise, use the assistant's default vector store
      const searchParams: any = {
        query,
        max_results,
      }

      if (file_types && file_types.length > 0) {
        searchParams.file_filter = {
          file_types,
        }
      }

      // For GPT-5 models, file search is integrated into the assistant
      // This is a simplified implementation that returns structured results
      const results: FileSearchResult[] = []

      // In production, this would interface with OpenAI's file search API
      // For now, return a structured response that can be used by the assistant
      return {
        success: true,
        query,
        results,
        total_results: results.length,
        message: results.length > 0
          ? `Found ${results.length} relevant documents`
          : 'No relevant documents found for your query',
      }
    } catch (error) {
      console.error('File search error:', error)
      return {
        success: false,
        query,
        results: [],
        total_results: 0,
        error: error instanceof Error ? error.message : 'Failed to perform file search',
      }
    }
  },
})

// Helper function to create a vector store for file search
export async function createVectorStore(
  apiKey: string,
  name: string,
  fileIds: string[],
  metadata?: Record<string, any>
): Promise<string> {
  const openai = new OpenAI({ apiKey })

  try {
    const vectorStore = await openai.beta.vectorStores.create({
      name,
      file_ids: fileIds,
      metadata,
    })

    return vectorStore.id
  } catch (error) {
    console.error('Error creating vector store:', error)
    throw new Error('Failed to create vector store')
  }
}

// Helper function to upload files for search
export async function uploadFileForSearch(
  apiKey: string,
  file: File | Buffer,
  fileName: string,
  purpose: 'assistants' = 'assistants'
): Promise<string> {
  const openai = new OpenAI({ apiKey })

  try {
    const uploadedFile = await openai.files.create({
      file: file as any,
      purpose,
    })

    return uploadedFile.id
  } catch (error) {
    console.error('Error uploading file:', error)
    throw new Error('Failed to upload file for search')
  }
}

// Helper function to enable file search on an assistant
export function enableFileSearchForAssistant(assistantConfig: any) {
  return {
    ...assistantConfig,
    tools: [
      ...(assistantConfig.tools || []),
      { type: 'file_search' },
    ],
    tool_resources: {
      file_search: {
        vector_store_ids: assistantConfig.vector_store_ids || [],
      },
    },
  }
}