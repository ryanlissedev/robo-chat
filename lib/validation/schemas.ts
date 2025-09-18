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

const UIMessageSchema = z
  .object({
    id: z.string(),
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string().optional().default(''),
    createdAt: z.preprocess(
      (arg) =>
        typeof arg === 'string' || arg instanceof Date
          ? new Date(arg)
          : undefined,
      z.date().optional()
    ),
    parts: z.array(MessagePartSchema).optional().default([]),
    experimentalAttachments: z.array(z.any()).optional(),
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
  .passthrough();

export const ChatRequestSchema = z
  .object({
    messages: z.array(UIMessageSchema),
    chatId: z.string().default(''),
    userId: z.string().default('guest_user'),
    model: z.string(),
    isAuthenticated: z.boolean(),
    systemPrompt: z.string(),
    enableSearch: z.boolean(),
    messageGroupId: z.string().optional(),
    reasoningEffort: z.enum(['low', 'medium', 'high']).optional(),
    verbosity: z.enum(['low', 'medium', 'high']).optional(),
    reasoningSummary: z.enum(['auto', 'detailed']).optional(),
    context: z.enum(['chat']).optional(),
    personalityMode: z
      .enum(['safety-focused', 'technical-expert', 'friendly-assistant'])
      .optional(),
  })
  .passthrough();
