#!/usr/bin/env node

/**
 * Test script to debug file search tool responses
 * This will help us see what's being returned and why sources/thinking traces aren't showing
 */

import { fileSearchTool } from '../lib/tools/file-search.js';

// Set up environment
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

async function testFileSearch() {
  try {
    // Test with a simple query
    const testQuery = 'test document search query';

    const result = await fileSearchTool.execute({
      query: testQuery,
      max_results: 5,
      enable_rewriting: true,
      rewrite_strategy: 'expansion',
      enable_reranking: true,
      reranking_method: 'semantic',
    });

    if (result.search_config) {
    }

    if (result.results && result.results.length > 0) {
    }

    const _hasSourcesField = 'sources' in result;
    const _hasThinkingField = 'thinking' in result || 'reasoning' in result;
    const _hasTracesField = 'traces' in result;

    // Check if sources might be nested in results
    if (result.results && result.results.length > 0) {
      const firstResult = result.results[0];

      if (firstResult.metadata) {
      }
    }

    // Check for error details
    if (result.error) {
    }
  } catch (error) {
    if (error.stack) {
    }
  }
}

// Run the test
testFileSearch().catch(console.error);
