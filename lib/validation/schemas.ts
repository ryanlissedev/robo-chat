import { z } from 'zod';

// More specific schemas for message parts to align with AI SDK types
const TextPartSchema = z.object({ type: z.literal('text'), text: z.string() });
const ToolCallPartSchema = z
  .object({
    type: z.literal('tool-call'),
    toolCallId: z.string(),
    toolName: z.string(),
    args: z.any(),
  })
  .passthrough();

// A discriminated union is more accurate for message parts
const MessagePartSchema = z.discriminatedUnion('type', [
  TextPartSchema.passthrough(),
  ToolCallPartSchema.passthrough(),
]);

// Loosen constraints to allow upstream transformers to normalize content
const UIMessageSchema = z
  .object({
    id: z.string().optional(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.unknown().optional(),
    createdAt: z.preprocess(
      (arg) =>
        typeof arg === 'string' || arg instanceof Date
          ? new Date(arg)
          : undefined,
      z.date().optional()
    ),
    parts: z.array(MessagePartSchema).optional(),
    experimental_attachments: z.array(z.any()).optional(),
    model: z.string().optional(),
    provider: z.string().optional(),
    reasoning: z
      .array(z.object({ type: z.literal('text'), text: z.string() }))
      .optional(),
    langsmithRunId: z.string().nullable().optional(),
    updatedAt: z.preprocess(
      (arg) =>
        typeof arg === 'string' || arg instanceof Date
          ? new Date(arg)
          : undefined,
      z.date().optional()
    ),
  })
  .passthrough()
  .transform((data) => {
    const { experimentalAttachments, ...rest } = data as any;
    return {
      ...rest,
      experimentalAttachments,
    };
  });

export const ChatRequestSchema = z
  .object({
    messages: z
      .array(z.any())
      .nonempty({ message: 'missing or invalid messages' }),
    chatId: z.string().min(1, { message: 'missing chatId or userId' }),
    userId: z.string().min(1, { message: 'missing chatId or userId' }),
    model: z.string(),
    isAuthenticated: z.boolean(),
    systemPrompt: z.string(),
    enableSearch: z.boolean(),
    message_group_id: z.string().optional(),
    reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
    verbosity: z.enum(['low', 'medium', 'high']).optional(),
    reasoningSummary: z.enum(['auto', 'detailed']).optional(),
    context: z.enum(['chat']).optional(),
    personalityMode: z
      .enum(['safety-focused', 'technical-expert', 'friendly-assistant'])
      .optional(),
  })
  .transform((data) => {
    const { message_group_id: messageGroupId, ...rest } = data as any;
    return {
      ...rest,
      messageGroupId,
    };
  });
