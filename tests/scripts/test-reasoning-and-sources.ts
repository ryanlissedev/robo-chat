#!/usr/bin/env tsx
/**
 * Test script for reasoning models with file search
 * Tests that both reasoning and sources are properly handled
 */

// Read API key from environment or use a test key
const apiKey = process.env.OPENAI_API_KEY || '';

async function testReasoningWithSources() {
  if (!apiKey) {
    console.error('❌ OPENAI_API_KEY not found in environment');
    console.log('Please set OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  console.log('🧪 Testing reasoning model with file search...\n');

  // Test message that should trigger both reasoning and file search
  const testMessage = {
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content:
          'Search for information about the chat service implementation and explain how it handles streaming responses. Think through this step by step.',
        parts: [
          {
            type: 'text',
            text: 'Search for information about the chat service implementation and explain how it handles streaming responses. Think through this step by step.',
          },
        ],
      },
    ],
    chatId: 'test-chat-reasoning',
    userId: 'test-user',
    model: 'gpt-4o', // Use a standard model first to test
    isAuthenticated: false,
    enableSearch: true,
    reasoningEffort: 'high',
    verbosity: 'medium',
    reasoningSummary: 'auto',
  };

  try {
    // Call the API endpoint
    const response = await fetch('http://localhost:3005/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-provider-api-key': apiKey,
      },
      body: JSON.stringify(testMessage),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Read the streaming response
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let messageCount = 0;
    let hasReasoning = false;
    let hasContent = false;
    let hasSources = false;
    const toolInvocations: any[] = [];

    console.log('📡 Reading stream...\n');

    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete messages
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            messageCount++;

            // Check for different types of data
            if (parsed.type === 'reasoning') {
              hasReasoning = true;
              console.log(
                '🤔 Reasoning detected:',
                `${parsed.text?.substring(0, 100)}...`
              );
            }

            if (parsed.type === 'text-delta') {
              hasContent = true;
              process.stdout.write(parsed.textDelta || '');
            }

            if (parsed.type === 'tool-call') {
              toolInvocations.push(parsed);
              console.log('\n🔧 Tool call:', parsed.toolName);
            }

            if (parsed.type === 'tool-result') {
              if (parsed.toolName === 'file_search') {
                hasSources = true;
                console.log('\n📚 Sources found in tool result');
              }
            }

            // Check message parts for sources
            if (parsed.type === 'message' && parsed.message?.parts) {
              for (const part of parsed.message.parts) {
                if (
                  part.type === 'tool-invocation' &&
                  part.toolName === 'file_search'
                ) {
                  hasSources = true;
                  console.log('\n📚 File search invocation detected');
                }
              }
            }
          } catch (_e) {
            // Not JSON, skip
          }
        }
      }
    }

    console.log('\n\n📊 Results Summary:');
    console.log('─'.repeat(40));
    console.log(`✅ Messages received: ${messageCount}`);
    console.log(
      `${hasReasoning ? '✅' : '❌'} Reasoning detected: ${hasReasoning}`
    );
    console.log(`${hasContent ? '✅' : '❌'} Content detected: ${hasContent}`);
    console.log(`${hasSources ? '✅' : '❌'} Sources detected: ${hasSources}`);
    console.log(`🔧 Tool invocations: ${toolInvocations.length}`);

    if (toolInvocations.length > 0) {
      console.log('\nTool details:');
      toolInvocations.forEach((t) => {
        console.log(`  - ${t.toolName}: ${t.toolCallId}`);
      });
    }

    if (!hasContent && hasReasoning) {
      console.log('\n⚠️  WARNING: Reasoning was sent but no final content!');
      console.log('This might indicate an issue with the streaming response.');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Run the test
testReasoningWithSources().catch(console.error);
