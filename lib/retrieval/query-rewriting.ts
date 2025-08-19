/**
 * Query Rewriting and Ranking for OpenAI Retrieval
 * Based on: https://platform.openai.com/docs/guides/retrieval
 */

import type OpenAI from 'openai';

export interface QueryRewriteConfig {
  strategy: 'expansion' | 'refinement' | 'decomposition' | 'multi-perspective';
  context?: string;
  previousQueries?: string[];
  domain?: string;
}

export interface RetrievalResult {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
  file_id?: string;
  file_name?: string;
}

/**
 * Query Expansion: Add synonyms and related terms
 */
export async function expandQuery(
  query: string,
  openai: OpenAI
): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 1,
    messages: [
      {
        role: 'system',
        content:
          'You are a query expansion expert. Generate alternative phrasings and related terms for search queries.',
      },
      {
        role: 'user',
        content: `Expand this search query with synonyms and related terms. Return 3-5 variations.
        
Query: "${query}"

Provide variations as a JSON array of strings.`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  try {
    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.variations || [query];
  } catch {
    return [query];
  }
}

/**
 * Query Refinement: Improve query clarity and specificity
 */
export async function refineQuery(
  query: string,
  context: string,
  openai: OpenAI
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 1,
    messages: [
      {
        role: 'system',
        content:
          'You are a query refinement expert. Improve search queries for better retrieval accuracy.',
      },
      {
        role: 'user',
        content: `Refine this search query to be more specific and clear based on the context.

Original Query: "${query}"
Context: ${context}

Provide a single refined query that will retrieve the most relevant information.`,
      },
    ],
  });

  return response.choices[0].message.content || query;
}

/**
 * Query Decomposition: Break complex queries into sub-queries
 */
export async function decomposeQuery(
  query: string,
  openai: OpenAI
): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 1,
    messages: [
      {
        role: 'system',
        content:
          'You are a query decomposition expert. Break complex queries into simpler sub-queries.',
      },
      {
        role: 'user',
        content: `Decompose this complex query into 2-4 simpler sub-queries that can be searched independently.

Complex Query: "${query}"

Return as a JSON array of sub-queries.`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  try {
    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.subqueries || [query];
  } catch {
    return [query];
  }
}

/**
 * Multi-perspective Query Generation
 */
export async function generateMultiPerspectiveQueries(
  query: string,
  openai: OpenAI
): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 1,
    messages: [
      {
        role: 'system',
        content:
          'Generate multiple perspectives on a query for comprehensive retrieval.',
      },
      {
        role: 'user',
        content: `Generate different perspectives on this query to ensure comprehensive retrieval:

Query: "${query}"

Provide 3-4 different angles or perspectives as a JSON array.`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  try {
    const result = JSON.parse(response.choices[0].message.content || '{}');
    return result.perspectives || [query];
  } catch {
    return [query];
  }
}

/**
 * Hypothetical Document Embedding (HyDE)
 * Generate a hypothetical perfect answer and search for similar content
 */
export async function generateHypotheticalDocument(
  query: string,
  openai: OpenAI
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 1,
    messages: [
      {
        role: 'system',
        content:
          'Generate a hypothetical document that would perfectly answer the given query.',
      },
      {
        role: 'user',
        content: `Generate a hypothetical document excerpt (2-3 paragraphs) that would perfectly answer this query:

Query: "${query}"

Write as if you were the ideal document containing this information.`,
      },
    ],
  });

  return response.choices[0].message.content || query;
}

/**
 * Rewrite query based on strategy
 */
export async function rewriteQuery(
  query: string,
  config: QueryRewriteConfig,
  openai: OpenAI
): Promise<string[]> {
  switch (config.strategy) {
    case 'expansion':
      return expandQuery(query, openai);

    case 'refinement': {
      const refined = await refineQuery(query, config.context || '', openai);
      return [refined];
    }

    case 'decomposition':
      return decomposeQuery(query, openai);

    case 'multi-perspective':
      return generateMultiPerspectiveQueries(query, openai);

    default:
      return [query];
  }
}

/**
 * Semantic Similarity Reranking
 */
export async function rerankResults(
  query: string,
  results: RetrievalResult[],
  openai: OpenAI,
  topK = 5
): Promise<RetrievalResult[]> {
  if (results.length <= topK) return results;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 1,
    messages: [
      {
        role: 'system',
        content:
          'You are a relevance ranking expert. Score each document based on relevance to the query.',
      },
      {
        role: 'user',
        content: `Rank these documents by relevance to the query. Return the indices of the top ${topK} most relevant documents.

Query: "${query}"

Documents:
${results.map((r, i) => `[${i}] ${r.content.substring(0, 500)}...`).join('\n\n')}

Return as JSON: { "rankings": [indices in order of relevance] }`,
      },
    ],
    response_format: { type: 'json_object' },
  });

  try {
    const result = JSON.parse(response.choices[0].message.content || '{}');
    const rankings = result.rankings || [];

    // Reorder results based on rankings
    const reranked = rankings
      .map((index: number) => results[index])
      .filter(Boolean)
      .slice(0, topK);

    // Add any missing results to maintain topK
    if (reranked.length < topK) {
      const usedIndices = new Set(rankings);
      for (let i = 0; i < results.length && reranked.length < topK; i++) {
        if (!usedIndices.has(i)) {
          reranked.push(results[i]);
        }
      }
    }

    return reranked;
  } catch {
    return results.slice(0, topK);
  }
}

