import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { RequestValidator } from '@/lib/services/RequestValidator';
import {
  validateAndTrackUsage,
  incrementMessageCount,
  logUserMessage,
} from '@/app/api/chat/api';
import { getMessageContent } from '@/app/types/ai-extended';
import { MessageService } from '@/lib/services/MessageService';
import { ModelConfigurationService } from '@/lib/services/ModelConfigurationService';
import logger from '@/lib/utils/logger';

// Mock dependencies
vi.mock('@/app/api/chat/api', () => ({
  validateAndTrackUsage: vi.fn(),
  incrementMessageCount: vi.fn(),
  logUserMessage: vi.fn(),
}));

vi.mock('@/app/types/ai-extended', () => ({
  getMessageContent: vi.fn(),
}));

vi.mock('@/lib/services/MessageService', () => ({
  MessageService: {
    transformMessagesToV5Format: vi.fn(),
    filterValidMessages: vi.fn(),
    convertToExtendedUIMessages: vi.fn(),
    createCompatibleMessages: vi.fn(),
  },
}));

vi.mock('@/lib/services/ModelConfigurationService', () => ({
  ModelConfigurationService: {
    resolveModelId: vi.fn(),
  },
}));

vi.mock('@/lib/utils/logger', () => ({
  default: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('RequestValidator', () => {
  const mockSupabaseClient = {
    from: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };

  const mockMessages = [
    {
      id: '1',
      role: 'user',
      content: 'Hello there',
      createdAt: new Date(),
    },
    {
      id: '2',
      role: 'assistant',
      content: 'Hi! How can I help?',
      createdAt: new Date(),
    },
  ] as any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    (validateAndTrackUsage as Mock).mockResolvedValue(mockSupabaseClient);
    (MessageService.transformMessagesToV5Format as Mock).mockReturnValue(mockMessages);
    (MessageService.filterValidMessages as Mock).mockReturnValue(mockMessages);
    (MessageService.convertToExtendedUIMessages as Mock).mockReturnValue(mockMessages);
    (MessageService.createCompatibleMessages as Mock).mockReturnValue(mockMessages);
    (ModelConfigurationService.resolveModelId as Mock).mockReturnValue('gpt-4');
    (getMessageContent as Mock).mockReturnValue('Hello there');
    (incrementMessageCount as Mock).mockResolvedValue(undefined);
    (logUserMessage as Mock).mockResolvedValue(undefined);
  });

  describe('validateAndTrackUsage', () => {
    const validationParams = {
      userId: 'user-123',
      model: 'gpt-4',
      isAuthenticated: true,
      hasGuestCredentials: false,
    };

    it('should call validateAndTrackUsage with correct parameters', async () => {
      const result = await RequestValidator.validateAndTrackUsage(validationParams);

      expect(validateAndTrackUsage).toHaveBeenCalledWith({
        userId: 'user-123',
        model: 'gpt-4',
        isAuthenticated: true,
        hasGuestCredentials: false,
      });
      expect(result).toBe(mockSupabaseClient);
    });

    it('should handle unauthenticated users', async () => {
      const unauthParams = {
        ...validationParams,
        isAuthenticated: false,
      };

      await RequestValidator.validateAndTrackUsage(unauthParams);

      expect(validateAndTrackUsage).toHaveBeenCalledWith({
        userId: 'user-123',
        model: 'gpt-4',
        isAuthenticated: false,
        hasGuestCredentials: false,
      });
    });

    it('should handle users with guest credentials', async () => {
      const guestCredParams = {
        ...validationParams,
        hasGuestCredentials: true,
      };

      await RequestValidator.validateAndTrackUsage(guestCredParams);

      expect(validateAndTrackUsage).toHaveBeenCalledWith({
        userId: 'user-123',
        model: 'gpt-4',
        isAuthenticated: true,
        hasGuestCredentials: true,
      });
    });

    it('should handle validation errors', async () => {
      const error = new Error('Validation failed');
      (validateAndTrackUsage as Mock).mockRejectedValue(error);

      await expect(RequestValidator.validateAndTrackUsage(validationParams)).rejects.toThrow('Validation failed');
    });

    it('should return null when validation returns null', async () => {
      (validateAndTrackUsage as Mock).mockResolvedValue(null);

      const result = await RequestValidator.validateAndTrackUsage(validationParams);

      expect(result).toBeNull();
    });
  });

  describe('hasGuestCredentials', () => {
    it('should return true when x-provider-api-key header is present', () => {
      const request = new Request('http://test.com', {
        headers: { 'x-provider-api-key': 'test-key' },
      });

      const result = RequestValidator.hasGuestCredentials(request);

      expect(result).toBe(true);
    });

    it('should return true when X-Provider-Api-Key header is present', () => {
      const request = new Request('http://test.com', {
        headers: { 'X-Provider-Api-Key': 'test-key' },
      });

      const result = RequestValidator.hasGuestCredentials(request);

      expect(result).toBe(true);
    });

    it('should return false when no guest credential headers are present', () => {
      const request = new Request('http://test.com', {
        headers: { 'authorization': 'Bearer token' },
      });

      const result = RequestValidator.hasGuestCredentials(request);

      expect(result).toBe(false);
    });

    it('should return false when headers are empty', () => {
      const request = new Request('http://test.com');

      const result = RequestValidator.hasGuestCredentials(request);

      expect(result).toBe(false);
    });

    it('should handle case-insensitive header names', () => {
      const request = new Request('http://test.com', {
        headers: { 'X-PROVIDER-API-KEY': 'test-key' },
      });

      const result = RequestValidator.hasGuestCredentials(request);

      expect(result).toBe(false); // Should be false as exact case matching is used
    });
  });

  describe('prepareCompatibleMessages', () => {
    it('should transform and validate messages successfully', () => {
      const rawMessages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ];

      const result = RequestValidator.prepareCompatibleMessages(rawMessages);

      expect(MessageService.transformMessagesToV5Format).toHaveBeenCalledWith(rawMessages);
      expect(MessageService.filterValidMessages).toHaveBeenCalledWith(mockMessages);
      expect(MessageService.convertToExtendedUIMessages).toHaveBeenCalledWith(mockMessages);
      expect(MessageService.createCompatibleMessages).toHaveBeenCalledWith(mockMessages);
      expect(result).toBe(mockMessages);
    });

    it('should throw error when transformation fails', () => {
      (MessageService.transformMessagesToV5Format as Mock).mockReturnValue(null);

      expect(() => {
        RequestValidator.prepareCompatibleMessages([]);
      }).toThrow('Failed to transform messages');
    });

    it('should throw error when transformation returns non-array', () => {
      (MessageService.transformMessagesToV5Format as Mock).mockReturnValue('not an array');

      expect(() => {
        RequestValidator.prepareCompatibleMessages([]);
      }).toThrow('Failed to transform messages');
    });

    it('should throw error when no valid messages remain after filtering', () => {
      (MessageService.filterValidMessages as Mock).mockReturnValue([]);

      expect(() => {
        RequestValidator.prepareCompatibleMessages([{ role: 'user', content: 'test' }]);
      }).toThrow('No valid messages to process');
    });

    it('should handle empty input array', () => {
      (MessageService.transformMessagesToV5Format as Mock).mockReturnValue([]);
      (MessageService.filterValidMessages as Mock).mockReturnValue([]);

      expect(() => {
        RequestValidator.prepareCompatibleMessages([]);
      }).toThrow('No valid messages to process');
    });

    it('should handle MessageService errors', () => {
      (MessageService.transformMessagesToV5Format as Mock).mockImplementation(() => {
        throw new Error('Transformation error');
      });

      expect(() => {
        RequestValidator.prepareCompatibleMessages([]);
      }).toThrow('Transformation error');
    });
  });

  describe('handleUserMessageLogging', () => {
    const loggingParams = {
      supabase: mockSupabaseClient,
      userId: 'user-123',
      chatId: 'chat-123',
      messages: mockMessages,
      messageGroupId: 'group-123',
    };

    it('should log user message successfully', async () => {
      await RequestValidator.handleUserMessageLogging(loggingParams);

      expect(incrementMessageCount).toHaveBeenCalledWith({
        supabase: mockSupabaseClient,
        userId: 'user-123',
      });

      expect(logUserMessage).toHaveBeenCalledWith({
        supabase: mockSupabaseClient,
        userId: 'user-123',
        chatId: 'chat-123',
        content: 'Hello there',
        attachments: [],
        message_group_id: 'group-123',
      });
    });

    it('should return early when supabase is null', async () => {
      const nullSupabaseParams = {
        ...loggingParams,
        supabase: null,
      };

      await RequestValidator.handleUserMessageLogging(nullSupabaseParams);

      expect(incrementMessageCount).not.toHaveBeenCalled();
      expect(logUserMessage).not.toHaveBeenCalled();
    });

    it('should handle messages with attachments', async () => {
      const messageWithAttachments = [
        {
          ...mockMessages[0],
          experimental_attachments: [
            { name: 'file1.txt', url: 'http://test.com/file1.txt' },
            { name: 'file2.pdf', url: 'http://test.com/file2.pdf' },
          ],
        },
      ] as any;

      const paramsWithAttachments = {
        ...loggingParams,
        messages: messageWithAttachments,
      };

      await RequestValidator.handleUserMessageLogging(paramsWithAttachments);

      expect(logUserMessage).toHaveBeenCalledWith({
        supabase: mockSupabaseClient,
        userId: 'user-123',
        chatId: 'chat-123',
        content: 'Hello there',
        attachments: [
          { name: 'file1.txt', url: 'http://test.com/file1.txt' },
          { name: 'file2.pdf', url: 'http://test.com/file2.pdf' },
        ],
        message_group_id: 'group-123',
      });
    });

    it('should handle messages without last user message', async () => {
      const assistantOnlyMessages = [
        {
          id: '1',
          role: 'assistant',
          content: 'Hello!',
          createdAt: new Date(),
        },
      ] as any;

      const noUserParams = {
        ...loggingParams,
        messages: assistantOnlyMessages,
      };

      await RequestValidator.handleUserMessageLogging(noUserParams);

      expect(incrementMessageCount).toHaveBeenCalled();
      expect(logUserMessage).not.toHaveBeenCalled();
    });

    it('should handle incrementMessageCount errors gracefully', async () => {
      (incrementMessageCount as Mock).mockRejectedValue(new Error('Increment failed'));

      await RequestValidator.handleUserMessageLogging(loggingParams);

      expect(logger.warn).toHaveBeenCalledWith(
        { at: 'userMessageLogging', error: expect.any(Error) },
        'Non-fatal logging error'
      );
    });

    it('should handle logUserMessage errors gracefully', async () => {
      (logUserMessage as Mock).mockRejectedValue(new Error('Log failed'));

      await RequestValidator.handleUserMessageLogging(loggingParams);

      expect(logger.warn).toHaveBeenCalledWith(
        { at: 'userMessageLogging', error: expect.any(Error) },
        'Non-fatal logging error'
      );
    });

    it('should handle empty messages array', async () => {
      const emptyMessagesParams = {
        ...loggingParams,
        messages: [],
      };

      await RequestValidator.handleUserMessageLogging(emptyMessagesParams);

      expect(incrementMessageCount).toHaveBeenCalled();
      expect(logUserMessage).not.toHaveBeenCalled();
    });

    it('should handle messages without messageGroupId', async () => {
      const noGroupIdParams = {
        ...loggingParams,
        messageGroupId: undefined,
      };

      await RequestValidator.handleUserMessageLogging(noGroupIdParams);

      expect(logUserMessage).toHaveBeenCalledWith({
        supabase: mockSupabaseClient,
        userId: 'user-123',
        chatId: 'chat-123',
        content: 'Hello there',
        attachments: [],
        message_group_id: undefined,
      });
    });
  });

  describe('validateRequestData', () => {
    it('should validate and return resolved model with default settings', () => {
      const requestData = {
        model: 'gpt-4',
      } as any;

      const result = RequestValidator.validateRequestData(requestData);

      expect(ModelConfigurationService.resolveModelId).toHaveBeenCalledWith('gpt-4');
      expect(result).toEqual({
        resolvedModel: 'gpt-4',
        effectiveSettings: {
          reasoningEffort: 'medium',
          verbosity: 'medium',
        },
      });
    });

    it('should validate and return resolved model with custom settings', () => {
      const requestData = {
        model: 'gpt-4',
        reasoningEffort: 'high',
        verbosity: 'low',
      } as any;

      const result = RequestValidator.validateRequestData(requestData);

      expect(result).toEqual({
        resolvedModel: 'gpt-4',
        effectiveSettings: {
          reasoningEffort: 'high',
          verbosity: 'low',
        },
      });
    });

    it('should handle model resolution errors', () => {
      (ModelConfigurationService.resolveModelId as Mock).mockImplementation(() => {
        throw new Error('Model resolution failed');
      });

      const requestData = { model: 'invalid-model' } as any;

      expect(() => {
        RequestValidator.validateRequestData(requestData);
      }).toThrow('Model resolution failed');
    });

    it('should handle undefined reasoningEffort', () => {
      const requestData = {
        model: 'gpt-4',
        reasoningEffort: undefined,
        verbosity: 'high',
      } as any;

      const result = RequestValidator.validateRequestData(requestData);

      expect(result.effectiveSettings.reasoningEffort).toBe('medium');
      expect(result.effectiveSettings.verbosity).toBe('high');
    });

    it('should handle undefined verbosity', () => {
      const requestData = {
        model: 'gpt-4',
        reasoningEffort: 'low',
        verbosity: undefined,
      } as any;

      const result = RequestValidator.validateRequestData(requestData);

      expect(result.effectiveSettings.reasoningEffort).toBe('low');
      expect(result.effectiveSettings.verbosity).toBe('medium');
    });
  });

  describe('getLastUserText', () => {
    it('should return text from last user message', () => {
      (getMessageContent as Mock).mockReturnValue('User message content');

      const result = RequestValidator.getLastUserText(mockMessages);

      expect(getMessageContent).toHaveBeenCalledWith(mockMessages[0]); // Last message
      expect(result).toBe('User message content');
    });

    it('should return empty string when no messages', () => {
      const result = RequestValidator.getLastUserText([]);

      expect(result).toBe('');
    });

    it('should return empty string when getMessageContent returns null', () => {
      (getMessageContent as Mock).mockReturnValue(null);

      const result = RequestValidator.getLastUserText(mockMessages);

      expect(result).toBe('');
    });

    it('should return empty string when getMessageContent returns undefined', () => {
      (getMessageContent as Mock).mockReturnValue(undefined);

      const result = RequestValidator.getLastUserText(mockMessages);

      expect(result).toBe('');
    });

    it('should handle messages without last message', () => {
      const result = RequestValidator.getLastUserText([]);

      expect(result).toBe('');
      expect(getMessageContent).not.toHaveBeenCalled();
    });
  });

  describe('getPreview', () => {
    it('should return full text when under max length', () => {
      const text = 'Short text';
      const result = RequestValidator.getPreview(text, 100);

      expect(result).toBe('Short text');
    });

    it('should truncate text when over max length', () => {
      const text = 'A'.repeat(600);
      const result = RequestValidator.getPreview(text, 500);

      expect(result).toBe('A'.repeat(500) + '…');
    });

    it('should use default max length of 500', () => {
      const text = 'A'.repeat(600);
      const result = RequestValidator.getPreview(text);

      expect(result).toBe('A'.repeat(500) + '…');
    });

    it('should handle null text', () => {
      const result = RequestValidator.getPreview(null);

      expect(result).toBe('');
    });

    it('should handle undefined text', () => {
      const result = RequestValidator.getPreview(undefined);

      expect(result).toBe('');
    });

    it('should handle empty string', () => {
      const result = RequestValidator.getPreview('');

      expect(result).toBe('');
    });

    it('should trim whitespace', () => {
      const text = '  Trimmed text  ';
      const result = RequestValidator.getPreview(text);

      expect(result).toBe('Trimmed text');
    });

    it('should handle non-string input by converting to string', () => {
      const result = RequestValidator.getPreview(123 as any);

      expect(result).toBe('123');
    });

    it('should handle text exactly at max length', () => {
      const text = 'A'.repeat(500);
      const result = RequestValidator.getPreview(text, 500);

      expect(result).toBe(text);
    });
  });
});