/**
 * Query Rewriting and Ranking for OpenAI Retrieval
 * Based on: https://platform.openai.com/docs/guides/retrieval
 */

import type OpenAI from 'openai';

export type QueryRewriteConfig = {
  strategy: 'expansion' | 'refinement' | 'decomposition' | 'multi-perspective';
  context?: string;
  previousQueries?: string[];
  domain?: string;
};

export type RetrievalResult = {
  id: string;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
  file_id?: string;
  file_name?: string;
};

/**
 * Query Expansion: Add synonyms and related terms
 */
export async function expandQuery(
  query: string,
  openai: OpenAI
): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-5-mini',
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
    model: 'gpt-5-mini',
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
    model: 'gpt-5-mini',
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
    model: 'gpt-5-mini',
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
    model: 'gpt-5-mini',
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
  if (results.length <= topK) {
    return results;
  }

  const response = await openai.chat.completions.create({
    model: 'gpt-5-mini',
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
      model: 'gpt-5-mini',
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
    .map(({ originalIndex: _originalIndex, ...rest }) => {
      void _originalIndex; // Mark as intentionally unused
      return rest;
    });
}

/**
 * Diversity-aware Reranking (MMR - Maximal Marginal Relevance)
 */
export function diversityRerank(
  results: RetrievalResult[],
  lambda = 0.5 // Balance between relevance and diversity
): RetrievalResult[] {
  if (results.length <= 1) {
    return results;
  }

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
    filtered = filtered.filter((r) =>
      filters.fileTypes?.includes(r.metadata?.fileType as string)
    );
  }

  if (filters.dateRange?.start && filters.dateRange.end) {
    const { start, end } = filters.dateRange;
    filtered = filtered.filter((r) => {
      const createdAt = r.metadata?.createdAt;
      if (!createdAt) {
        return false;
      }
      const date = new Date(createdAt as string | number | Date);
      return !Number.isNaN(date.getTime()) && date >= start && date <= end;
    });
  }

  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter((r) => {
      const docTags = r.metadata?.tags || [];
      return filters.tags?.some((tag) => (docTags as string[]).includes(tag));
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
export type RetrievalPipelineConfig = {
  queryRewriting?: boolean;
  rewriteStrategy?: QueryRewriteConfig['strategy'];
  reranking?: boolean;
  rerankingMethod?: 'semantic' | 'cross-encoder' | 'diversity';
  metadataFilters?: Parameters<typeof applyMetadataFilters>[1];
  topK?: number;
};

export async function enhancedRetrieval(
  query: string,
  _vectorStoreId: string,
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

  // Step 1: Query Rewriting
  let queries = [query];
  if (queryRewriting) {
    queries = await rewriteQuery(query, { strategy: rewriteStrategy }, openai);
  }

  // Step 2: Retrieval from Vector Store (OpenAI v5 stable search)
  const allResults: RetrievalResult[] = [];
  try {
    for (const q of queries) {
      const search = await openai.vectorStores.search(_vectorStoreId, {
        query: q,
        max_num_results: topK,
        rewrite_query: false,
        // Basic filter mapping: support single file type via eq comparison
        ...(metadataFilters?.fileTypes && metadataFilters.fileTypes.length === 1
          ? { filters: { type: 'eq', key: 'file_type', value: metadataFilters.fileTypes[0] } }
          : {}),
        ranking_options: {
          // Keep defaults; allow server-side ranker to decide
          ranker: 'auto',
        },
      });

      for (const [idx, item] of search.data.entries()) {
        const text = (item.content?.[0]?.text as string | undefined) || '';
        allResults.push({
          id: `${item.file_id}:${idx}`,
          file_id: item.file_id,
          file_name: item.filename,
          content: text,
          score: item.score,
          metadata: item.attributes as Record<string, unknown> | undefined,
        });
      }
    }
  } catch {
    // If search is unavailable, fall back to no results; reranking will be a no-op
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
  if (reranking) {
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
}