/**
 * Cross-encoder Reranking using GPT-5
 */
export async function crossEncoderRerank(
  query: string,
  results: RetrievalResult[],
  openai: OpenAI
): Promise<RetrievalResult[]> {
  // Score each result individually for more accurate ranking
  const scoringPromises = results.map(async (result, index) => {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 1,
      messages: [
        {
          role: 'system',
          content: 'Score the relevance of a document to a query from 0-100.',
        },
        {
          role: 'user',
          content: `Query: "${query}"
          
Document: "${result.content.substring(0, 1000)}"

Provide a relevance score from 0-100 as a JSON object: { "score": number }`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    try {
      const scoreResult = JSON.parse(
        response.choices[0].message.content || '{}'
      );
      return {
        ...result,
        score: scoreResult.score || 0,
        originalIndex: index,
      };
    } catch {
      return {
        ...result,
        score: 0,
        originalIndex: index,
      };
    }
  });

  const scoredResults = await Promise.all(scoringPromises);

  // Sort by score descending
  return scoredResults
    .sort((a, b) => b.score - a.score)
    .map(({ ...rest }) => rest);
}

/**
 * Diversity-aware Reranking (MMR - Maximal Marginal Relevance)
 */
export function diversityRerank(
  results: RetrievalResult[],
  lambda = 0.5 // Balance between relevance and diversity
): RetrievalResult[] {
  if (results.length <= 1) return results;

  const selected: RetrievalResult[] = [];
  const remaining = [...results];

  // Select the most relevant first
  selected.push(remaining.shift()!);

  while (remaining.length > 0 && selected.length < 10) {
    let bestScore = Number.NEGATIVE_INFINITY;
    let bestIndex = -1;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];

      // Relevance score (already provided)
      const relevance = candidate.score;

      // Diversity score (simplified - based on content difference)
      let maxSimilarity = 0;
      for (const doc of selected) {
        const similarity = calculateSimilarity(candidate.content, doc.content);
        maxSimilarity = Math.max(maxSimilarity, similarity);
      }

      // MMR score
      const mmrScore = lambda * relevance - (1 - lambda) * maxSimilarity;

      if (mmrScore > bestScore) {
        bestScore = mmrScore;
        bestIndex = i;
      }
    }

    if (bestIndex >= 0) {
      selected.push(remaining.splice(bestIndex, 1)[0]);
    } else {
      break;
    }
  }

  return selected;
}

/**
 * Simple similarity calculation (Jaccard similarity)
 */
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return intersection.size / union.size;
}

/**
 * Metadata-based Filtering and Boosting
 */
export function applyMetadataFilters(
  results: RetrievalResult[],
  filters: {
    fileTypes?: string[];
    dateRange?: { start: Date; end: Date };
    tags?: string[];
    minScore?: number;
  }
): RetrievalResult[] {
  let filtered = [...results];

  // Apply filters
  if (filters.fileTypes && filters.fileTypes.length > 0) {
    filtered = filtered.filter((r) => {
      const fileType = r.metadata?.fileType;
      return (
        typeof fileType === 'string' && filters.fileTypes!.includes(fileType)
      );
    });
  }

  if (filters.dateRange) {
    filtered = filtered.filter((r) => {
      const createdAt = r.metadata?.createdAt;
      if (
        typeof createdAt === 'string' ||
        typeof createdAt === 'number' ||
        createdAt instanceof Date
      ) {
        const date = new Date(createdAt);
        return (
          date >= filters.dateRange!.start && date <= filters.dateRange!.end
        );
      }
      return false;
    });
  }

  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter((r) => {
      const docTags = r.metadata?.tags;
      if (Array.isArray(docTags)) {
        return filters.tags!.some((tag) => docTags.includes(tag));
      }
      return false;
    });
  }

  if (filters.minScore !== undefined) {
    filtered = filtered.filter((r) => r.score >= filters.minScore!);
  }

  return filtered;
}

/**
 * Main retrieval pipeline with query rewriting and reranking
 */
export interface RetrievalPipelineConfig {
  queryRewriting?: boolean;
  rewriteStrategy?: QueryRewriteConfig['strategy'];
  reranking?: boolean;
  rerankingMethod?: 'semantic' | 'cross-encoder' | 'diversity';
  metadataFilters?: Parameters<typeof applyMetadataFilters>[1];
  topK?: number;
}

