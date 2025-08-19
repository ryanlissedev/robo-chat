import OpenAI from 'openai';

/**
 * Vector Store Manager
 * Handles creation and management of OpenAI vector stores for file search
 */

export interface VectorStoreConfig {
  name: string;
  fileIds?: string[];
  metadata?: Record<string, string>;
}

export class VectorStoreManager {
  private openai: OpenAI;
  private defaultVectorStoreId: string | null = null;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Get or create the default vector store for RoboRail documentation
   */
  async getOrCreateDefaultVectorStore(): Promise<string> {
    if (this.defaultVectorStoreId) {
      return this.defaultVectorStoreId;
    }

    try {
      // Try to find existing RoboRail vector store
      const stores = await this.openai.vectorStores.list({ limit: 10 });
      const existingStore = stores.data.find(
        (store) =>
          store.name === 'RoboRail Documentation' ||
          store.metadata?.purpose === 'roborail_docs'
      );

      if (existingStore) {
        this.defaultVectorStoreId = existingStore.id;
        return existingStore.id;
      }

      // Create new vector store
      const newStore = await this.openai.vectorStores.create({
        name: 'RoboRail Documentation',
        metadata: {
          purpose: 'roborail_docs',
          created_by: 'roborail_assistant',
          created_at: new Date().toISOString(),
        },
        chunking_strategy: {
          type: 'static',
          static: {
            max_chunk_size_tokens: 800,
            chunk_overlap_tokens: 400,
          },
        },
      });

      this.defaultVectorStoreId = newStore.id;
      return newStore.id;
    } catch (error) {
      console.error('Error managing vector store:', error);
      throw new Error('Failed to get or create vector store');
    }
  }

  /**
   * Create a new vector store with specific configuration
   */
  async createVectorStore(config: VectorStoreConfig): Promise<string> {
    try {
      const vectorStore = await this.openai.vectorStores.create({
        name: config.name,
        file_ids: config.fileIds || [],
        metadata: {
          ...config.metadata,
          created_at: new Date().toISOString(),
        },
        chunking_strategy: {
          type: 'static',
          static: {
            max_chunk_size_tokens: 800,
            chunk_overlap_tokens: 400,
          },
        },
      });

      return vectorStore.id;
    } catch (error) {
      console.error('Error creating vector store:', error);
      throw new Error('Failed to create vector store');
    }
  }

  /**
   * Add files to an existing vector store
   */
  async addFilesToVectorStore(
    vectorStoreId: string,
    fileIds: string[]
  ): Promise<void> {
    try {
      for (const fileId of fileIds) {
        await this.openai.vectorStores.files.create(vectorStoreId, {
          file_id: fileId,
        });
      }
    } catch (error) {
      console.error('Error adding files to vector store:', error);
      throw new Error('Failed to add files to vector store');
    }
  }

  /**
   * Upload a file and add it to the vector store
   */
  async uploadAndAddFile(
    vectorStoreId: string,
    file: File | Buffer,
    fileName: string
  ): Promise<string> {
    try {
      // Upload file to OpenAI
      const uploadedFile = await this.openai.files.create({
        file: file as File,
        purpose: 'assistants',
      });

      // Add file to vector store
      await this.openai.vectorStores.files.create(vectorStoreId, {
        file_id: uploadedFile.id,
      });

      return uploadedFile.id;
    } catch (error) {
      console.error('Error uploading and adding file:', error);
      throw new Error('Failed to upload and add file to vector store');
    }
  }

  /**
   * List all vector stores
   */
  async listVectorStores(): Promise<OpenAI.VectorStore[]> {
    try {
      const response = await this.openai.vectorStores.list({ limit: 20 });
      return response.data;
    } catch (error) {
      console.error('Error listing vector stores:', error);
      return [];
    }
  }

  /**
   * Get vector store details
   */
  async getVectorStore(
    vectorStoreId: string
  ): Promise<OpenAI.VectorStore | null> {
    try {
      return await this.openai.vectorStores.retrieve(vectorStoreId);
    } catch (error) {
      console.error('Error getting vector store:', error);
      return null;
    }
  }
}

/**
 * Global vector store manager instance
 */
let globalVectorStoreManager: VectorStoreManager | null = null;

export function getVectorStoreManager(apiKey: string): VectorStoreManager {
  if (!globalVectorStoreManager) {
    globalVectorStoreManager = new VectorStoreManager(apiKey);
  }
  return globalVectorStoreManager;
}

/**
 * Utility function to get or create default vector store
 */
export async function getOrCreateDefaultVectorStore(
  apiKey: string
): Promise<string> {
  const manager = getVectorStoreManager(apiKey);
  return await manager.getOrCreateDefaultVectorStore();
}
