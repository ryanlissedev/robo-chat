#!/usr/bin/env tsx

/**
 * Setup and configuration helper for OpenAI Vector Stores
 * Helps configure OPENAI_VECTOR_STORE_IDS environment variable
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from 'dotenv';
import OpenAI from 'openai';

config();

async function listVectorStores() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY is not set in environment');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  try {
    console.log('📚 Fetching Vector Stores...\n');
    const stores = await openai.vectorStores.list({ limit: 20 });

    if (stores.data.length === 0) {
      console.log('⚠️  No vector stores found');
      console.log('\n💡 Create a vector store using:');
      console.log('   - OpenAI Dashboard: https://platform.openai.com/storage');
      console.log('   - Or run: npm run setup:vector-store:create');
      return [];
    }

    console.log('Available Vector Stores:');
    console.log('========================\n');

    stores.data.forEach((store, index) => {
      console.log(`${index + 1}. ${store.name || 'Unnamed Store'}`);
      console.log(`   ID: ${store.id}`);
      console.log(`   Files: ${store.file_counts?.total || 0}`);
      console.log(`   Status: ${store.status}`);
      console.log(
        `   Created: ${new Date(store.created_at * 1000).toLocaleString()}`
      );
      if (store.metadata && Object.keys(store.metadata).length > 0) {
        console.log(`   Metadata:`, store.metadata);
      }
      console.log();
    });

    return stores.data;
  } catch (error) {
    console.error('❌ Error fetching vector stores:', error);
    process.exit(1);
  }
}

async function createVectorStore(name: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY is not set');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  try {
    console.log(`🔨 Creating vector store: "${name}"...`);

    const store = await openai.vectorStores.create({
      name,
      metadata: {
        created_by: 'setup-vector-stores.ts',
        purpose: 'file_search',
        created_at: new Date().toISOString(),
      },
    });

    console.log(`✅ Vector store created successfully!`);
    console.log(`   ID: ${store.id}`);
    console.log(`   Name: ${store.name}`);

    return store;
  } catch (error) {
    console.error('❌ Error creating vector store:', error);
    process.exit(1);
  }
}

async function updateEnvFile(vectorStoreIds: string[]) {
  const envPath = path.join(process.cwd(), '.env');

  try {
    let envContent = '';
    try {
      envContent = await fs.readFile(envPath, 'utf-8');
    } catch {
      console.log('📝 Creating new .env file...');
    }

    // Remove existing OPENAI_VECTOR_STORE_IDS if present
    const lines = envContent.split('\n');
    const filteredLines = lines.filter(
      (line) => !line.startsWith('OPENAI_VECTOR_STORE_IDS=')
    );

    // Add new vector store IDs
    filteredLines.push(`OPENAI_VECTOR_STORE_IDS=${vectorStoreIds.join(',')}`);

    const newContent = filteredLines.join('\n');
    await fs.writeFile(envPath, newContent);

    console.log(`✅ Updated .env file with vector store IDs`);
    console.log(`   OPENAI_VECTOR_STORE_IDS=${vectorStoreIds.join(',')}`);
  } catch (error) {
    console.error('❌ Error updating .env file:', error);
    console.log('\n💡 Add this line to your .env file manually:');
    console.log(`   OPENAI_VECTOR_STORE_IDS=${vectorStoreIds.join(',')}`);
  }
}

async function uploadTestFile(vectorStoreId: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY is not set');
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  try {
    console.log('📤 Uploading test file to vector store...');

    // Create a test file content
    const testContent = `
# TypeScript Best Practices

## 1. Type Safety
- Always use strict mode in tsconfig.json
- Prefer interfaces over type aliases for object shapes
- Use unknown instead of any when type is truly unknown
- Enable noImplicitAny and strictNullChecks

## 2. Code Organization
- Keep files under 500 lines
- Use barrel exports for cleaner imports
- Separate concerns: one class/component per file
- Group related functionality in modules

## 3. Error Handling
- Use proper error types and error boundaries
- Implement try-catch blocks for async operations
- Log errors with appropriate context
- Never silently swallow errors

## 4. Performance
- Use const assertions for literal types
- Implement proper memoization in React
- Avoid unnecessary type assertions
- Use discriminated unions for complex types

## 5. Testing
- Write tests before implementation (TDD)
- Aim for 80% code coverage minimum
- Test edge cases and error conditions
- Use proper mocking strategies
`;

    // Create a buffer from the content
    const buffer = Buffer.from(testContent, 'utf-8');
    const file = new File([buffer], 'typescript-best-practices.md', {
      type: 'text/markdown',
    });

    // Upload the file
    const uploadedFile = await openai.files.create({
      file: file as any,
      purpose: 'assistants',
    });

    console.log(`✅ File uploaded: ${uploadedFile.id}`);

    // Attach file to vector store
    await openai.vectorStores.files.create(vectorStoreId, {
      file_id: uploadedFile.id,
    });

    console.log(`✅ File attached to vector store`);

    // Wait for processing
    console.log('⏳ Waiting for file processing...');
    let attempts = 0;
    while (attempts < 30) {
      const vectorStoreFile = await openai.vectorStores.files.retrieve(
        vectorStoreId,
        uploadedFile.id
      );

      if (vectorStoreFile.status === 'completed') {
        console.log('✅ File processing completed!');
        break;
      } else if (vectorStoreFile.status === 'failed') {
        console.error('❌ File processing failed');
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }

    return uploadedFile.id;
  } catch (error) {
    console.error('❌ Error uploading test file:', error);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  console.log('🔧 OpenAI Vector Store Configuration Tool');
  console.log('=========================================\n');

  switch (command) {
    case 'list':
      await listVectorStores();
      break;

    case 'create': {
      const name =
        args[1] || `Robo Chat Vector Store ${new Date().toISOString()}`;
      const store = await createVectorStore(name);
      console.log('\n💡 To use this vector store, add to .env:');
      console.log(`   OPENAI_VECTOR_STORE_IDS=${store.id}`);
      break;
    }

    case 'setup': {
      const stores = await listVectorStores();
      if (stores.length > 0) {
        const ids = stores.map((s) => s.id);
        await updateEnvFile(ids);
      } else {
        console.log('\n🔨 Creating a new vector store for you...');
        const newStore = await createVectorStore(
          'Robo Chat Default Vector Store'
        );
        await updateEnvFile([newStore.id]);

        console.log('\n📤 Adding test content...');
        await uploadTestFile(newStore.id);
      }
      break;
    }

    case 'test-upload': {
      const vectorStoreId = args[1];
      if (!vectorStoreId) {
        console.error('❌ Please provide a vector store ID');
        console.log(
          '   Usage: npm run setup:vector-store:test-upload <vector-store-id>'
        );
        process.exit(1);
      }
      await uploadTestFile(vectorStoreId);
      break;
    }

    default:
      console.log('Available commands:');
      console.log('  list        - List all vector stores');
      console.log('  create      - Create a new vector store');
      console.log('  setup       - Auto-configure vector stores in .env');
      console.log('  test-upload - Upload test file to a vector store');
      console.log('\nExamples:');
      console.log('  npm run setup:vector-store:list');
      console.log('  npm run setup:vector-store:create "My Store Name"');
      console.log('  npm run setup:vector-store:setup');
      console.log('  npm run setup:vector-store:test-upload vs_xxxxx');
  }
}

main().catch(console.error);
