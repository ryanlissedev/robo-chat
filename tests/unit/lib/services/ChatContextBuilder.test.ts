import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { ChatContextBuilder } from '@/lib/services/ChatContextBuilder';
import { CredentialService } from '@/lib/services/CredentialService';
import { LangSmithService } from '@/lib/services/LangSmithService';
import { ModelConfigurationService } from '@/lib/services/ModelConfigurationService';
import { SystemPromptService } from '@/lib/services/SystemPromptService';
import { requireApiSdk } from '@/lib/models/api-sdk';
import { getModelTemperature } from '@/lib/models/temperature-utils';
import { getProviderForModel } from '@/lib/openproviders/provider-map';
import { shouldEnableFileSearchTools } from '@/lib/retrieval/gating';
import { file_search } from '@/lib/tools/file-search';
import logger from '@/lib/utils/logger';
import { convertToModelMessages } from 'ai';

// Mock dependencies
vi.mock('@/lib/services/CredentialService');
vi.mock('@/lib/services/LangSmithService');
vi.mock('@/lib/services/ModelConfigurationService');
vi.mock('@/lib/services/SystemPromptService');
vi.mock('@/lib/models/api-sdk');
vi.mock('@/lib/models/temperature-utils');
vi.mock('@/lib/openproviders/provider-map');
vi.mock('@/lib/retrieval/gating');
vi.mock('@/lib/tools/file-search');
vi.mock('@/lib/utils/logger');
vi.mock('ai', () => ({
  convertToModelMessages: vi.fn(),
}));

