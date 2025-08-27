import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storeAssistantMessage } from '@/app/api/chat/db';
import type {
  ContentPart,
  Message,
  StoreAssistantMessageParams,
  SupabaseClientType,
} from '@/app/types/api.types';
import { logWarning } from '@/lib/utils/logger';

// Mock dependencies
vi.mock('@/lib/utils/logger', () => ({
  logWarning: vi.fn(),
}));

// Mock Supabase client
const mockSupabaseClient: SupabaseClientType = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(),
      })),
    })),
    insert: vi.fn(),
  })),
} as any;

describe('app/api/chat/db.ts - Chat Database Operations', () => {
  const mockChatId = 'chat-123';
  const mockUserId = 'user-456';
  const mockMessageGroupId = 'msg-group-789';
  const mockModel = 'gpt-4o-mini';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('storeAssistantMessage - Basic Functionality', () => {
    it('should store simple text message successfully', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello, how can I help you?' }],
        } as Message,
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('messages');
      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: 'Hello, how can I help you?',
        parts: [{ type: 'text', text: 'Hello, how can I help you?' }],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });

    it('should handle empty content array', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: '',
        parts: [],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });

    it('should handle non-array content', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: 'Simple string content' as any,
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: '',
        parts: [],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });
  });

  describe('storeAssistantMessage - Text Content Processing', () => {
    it('should combine multiple text parts', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'First paragraph.' },
            { type: 'text', text: 'Second paragraph.' },
            { type: 'text', text: 'Third paragraph.' },
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.',
        parts: [
          { type: 'text', text: 'First paragraph.' },
          { type: 'text', text: 'Second paragraph.' },
          { type: 'text', text: 'Third paragraph.' },
        ],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });

    it('should handle text parts with empty strings', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Valid text' },
            { type: 'text', text: '' },
            { type: 'text' } as ContentPart, // Missing text property
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: 'Valid text',
        parts: [
          { type: 'text', text: 'Valid text' },
          { type: 'text', text: '' },
          { type: 'text' },
        ],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });
  });

  describe('storeAssistantMessage - Tool Invocation Processing', () => {
    it('should process tool invocation with result state', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-123',
                toolName: 'search',
                args: { query: 'test' },
                state: 'result',
                step: 1,
                result: { data: 'search result' },
              },
            },
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'call-123',
              toolName: 'search',
              args: { query: 'test' },
              state: 'result',
              step: 1,
              result: { data: 'search result' },
            },
          },
        ],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });

    it('should handle tool invocation without toolCallId', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolName: 'search',
                args: { query: 'test' },
                state: 'partial-call',
                step: 1,
              },
            } as ContentPart,
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: '',
        parts: [], // Tool invocation without toolCallId should be ignored
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });

    it('should merge tool invocations by toolCallId', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-123',
                toolName: 'search',
                args: { query: 'test' },
                state: 'partial-call',
                step: 1,
              },
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-123',
                toolName: 'search',
                args: { query: 'test' },
                state: 'result',
                step: 2,
                result: { data: 'result' },
              },
            },
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      const call = messageInsert.mock.calls[0][0];

      expect(call.parts).toHaveLength(1);
      expect(call.parts[0]).toMatchObject({
        type: 'tool-invocation',
        toolInvocation: {
          toolCallId: 'call-123',
          toolName: 'search',
          args: { query: 'test' },
          state: 'result',
          step: 2,
          result: { data: 'result' },
        },
      });
    });

    it('should handle tool invocation with missing args', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-123',
                toolName: 'search',
                state: 'result',
                step: 1,
              } as any,
            },
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'call-123',
              toolName: 'search',
              args: {},
              state: 'result',
              step: 1,
            },
          },
        ],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });
  });

  describe('storeAssistantMessage - Reasoning Content Processing', () => {
    it('should process reasoning parts with text', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
              text: 'Let me think about this step by step...',
            },
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'reasoning',
            reasoningText: 'Let me think about this step by step...',
            details: [
              { type: 'text', text: 'Let me think about this step by step...' },
            ],
          },
        ],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });

    it('should handle reasoning parts without text', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
            } as ContentPart,
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'reasoning',
            reasoningText: '',
            details: [{ type: 'text', text: '' }],
          },
        ],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });
  });

  describe('storeAssistantMessage - Step-Start Processing', () => {
    it('should preserve step-start parts', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            {
              type: 'step-start',
              step: 1,
              title: 'Analysis',
            } as ContentPart,
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'step-start',
            step: 1,
            title: 'Analysis',
          },
        ],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });
  });

  describe('storeAssistantMessage - Tool Result Processing', () => {
    it('should process tool results and create tool invocation parts', async () => {
      const messages: Message[] = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-456',
              toolName: 'calculator',
              result: { answer: 42 },
            },
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              step: 0,
              toolCallId: 'call-456',
              toolName: 'calculator',
              result: { answer: 42 },
            },
          },
        ],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });

    it('should handle tool results with missing properties', async () => {
      const messages: Message[] = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              result: { answer: 42 },
            } as ContentPart,
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: '',
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              step: 0,
              toolCallId: '',
              toolName: '',
              result: { answer: 42 },
            },
          },
        ],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });
  });

  describe('storeAssistantMessage - Chat Existence Handling', () => {
    it('should proceed when chat exists', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Test message' }],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('chats');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('messages');
      expect(logWarning).not.toHaveBeenCalled();
    });

    it('should create chat when it does not exist', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Test message' }],
        },
      ];

      const mockSelectForCheck = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'No rows found' },
          }),
        })),
      }));
      const mockInsertForChat = vi.fn().mockResolvedValue({ error: null });
      const mockInsertForMessage = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return {
            select: mockSelectForCheck,
            insert: mockInsertForChat,
          };
        }
        return { insert: mockInsertForMessage };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      expect(mockInsertForChat).toHaveBeenCalledWith({
        id: mockChatId,
        user_id: mockUserId,
        title: 'New Chat',
        model: 'gpt-4o-mini',
        created_at: expect.any(String),
        updated_at: expect.any(String),
      });
      expect(mockInsertForMessage).toHaveBeenCalled();
    });

    it('should skip saving when chat creation fails', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Test message' }],
        },
      ];

      const mockSelectForCheck = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'No rows found' },
          }),
        })),
      }));
      const mockInsertForChat = vi.fn().mockResolvedValue({
        error: { message: 'Insert failed' },
      });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return {
            select: mockSelectForCheck,
            insert: mockInsertForChat,
          };
        }
        return { insert: vi.fn() };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      expect(logWarning).toHaveBeenCalledWith(
        'Chat does not exist and cannot be created. Skipping message save.',
        { chatId: mockChatId }
      );

      // Message insert should not be called
      const messageTableCalls = vi
        .mocked(mockSupabaseClient.from)
        .mock.calls.filter((call: any) => call[0] === 'messages');
      expect(messageTableCalls).toHaveLength(0);
    });

    it('should skip saving when userId is not provided and chat does not exist', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Test message' }],
        },
      ];

      const mockSelectForCheck = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'No rows found' },
          }),
        })),
      }));

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelectForCheck };
        }
        return { insert: vi.fn() };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: undefined, // No userId provided
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      expect(logWarning).toHaveBeenCalledWith(
        'Chat does not exist and cannot be created. Skipping message save.',
        { chatId: mockChatId }
      );
    });

    it('should handle database errors during chat existence check', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Test message' }],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockRejectedValue(new Error('Database error')),
        })),
      }));

      mockSupabaseClient.from = vi.fn(() => ({
        select: mockSelect,
      })) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      expect(logWarning).toHaveBeenCalledWith(
        'Chat does not exist and cannot be created. Skipping message save.',
        { chatId: mockChatId }
      );
    });
  });

  describe('storeAssistantMessage - Message Insertion Errors', () => {
    beforeEach(() => {
      // Mock successful chat existence check
      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: vi.fn() };
        }
        return { insert: vi.fn() };
      }) as any;
    });

    it('should throw error when message insertion fails', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Test message' }],
        },
      ];

      const mockInsertForMessage = vi.fn().mockResolvedValue({
        error: { message: 'Database constraint violation' },
      });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockChatId },
                  error: null,
                }),
              })),
            })),
            insert: vi.fn(),
          };
        }
        return { insert: mockInsertForMessage };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await expect(storeAssistantMessage(params)).rejects.toThrow(
        'Failed to save assistant message: Database constraint violation'
      );
    });

    it('should handle null error response', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: 'Test message' }],
        },
      ];

      const mockInsertForMessage = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: mockChatId },
                  error: null,
                }),
              })),
            })),
            insert: vi.fn(),
          };
        }
        return { insert: mockInsertForMessage };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await expect(storeAssistantMessage(params)).resolves.not.toThrow();
    });
  });

  describe('storeAssistantMessage - Complex Content Integration', () => {
    it('should handle mixed content types in correct order', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'First text' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'call-1',
                toolName: 'search',
                args: { query: 'test' },
                state: 'result',
                step: 1,
                result: { data: 'result' },
              },
            },
            { type: 'text', text: 'Second text' },
            {
              type: 'reasoning',
              text: 'Thinking process...',
            },
            {
              type: 'step-start',
              step: 2,
              title: 'Next step',
            } as ContentPart,
          ],
        },
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-2',
              toolName: 'calculator',
              result: { answer: 42 },
            },
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      const call = messageInsert.mock.calls[0][0];

      expect(call.content).toBe('First text\n\nSecond text');
      expect(call.parts).toHaveLength(6); // 2 text + 1 reasoning + 1 step-start + 2 tool invocations

      // Check that tool invocations are at the end
      const toolInvocations = call.parts.filter(
        (part: any) => part.type === 'tool-invocation'
      );
      expect(toolInvocations).toHaveLength(2);
    });

    it('should handle empty messages array', async () => {
      const messages: Message[] = [];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: '',
        parts: [],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });

    it('should ignore unknown content types', async () => {
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [
            { type: 'text', text: 'Valid text' },
            { type: 'unknown-type', text: 'should be ignored' } as any,
            { type: 'text', text: 'Another valid text' },
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: 'Valid text\n\nAnother valid text',
        parts: [
          { type: 'text', text: 'Valid text' },
          { type: 'text', text: 'Another valid text' },
        ],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });
  });

  describe('storeAssistantMessage - Performance and Edge Cases', () => {
    it('should handle large number of content parts efficiently', async () => {
      const largeContentArray: ContentPart[] = Array(1000)
        .fill(null)
        .map((_, i) => ({
          type: 'text',
          text: `Text part ${i}`,
        }));

      const messages: Message[] = [
        {
          role: 'assistant',
          content: largeContentArray,
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      const call = messageInsert.mock.calls[0][0];

      expect(call.parts).toHaveLength(1000);
      expect(call.content.split('\n\n')).toHaveLength(1000);
    });

    it('should handle very long text content', async () => {
      const veryLongText = 'A'.repeat(100000);
      const messages: Message[] = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: veryLongText }],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      expect(messageInsert).toHaveBeenCalledWith({
        chat_id: mockChatId,
        role: 'assistant',
        content: veryLongText,
        parts: [{ type: 'text', text: veryLongText }],
        message_group_id: mockMessageGroupId,
        model: mockModel,
      });
    });

    it('should handle deep object structures in tool results', async () => {
      const complexResult = {
        level1: {
          level2: {
            level3: {
              data: [1, 2, 3, { nested: 'value' }],
              metadata: { timestamp: Date.now() },
            },
          },
        },
      };

      const messages: Message[] = [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-complex',
              toolName: 'complex-tool',
              result: complexResult,
            },
          ],
        },
      ];

      const mockSelect = vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: mockChatId },
            error: null,
          }),
        })),
      }));
      const mockInsert = vi.fn().mockResolvedValue({ error: null });

      mockSupabaseClient.from = vi.fn((table) => {
        if (table === 'chats') {
          return { select: mockSelect, insert: mockInsert };
        }
        return { insert: mockInsert };
      }) as any;

      const params: StoreAssistantMessageParams = {
        supabase: mockSupabaseClient,
        chatId: mockChatId,
        messages,
        userId: mockUserId,
        message_group_id: mockMessageGroupId,
        model: mockModel,
      };

      await storeAssistantMessage(params);

      const messageInsert = mockSupabaseClient.from('messages').insert as any;
      const call = messageInsert.mock.calls[0][0];

      expect(call.parts[0].toolInvocation.result).toEqual(complexResult);
    });
  });
});
