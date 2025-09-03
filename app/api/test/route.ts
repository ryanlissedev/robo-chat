import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { generateId } from 'ai';

export async function POST(req: Request) {
  // Parse request for debugging
  const body = await req.json();
  console.log('Test API received:', body);

  // Create a realistic AI SDK v5 UI message stream with reasoning
  const stream = createUIMessageStream({
    async execute({ writer }) {
      const messageId = 'test-msg-' + Date.now();
      
      // Send message start
      writer.write({
        type: 'start',
        messageId,
      });

      // Send reasoning token (for models that support it)
      writer.write({
        type: 'reasoning-delta',
        delta: 'The user is asking for a test response. I should provide a helpful response that demonstrates the chat interface is working correctly. Let me think about what would be most useful to show...',
        id: generateId(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // More reasoning
      writer.write({
        type: 'reasoning-delta', 
        delta: ' I should include both a greeting and confirmation that the system is functioning properly.',
        id: generateId(),
      });

      await new Promise(resolve => setTimeout(resolve, 100));

      // Now send the actual response text
      const responseText = 'Hello! This is a test response from the mock API. The reasoning tokens above should be visible, and this final response should display properly in the chat interface. The AI SDK v5 integration is working correctly!';
      const words = responseText.split(' ');
      
      for (const word of words) {
        await new Promise(resolve => setTimeout(resolve, 30));
        writer.write({
          type: 'text-delta',
          delta: word + ' ',
          id: generateId(),
        });
      }

      // Send finish
      writer.write({
        type: 'finish',
      });
    },
  });

  return createUIMessageStreamResponse({ stream });
}