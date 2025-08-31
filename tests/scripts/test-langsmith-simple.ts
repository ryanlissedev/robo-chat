#!/usr/bin/env tsx

/**
 * Simple LangSmith connection test
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { Client } from 'langsmith';

// Load .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach((line) => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      process.env[key.trim()] = value.trim();
    }
  });
}

async function test() {
  console.log('API Key:', `${process.env.LANGSMITH_API_KEY?.slice(0, 10)}...`);
  console.log('Project:', process.env.LANGSMITH_PROJECT);
  console.log('Endpoint:', process.env.LANGSMITH_ENDPOINT);

  const client = new Client({
    apiKey: process.env.LANGSMITH_API_KEY!,
    apiUrl: process.env.LANGSMITH_ENDPOINT || 'https://api.smith.langchain.com',
  });

  try {
    // Try to list runs to verify connection
    console.log('\nTrying to list runs...');
    const _projectName = process.env.LANGSMITH_PROJECT || 'hgg-robo-chat';

    // Use hasDataset to check if we can connect
    console.log('\nChecking connection by querying datasets...');
    const hasTestDataset = await client.hasDataset({
      datasetName: 'test-dataset',
    });
    console.log(
      'Can query datasets:',
      typeof hasTestDataset === 'boolean' ? '✅' : '❌'
    );

    // Try creating a dataset as a simpler test
    console.log('\nTrying to create a test dataset...');
    const datasetName = `test-connection-${Date.now()}`;
    const dataset = await client.createDataset(datasetName, {
      description: 'Test dataset for connection verification',
    });
    console.log('Dataset created:', dataset ? '✅' : '❌');

    if (dataset) {
      // Clean up - delete the test dataset
      await client.deleteDataset({ datasetName });
      console.log('Dataset cleaned up: ✅');
    }

    console.log('\n✅ Successfully connected to LangSmith!');
    return true;
  } catch (error: any) {
    console.error('\n❌ Connection error:', error.message || error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', await error.response.text());
    }
    return false;
  }
}

test().then((success) => {
  process.exit(success ? 0 : 1);
});
