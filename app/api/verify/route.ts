import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { generateId } from 'ai';

export async function POST(req: Request) {
  // Parse request for debugging  
  const body = await req.json();
  console.log('Verify API received:', body);

  // Create a comprehensive test that mimics real AI SDK v5 responses
  const stream = createUIMessageStream({
    async execute({ writer }) {
      const messageId = 'verify-msg-' + Date.now();
      
      // 1. Send message start
      writer.write({
        type: 'start',
        messageId,
      });

      console.log('✓ Sent message start');

      // 2. Send reasoning tokens (these should show in reasoning section)
      writer.write({
        type: 'reasoning-delta',
        delta: 'I need to think about this user\'s request carefully. ',
        id: generateId(),
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      writer.write({
        type: 'reasoning-delta', 
        delta: 'Let me consider the best way to demonstrate that both reasoning and final responses work correctly. ',
        id: generateId(),
      });

      await new Promise(resolve => setTimeout(resolve, 50));

      writer.write({
        type: 'reasoning-delta',
        delta: 'I should provide a clear response that shows the chat interface is functioning properly.',
        id: generateId(),
      });

      console.log('✓ Sent reasoning tokens');

      await new Promise(resolve => setTimeout(resolve, 100));

      // 3. Send the main response text (this should show in main content area)  
      const responseWords = [
        'Hello!', 'I', 'can', 'confirm', 'that', 'both', 'reasoning', 'tokens', 'and', 
        'final', 'responses', 'are', 'working', 'correctly.', 'The', 'AI', 'SDK', 'v5', 
        'integration', 'is', 'functioning', 'as', 'expected.'
      ];
      
      for (const word of responseWords) {
        await new Promise(resolve => setTimeout(resolve, 25));
        writer.write({
          type: 'text-delta',
          delta: word + ' ',
          id: generateId(),
        });
      }

      console.log('✓ Sent response text');

      // 4. Send finish
      writer.write({
        type: 'finish',
      });

      console.log('✓ Sent finish');
    },
    onError: (error: unknown) => {
      console.error('Stream error:', error);
      return error instanceof Error ? error.message : String(error);
    },
  });

  return createUIMessageStreamResponse({ stream });
}