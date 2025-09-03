import { createUIMessageStream, createUIMessageStreamResponse } from 'ai';
import { generateId } from 'ai';

export async function POST(req: Request) {
  // Parse request for debugging
  const body = await req.json();
  console.log('Test API received:', body);

  // Create a simple UI message stream
  const stream = createUIMessageStream({
    async execute({ writer }) {
      const messageId = 'test-msg-' + Date.now();
      
      // Send a message start
      writer.write({
        type: 'start',
        messageId,
      });

      // Simulate streaming text
      const words = 'Hello! This is a test response from the mock API. The chat interface should display this message properly.'.split(' ');
      
      for (const word of words) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for streaming effect
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