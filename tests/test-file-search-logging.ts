#!/usr/bin/env tsx

/**
 * Test script to debug file search tool responses
 * This will help us see what's being returned and why sources/thinking traces aren't showing
 */

import { fileSearchTool } from '../lib/tools/file-search';

// Set up environment
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-key';

async function testFileSearch() {
  console.log('\n🔍 Testing File Search Tool with Logging\n');
  console.log('=' .repeat(60));
  
  try {
    // Test with a simple query
    const testQuery = 'test document search query';
    
    console.log('📝 Test Query:', testQuery);
    console.log('🔧 Configuration:');
    console.log('  - Enable Rewriting: true');
    console.log('  - Rewrite Strategy: expansion');
    console.log('  - Enable Reranking: true');
    console.log('  - Reranking Method: semantic');
    console.log('  - Max Results: 5');
    console.log('\n' + '-'.repeat(60));
    
    // Execute the file search
    console.log('\n🚀 Executing file search...\n');
    
    // Access the execute function from the tool definition
    const executeFunction = (fileSearchTool as any).execute;
    if (!executeFunction) {
      throw new Error('Execute function not found on fileSearchTool');
    }
    
    const result = await executeFunction({
      query: testQuery,
      max_results: 5,
      enable_rewriting: true,
      rewrite_strategy: 'expansion',
      enable_reranking: true,
      reranking_method: 'semantic',
    }, {});
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESULT STRUCTURE:');
    console.log('=' .repeat(60));
    
    // Display the result structure
    console.log('\n🔹 Top-level keys:', Object.keys(result));
    console.log('\n🔹 Full result object:');
    console.log(JSON.stringify(result, null, 2));
    
    // Check for specific fields
    console.log('\n' + '-'.repeat(60));
    console.log('🔍 FIELD ANALYSIS:');
    console.log('-' .repeat(60));
    
    console.log('\n✅ Success:', result.success);
    console.log('📝 Query:', result.query);
    console.log('🔄 Enhanced Query:', result.enhanced_query);
    console.log('📊 Total Results:', result.total_results);
    console.log('📋 Summary:', result.summary);
    
    if (result.search_config) {
      console.log('\n⚙️ Search Config:');
      console.log(JSON.stringify(result.search_config, null, 2));
    }
    
    if (result.results && result.results.length > 0) {
      console.log('\n📄 Results (first item structure):');
      console.log(JSON.stringify(result.results[0], null, 2));
      
      console.log('\n🔹 Result item keys:', Object.keys(result.results[0]));
    }
    
    // Check for sources or thinking traces
    console.log('\n' + '-'.repeat(60));
    console.log('🎯 SOURCES & THINKING TRACES CHECK:');
    console.log('-' .repeat(60));
    
    const hasSourcesField = 'sources' in result;
    const hasThinkingField = 'thinking' in result || 'reasoning' in result;
    const hasTracesField = 'traces' in result;
    
    console.log('\n❓ Has "sources" field:', hasSourcesField);
    console.log('❓ Has "thinking" or "reasoning" field:', hasThinkingField);
    console.log('❓ Has "traces" field:', hasTracesField);
    
    // Check if sources might be nested in results
    if (result.results && result.results.length > 0) {
      const firstResult = result.results[0];
      console.log('\n🔍 Checking first result for nested fields:');
      console.log('  - Has sources:', 'sources' in firstResult);
      console.log('  - Has url:', 'url' in firstResult);
      console.log('  - Has metadata:', 'metadata' in firstResult);
      
      if (firstResult.metadata) {
        console.log('  - Metadata keys:', Object.keys(firstResult.metadata));
      }
    }
    
    // Check for error details
    if (result.error) {
      console.log('\n❌ Error:', result.error);
    }
    
  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ Test Complete');
  console.log('=' .repeat(60) + '\n');
}

// Run the test
testFileSearch().catch(console.error);