/**
 * Enhanced retrieval using OpenAI Assistants API with file search
 * This replaces the non-existent vectorStores.search() API
 */
export async function enhancedRetrieval(
  query: string,
  vectorStoreId: string,
  openai: OpenAI,
  config: RetrievalPipelineConfig = {}
): Promise<RetrievalResult[]> {
  const {
    queryRewriting = true,
    rewriteStrategy = 'expansion',
    reranking = true,
    rerankingMethod = 'semantic',
    metadataFilters,
    topK = 5,
  } = config;

  try {
    // Step 1: Query Rewriting
    let queries = [query];
    if (queryRewriting) {
      queries = await rewriteQuery(
        query,
        { strategy: rewriteStrategy },
        openai
      );
    }

    // Step 2: Use OpenAI Assistants API for file search
    const allResults: RetrievalResult[] = [];

    for (const q of queries) {
      try {
        // Create a temporary assistant with file search capability
        const assistant = await openai.beta.assistants.create({
          model: 'gpt-4o-mini',
          tools: [{ type: 'file_search' }],
          tool_resources: {
            file_search: {
              vector_store_ids: [vectorStoreId],
            },
          },
        });

        // Create a thread with the query
        const thread = await openai.beta.threads.create({
          messages: [
            {
              role: 'user',
              content: q,
            },
          ],
        });

        // Run the assistant
        const run = await openai.beta.threads.runs.create(thread.id, {
          assistant_id: assistant.id,
        });

        // Wait for completion
        let runStatus = await openai.beta.threads.runs.retrieve(run.id, {
          thread_id: thread.id,
        });
        while (
          runStatus.status === 'in_progress' ||
          runStatus.status === 'queued'
        ) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          runStatus = await openai.beta.threads.runs.retrieve(run.id, {
            thread_id: thread.id,
          });
        }

        if (runStatus.status === 'completed') {
          // Get the assistant's response with file citations
          const messages = await openai.beta.threads.messages.list(thread.id);
          const assistantMessage = messages.data.find(
            (msg) => msg.role === 'assistant'
          );

          if (assistantMessage && assistantMessage.content) {
            // Extract file citations from the response
            const results = extractFileSearchResults(assistantMessage, q);
            allResults.push(...results);
          }
        }

        // Clean up the temporary assistant
        await openai.beta.assistants.delete(assistant.id);
      } catch (error) {
        console.error(`Error searching vector store with query "${q}":`, error);
        // Continue with other queries even if one fails
      }
    }

    // Remove duplicates
    const uniqueResults = Array.from(
      new Map(allResults.map((r) => [r.id, r])).values()
    );

    // Step 3: Apply Metadata Filters
    let filtered = uniqueResults;
    if (metadataFilters) {
      filtered = applyMetadataFilters(filtered, metadataFilters);
    }

    // Step 4: Reranking
    let reranked = filtered;
    if (reranking && filtered.length > 0) {
      switch (rerankingMethod) {
        case 'semantic':
          reranked = await rerankResults(query, filtered, openai, topK);
          break;
        case 'cross-encoder':
          reranked = await crossEncoderRerank(query, filtered, openai);
          break;
        case 'diversity':
          reranked = diversityRerank(filtered);
          break;
      }
    }

    return reranked.slice(0, topK);
  } catch (error) {
    console.error('Enhanced retrieval failed:', error);
    return [];
  }
}

/**
 * Extract file search results from assistant message with citations
 */
function extractFileSearchResults(
  assistantMessage: any,
  originalQuery: string
): RetrievalResult[] {
  const results: RetrievalResult[] = [];

  if (!(assistantMessage.content && Array.isArray(assistantMessage.content))) {
    return results;
  }

  for (const contentItem of assistantMessage.content) {
    if (contentItem.type === 'text' && contentItem.text) {
      const textContent = contentItem.text.value || '';
      const annotations = contentItem.text.annotations || [];

      // Extract file citations
      for (const annotation of annotations) {
        if (annotation.type === 'file_citation' && annotation.file_citation) {
          const citation = annotation.file_citation;
          results.push({
            id: citation.file_id || `result-${Date.now()}-${Math.random()}`,
            content: citation.quote || textContent.substring(0, 500),
            score: 0.8, // Default score, could be improved with actual relevance scoring
            metadata: {
              file_id: citation.file_id,
              quote: citation.quote,
              annotation_text: annotation.text,
            },
            file_id: citation.file_id,
            file_name: `Document ${citation.file_id?.substring(0, 8)}`,
          });
        }
      }

      // If no citations but we have content, create a general result
      if (annotations.length === 0 && textContent.length > 0) {
        results.push({
          id: `general-${Date.now()}-${Math.random()}`,
          content: textContent.substring(0, 500),
          score: 0.6,
          metadata: {
            type: 'general_response',
            query: originalQuery,
          },
          file_id: 'general',
          file_name: 'Assistant Response',
        });
      }
    }
  }

  return results;
}
