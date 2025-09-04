#!/usr/bin/env bun

/**
 * Test script for GPT-5 model family with AI SDK v5
 * Tests direct OpenAI API integration for gpt-5, gpt-5-mini, and gpt-5-nano
 */

import { openai } from '@ai-sdk/openai';
import { generateText, streamText } from 'ai';

// Load environment variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY environment variable is required');
  process.exit(1);
}

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

// Test models
const testModels = [
  { id: 'gpt-5-mini', name: 'GPT-5 Mini (Default)', isDefault: true },
  { id: 'gpt-5', name: 'GPT-5' },
  { id: 'gpt-5-nano', name: 'GPT-5 Nano' },
];

async function testModel(modelId: string, modelName: string) {
  console.log(`\n${colors.cyan}Testing ${modelName}...${colors.reset}`);

  try {
    // Test 1: Basic text generation
    console.log(`${colors.blue}Test 1: Basic text generation${colors.reset}`);
    const model = openai.responses(modelId as any);

    const result = await generateText({
      model,
      prompt: 'Write a haiku about AI',
      providerOptions: {
        openai: {
          textVerbosity: 'low',
          reasoningSummary: 'auto',
        },
      },
    });

    console.log(`${colors.green}✓ Text generation successful${colors.reset}`);
    console.log(`Response: ${result.text.slice(0, 100)}...`);
    console.log(`Tokens used: ${result.usage?.totalTokens || 'N/A'}`);

    // Test 2: Streaming
    console.log(`\n${colors.blue}Test 2: Streaming response${colors.reset}`);
    const streamResult = await streamText({
      model,
      prompt: 'Count to 3',
      providerOptions: {
        openai: {
          textVerbosity: 'low',
        },
      },
    });

    let streamedText = '';
    for await (const delta of streamResult.textStream) {
      streamedText += delta;
    }

    console.log(`${colors.green}✓ Streaming successful${colors.reset}`);
    console.log(`Streamed response: ${streamedText.slice(0, 50)}...`);

    // Test 3: Structured output with JSON
    console.log(
      `\n${colors.blue}Test 3: Structured JSON output${colors.reset}`
    );
    const structuredResult = await generateText({
      model,
      prompt: 'Generate a simple user object with name and age as JSON',
      providerOptions: {
        openai: {
          textVerbosity: 'low',
          responseFormat: { type: 'json_object' },
        },
      },
    });

    console.log(`${colors.green}✓ Structured output successful${colors.reset}`);
    try {
      const parsed = JSON.parse(structuredResult.text);
      console.log(`Parsed JSON:`, parsed);
    } catch {
      console.log(`Raw response: ${structuredResult.text.slice(0, 100)}...`);
    }

    return true;
  } catch (error: any) {
    console.error(`${colors.red}❌ Error testing ${modelName}:${colors.reset}`);
    console.error(`Error message: ${error.message}`);

    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Response data:`, error.response.data);
    }

    if (error.cause) {
      console.error(`Cause:`, error.cause);
    }

    return false;
  }
}

async function testChatCompletion(modelId: string, modelName: string) {
  console.log(
    `\n${colors.cyan}Testing Chat Completions API for ${modelName}...${colors.reset}`
  );

  try {
    // Use the chat() method to explicitly use chat completions API
    const model = openai.chat(modelId as any);

    const result = await generateText({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant.',
        },
        {
          role: 'user',
          content: 'Say hello',
        },
      ],
    });

    console.log(
      `${colors.green}✓ Chat completions API successful${colors.reset}`
    );
    console.log(`Response: ${result.text.slice(0, 100)}...`);
    return true;
  } catch (error: any) {
    console.error(
      `${colors.yellow}⚠ Chat completions API failed (expected for GPT-5):${colors.reset}`
    );
    console.error(`Error: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log(
    `${colors.cyan}=== GPT-5 Model Family Test Suite ===${colors.reset}`
  );
  console.log(`Using AI SDK v5 with Responses API`);
  console.log(`API Key: ${OPENAI_API_KEY.slice(0, 10)}...`);

  const results: Record<string, boolean> = {};

  for (const { id, name, isDefault } of testModels) {
    console.log(`\n${colors.yellow}${'='.repeat(50)}${colors.reset}`);
    console.log(
      `${colors.cyan}Testing ${name}${isDefault ? ' (DEFAULT MODEL)' : ''}${colors.reset}`
    );
    console.log(`Model ID: ${id}`);
    console.log(`${colors.yellow}${'='.repeat(50)}${colors.reset}`);

    // Test Responses API (recommended for GPT-5)
    const responsesSuccess = await testModel(id, `${name} - Responses API`);
    results[`${id}-responses`] = responsesSuccess;

    // Test Chat Completions API (for compatibility check)
    const chatSuccess = await testChatCompletion(id, `${name} - Chat API`);
    results[`${id}-chat`] = chatSuccess;
  }

  // Summary
  console.log(`\n${colors.cyan}${'='.repeat(50)}${colors.reset}`);
  console.log(`${colors.cyan}Test Summary${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}`);

  for (const [key, success] of Object.entries(results)) {
    const status = success
      ? `${colors.green}✓ PASS${colors.reset}`
      : `${colors.red}✗ FAIL${colors.reset}`;
    console.log(`${key}: ${status}`);
  }

  const allResponsesPass = testModels.every(
    (m) => results[`${m.id}-responses`]
  );

  if (allResponsesPass) {
    console.log(
      `\n${colors.green}✅ All GPT-5 models are working with Responses API!${colors.reset}`
    );
    console.log(`\n${colors.cyan}Recommendations:${colors.reset}`);
    console.log(
      `• Use gpt-5-mini as the default model (best balance of speed/cost/capability)`
    );
    console.log(`• Use openai.responses() for GPT-5 models`);
    console.log(
      `• Configure textVerbosity and reasoningSummary for optimal results`
    );
  } else {
    console.log(
      `\n${colors.red}⚠️  Some tests failed. Check your API key and model access.${colors.reset}`
    );
  }
}

// Run the tests
main().catch(console.error);
