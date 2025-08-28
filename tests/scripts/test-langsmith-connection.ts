#!/usr/bin/env tsx

/**
 * Test script to verify LangSmith connection and configuration
 */

import { Client } from 'langsmith';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      process.env[key.trim()] = value.trim();
    }
  });
}

// Check environment variables
console.log('=== Environment Variables ===');
console.log('LANGSMITH_API_KEY:', process.env.LANGSMITH_API_KEY ? '✅ Set' : '❌ Not set');
console.log('LANGSMITH_PROJECT:', process.env.LANGSMITH_PROJECT || '❌ Not set');
console.log('LANGSMITH_ENDPOINT:', process.env.LANGSMITH_ENDPOINT || 'https://api.smith.langchain.com');
console.log('LANGSMITH_TRACING:', process.env.LANGSMITH_TRACING || '❌ Not set');
console.log('LANGSMITH_TRACING_V2:', process.env.LANGSMITH_TRACING_V2 || '❌ Not set');

// Test connection
async function testLangSmithConnection() {
  console.log('\n=== Testing LangSmith Connection ===');
  
  if (!process.env.LANGSMITH_API_KEY) {
    console.error('❌ LANGSMITH_API_KEY is not set');
    return false;
  }

  try {
    const client = new Client({
      apiKey: process.env.LANGSMITH_API_KEY,
      apiUrl: process.env.LANGSMITH_ENDPOINT || 'https://api.smith.langchain.com',
    });

    // Test creating a dataset (minimal operation to verify connection)
    const projectName = process.env.LANGSMITH_PROJECT || 'test-connection';
    
    console.log(`Testing with project: ${projectName}`);
    
    // Create a test run - createRun returns the full run object
    const run = await client.createRun({
      name: 'test-connection',
      run_type: 'chain',
      inputs: { test: 'connection' },
      project_name: projectName,
    });

    // Extract the run ID from the response
    const runId = run.id;
    console.log('✅ Successfully created test run with ID:', runId);
    console.log('Full run object:', JSON.stringify(run, null, 2));
    
    // Update the run to complete it
    await client.updateRun(runId, {
      outputs: { status: 'connected' },
      end_time: new Date().toISOString(),
    });
    
    console.log('✅ Successfully updated run');
    console.log(`View in LangSmith: https://smith.langchain.com/o/${process.env.LANGSMITH_ORG || 'default'}/projects/p/${projectName}/runs/${runId}`);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to connect to LangSmith:', error);
    return false;
  }
}

// Run the test
testLangSmithConnection().then((success) => {
  if (success) {
    console.log('\n✅ LangSmith connection test passed!');
    process.exit(0);
  } else {
    console.log('\n❌ LangSmith connection test failed');
    process.exit(1);
  }
});