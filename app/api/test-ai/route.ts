import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function POST() {
  try {
    console.log('Testing AI SDK directly...');
    
    const result = streamText({
      model: openai('gpt-4o-mini'),
      prompt: 'Say hello world',
    });

    return result.toTextStreamResponse();
  } catch (error: unknown) {
    console.error('Direct AI SDK test error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}