describe('ChatContextBuilder', () => {
  const mockMessages = [
    { id: '1', role: 'user', content: 'Hello', createdAt: new Date() },
    { id: '2', role: 'assistant', content: 'Hi there!', createdAt: new Date() },
  ] as any;

  const baseBuildParams = {
    resolvedModel: 'gpt-4',
    model: 'gpt-4',
    compatibleMessages: mockMessages,
    userId: 'user-123',
    isAuthenticated: true,
    systemPrompt: 'You are a helpful assistant',
    enableSearch: true,
    reasoningEffort: 'medium',
    verbosity: 'medium',
    reasoningSummary: 'auto',
    context: 'chat',
    personalityMode: 'friendly-assistant',
    chatId: 'chat-123',
    headers: new Headers({ authorization: 'Bearer test-token' }),
  };

  const mockModelConfig = {
    isGPT5Model: false,
    modelSupportsFileSearchTools: true,
    modelConfig: { provider: 'openai' },
  };

  const mockLanguageModel = {
    modelId: 'gpt-4',
    provider: 'openai',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup common mocks
    (ModelConfigurationService.getModelConfiguration as Mock).mockResolvedValue(
      mockModelConfig
    );
    (
      ModelConfigurationService.calculateEffectiveSettings as Mock
    ).mockReturnValue({
      reasoningEffort: 'medium',
      verbosity: 'medium',
    });
    (ModelConfigurationService.getModelSettings as Mock).mockReturnValue({
      temperature: 0.7,
    });
    (SystemPromptService.getEffectiveSystemPrompt as Mock).mockResolvedValue(
      'Effective system prompt'
    );
    (CredentialService.resolveCredentials as Mock).mockResolvedValue({
      apiKey: 'test-key',
    });
    (LangSmithService.createLangSmithRun as Mock).mockResolvedValue(
      'langsmith-run-id'
    );
    (shouldEnableFileSearchTools as Mock).mockReturnValue(true);
    (requireApiSdk as Mock).mockReturnValue(() => mockLanguageModel);
    (convertToModelMessages as Mock).mockReturnValue([
      { role: 'user', content: 'Hello' },
    ]);
    (getModelTemperature as Mock).mockReturnValue(0.7);
    (getProviderForModel as Mock).mockReturnValue('openai');

    // Mock logger
    const mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };
    vi.mocked(logger).info = mockLogger.info;
    vi.mocked(logger).error = mockLogger.error;
    vi.mocked(logger).warn = mockLogger.warn;
  });

  describe('buildChatContext', () => {
    it('should build complete chat context successfully', async () => {
      const context =
        await ChatContextBuilder.buildChatContext(baseBuildParams);

      expect(context).toEqual({
        languageModel: mockLanguageModel,
        effectiveSystemPrompt: 'Effective system prompt',
        modelMessages: [{ role: 'user', content: 'Hello' }],
        tools: { file_search },
        modelSettings: { temperature: 0.7 },
        apiKey: 'test-key',
        langsmithRunId: 'langsmith-run-id',
        modelConfig: { provider: 'openai' },
        effectiveSettings: {
          reasoningEffort: 'medium',
          verbosity: 'medium',
        },
      });
    });

    it('should handle GPT-5 model configuration', async () => {
      const gpt5ModelConfig = {
        ...mockModelConfig,
        isGPT5Model: true,
      };
      (
        ModelConfigurationService.getModelConfiguration as Mock
      ).mockResolvedValue(gpt5ModelConfig);

      const gpt5Params = {
        ...baseBuildParams,
        resolvedModel: 'gpt-5',
        model: 'gpt-5',
      };

      await ChatContextBuilder.buildChatContext(gpt5Params);

      expect(
        ModelConfigurationService.calculateEffectiveSettings
      ).toHaveBeenCalledWith(
        'medium',
        'medium',
        true // isGPT5Model
      );
    });

    it('should handle unauthenticated users', async () => {
      const unauthParams = {
        ...baseBuildParams,
        isAuthenticated: false,
      };

      await ChatContextBuilder.buildChatContext(unauthParams);

      expect(CredentialService.resolveCredentials).toHaveBeenCalledWith(
        { isAuthenticated: false, userId: 'user-123' },
        'gpt-4',
        baseBuildParams.headers
      );
    });

    it('should configure tools when search is enabled and model supports file search', async () => {
      await ChatContextBuilder.buildChatContext(baseBuildParams);

      expect(shouldEnableFileSearchTools).toHaveBeenCalledWith(true, true);
    });

    it('should not configure tools when search is disabled', async () => {
      (shouldEnableFileSearchTools as Mock).mockReturnValue(false);

      const context = await ChatContextBuilder.buildChatContext({
        ...baseBuildParams,
        enableSearch: false,
      });

      expect(context.tools).toEqual({});
    });

    it('should handle model configuration errors gracefully', async () => {
      (
        ModelConfigurationService.getModelConfiguration as Mock
      ).mockRejectedValue(new Error('Model config failed'));

      await expect(
        ChatContextBuilder.buildChatContext(baseBuildParams)
      ).rejects.toThrow('Model config failed');
    });

    it('should handle credential resolution errors', async () => {
      (CredentialService.resolveCredentials as Mock).mockRejectedValue(
        new Error('Credential resolution failed')
      );

      await expect(
        ChatContextBuilder.buildChatContext(baseBuildParams)
      ).rejects.toThrow('Credential resolution failed');
    });

    it('should handle message conversion errors', async () => {
      (convertToModelMessages as Mock).mockImplementation(() => {
        throw new Error('Message conversion failed');
      });

      await expect(
        ChatContextBuilder.buildChatContext(baseBuildParams)
      ).rejects.toThrow('Failed to convert messages to model format');
    });

    it('should handle system prompt generation errors', async () => {
      (SystemPromptService.getEffectiveSystemPrompt as Mock).mockRejectedValue(
        new Error('System prompt failed')
      );

      await expect(
        ChatContextBuilder.buildChatContext(baseBuildParams)
      ).rejects.toThrow('System prompt failed');
    });

    it('should handle LangSmith run creation failure gracefully', async () => {
      (LangSmithService.createLangSmithRun as Mock).mockResolvedValue(null);

      const context =
        await ChatContextBuilder.buildChatContext(baseBuildParams);

      expect(context.langsmithRunId).toBeNull();
    });

    it('should log request context', async () => {
      await ChatContextBuilder.buildChatContext(baseBuildParams);

      expect(logger.info).toHaveBeenCalledWith(
        {
          at: 'api.chat.POST',
          model: 'gpt-4',
          provider: 'openai',
          enableSearch: true,
          reasoningEffort: 'medium',
          verbosity: 'medium',
          temperature: 0.7,
          fileSearchToolsCapable: true,
          isGPT5Model: false,
        },
        'chat request'
      );
    });

    it('should handle logging errors gracefully', async () => {
      (getProviderForModel as Mock).mockImplementation(() => {
        throw new Error('Provider resolution failed');
      });

      await ChatContextBuilder.buildChatContext(baseBuildParams);

      // Should not throw even if logging fails
      expect(logger.info).toHaveBeenCalled();
    });

    it('should handle different personality modes', async () => {
      const techExpertParams = {
        ...baseBuildParams,
        personalityMode: 'technical-expert',
      };

      await ChatContextBuilder.buildChatContext(techExpertParams);

      expect(SystemPromptService.getEffectiveSystemPrompt).toHaveBeenCalledWith(
        'You are a helpful assistant',
        true,
        true,
        {
          context: 'chat',
          personalityMode: 'technical-expert',
        }
      );
    });

    it('should handle missing system prompt', async () => {
      const noPromptParams = {
        ...baseBuildParams,
        systemPrompt: undefined,
      };

      await ChatContextBuilder.buildChatContext(noPromptParams);

      expect(SystemPromptService.getEffectiveSystemPrompt).toHaveBeenCalledWith(
        '',
        true,
        true,
        {
          context: 'chat',
          personalityMode: 'friendly-assistant',
        }
      );
    });
  });

  describe('logUserQuery', () => {
    beforeEach(() => {
      vi.spyOn(ChatContextBuilder, 'logUserQuery');
    });

    it('should log user query with correct parameters', () => {
      const messages = [
        { role: 'user', content: 'What is the weather like?' },
      ] as any;

      ChatContextBuilder.logUserQuery(
        messages,
        'chat-123',
        'user-123',
        'gpt-4'
      );

      expect(logger.info).toHaveBeenCalledWith(
        {
          at: 'api.chat.POST',
          model: 'gpt-4',
          chatId: 'chat-123',
          userId: 'user-123',
          preview: 'What is the weather like?',
        },
        'user query'
      );
    });

    it('should handle long user queries with preview truncation', () => {
      const longContent = 'A'.repeat(600);
      const messages = [{ role: 'user', content: longContent }] as any;

      ChatContextBuilder.logUserQuery(
        messages,
        'chat-123',
        'user-123',
        'gpt-4'
      );

      const logCall = (logger.info as Mock).mock.calls[0][0];
      expect(logCall.preview).toBe('A'.repeat(500) + '…');
    });

    it('should handle messages without user content', () => {
      const messages = [{ role: 'assistant', content: 'Hello!' }] as any;

      ChatContextBuilder.logUserQuery(
        messages,
        'chat-123',
        'user-123',
        'gpt-4'
      );

      const logCall = (logger.info as Mock).mock.calls[0][0];
      expect(logCall.preview).toBe('');
    });

    it('should handle empty messages array', () => {
      ChatContextBuilder.logUserQuery([], 'chat-123', 'user-123', 'gpt-4');

      const logCall = (logger.info as Mock).mock.calls[0][0];
      expect(logCall.preview).toBe('');
    });

    it('should handle logging errors gracefully', () => {
      (logger.info as Mock).mockImplementation(() => {
        throw new Error('Logging failed');
      });

      // Should not throw
      expect(() => {
        ChatContextBuilder.logUserQuery(
          mockMessages,
          'chat-123',
          'user-123',
          'gpt-4'
        );
      }).not.toThrow();
    });

    it('should handle null content gracefully', () => {
      const messages = [{ role: 'user', content: null }] as any;

      ChatContextBuilder.logUserQuery(
        messages,
        'chat-123',
        'user-123',
        'gpt-4'
      );

      const logCall = (logger.info as Mock).mock.calls[0][0];
      expect(logCall.preview).toBe('');
    });

    it('should handle undefined content gracefully', () => {
      const messages = [{ role: 'user', content: undefined }] as any;

      ChatContextBuilder.logUserQuery(
        messages,
        'chat-123',
        'user-123',
        'gpt-4'
      );

      const logCall = (logger.info as Mock).mock.calls[0][0];
      expect(logCall.preview).toBe('');
    });

    it('should handle object content types', () => {
      const messages = [
        { role: 'user', content: { toString: () => 'Object content' } },
      ] as any;

      ChatContextBuilder.logUserQuery(
        messages,
        'chat-123',
        'user-123',
        'gpt-4'
      );

      const logCall = (logger.info as Mock).mock.calls[0][0];
      expect(logCall.preview).toBe('Object content');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle API SDK loading failure', async () => {
      (requireApiSdk as Mock).mockImplementation(() => {
        throw new Error('SDK loading failed');
      });

      await expect(
        ChatContextBuilder.buildChatContext(baseBuildParams)
      ).rejects.toThrow('SDK loading failed');
    });

    it('should handle model settings generation failure', async () => {
      (ModelConfigurationService.getModelSettings as Mock).mockImplementation(
        () => {
          throw new Error('Model settings failed');
        }
      );

      await expect(
        ChatContextBuilder.buildChatContext(baseBuildParams)
      ).rejects.toThrow('Model settings failed');
    });

    it('should handle different reasoning summary values', async () => {
      const detailedSummaryParams = {
        ...baseBuildParams,
        reasoningSummary: 'detailed',
      };

      await ChatContextBuilder.buildChatContext(detailedSummaryParams);

      expect(ModelConfigurationService.getModelSettings).toHaveBeenCalledWith(
        mockModelConfig,
        'medium',
        'medium',
        'detailed'
      );
    });

    it('should handle models without file search tool support', async () => {
      const noFileSearchConfig = {
        ...mockModelConfig,
        modelSupportsFileSearchTools: false,
      };
      (
        ModelConfigurationService.getModelConfiguration as Mock
      ).mockResolvedValue(noFileSearchConfig);

      const context =
        await ChatContextBuilder.buildChatContext(baseBuildParams);

      expect(shouldEnableFileSearchTools).toHaveBeenCalledWith(true, false);
    });

    it('should handle empty headers', async () => {
      const emptyHeadersParams = {
        ...baseBuildParams,
        headers: new Headers(),
      };

      await ChatContextBuilder.buildChatContext(emptyHeadersParams);

      expect(CredentialService.resolveCredentials).toHaveBeenCalledWith(
        { isAuthenticated: true, userId: 'user-123' },
        'gpt-4',
        expect.any(Headers)
      );
    });
  });
});
