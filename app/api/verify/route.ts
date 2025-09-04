import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
} from 'ai';

export async function POST(req: Request) {
  // Parse request for debugging
  const _body = await req.json();

  // Create a comprehensive test that mimics real AI SDK v5 responses
  const stream = createUIMessageStream({
    async execute({ writer }) {
      const messageId = `verify-msg-${Date.now()}`;
      const reasoningId = generateId();
      const textId = generateId();

      // 1. Send message start
      writer.write({
        type: 'start',
        messageId,
      });

      // 2. Send reasoning tokens (these should show in reasoning section)
      // Use the SAME id for all reasoning deltas in the same block
      writer.write({
        type: 'reasoning-delta',
        delta: "I need to think about this user's request carefully. ",
        id: reasoningId,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      writer.write({
        type: 'reasoning-delta',
        delta:
          'Let me consider the best way to demonstrate that both reasoning and final responses work correctly. ',
        id: reasoningId,
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      writer.write({
        type: 'reasoning-delta',
        delta:
          'I should provide a clear response that shows the chat interface is functioning properly.',
        id: reasoningId,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      // 3. Send the main response text (this should show in main content area)
      const responseWords = [
        'Hello!',
        'I',
        'can',
        'confirm',
        'that',
        'both',
        'reasoning',
        'tokens',
        'and',
        'final',
        'responses',
        'are',
        'working',
        'correctly.',
        'The',
        'AI',
        'SDK',
        'v5',
        'integration',
        'is',
        'functioning',
        'as',
        'expected.',
      ];

      // Use the SAME id for all text deltas in the same response
      for (const word of responseWords) {
        await new Promise((resolve) => setTimeout(resolve, 25));
        writer.write({
          type: 'text-delta',
          delta: `${word} `,
          id: textId,
        });
      }

      // 4. Send finish
      writer.write({
        type: 'finish',
      });
    },
    onError: (error: unknown) => {
      return error instanceof Error ? error.message : String(error);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
