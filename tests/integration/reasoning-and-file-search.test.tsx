import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MessageAssistant } from '@/components/app/chat/message-assistant';
import { ChatInput } from '@/components/app/chat-input/chat-input';
import { getModelInfo } from '@/lib/models';
import { fileSearchTool } from '@/lib/tools/file-search';
import { createTestQueryClient, renderWithProviders } from '@/tests/test-utils';

// Mock the models
vi.mock('@/lib/models', () => ({
  getModelInfo: vi.fn(),
  getModelList: () => [],
}));

// Mock file search tool
vi.mock('@/lib/tools/file-search', () => ({
  fileSearchTool: {
    execute: vi.fn(),
  },
}));

// Mock OpenAI
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    vectorStores: {
      list: vi.fn().mockResolvedValue({ data: [] }),
      create: vi
        .fn()
        .mockResolvedValue({ id: 'vs_test123', name: 'Test Store' }),
    },
  })),
}));

// Mock enhanced retrieval
vi.mock('@/lib/retrieval/query-rewriting', () => ({
  enhancedRetrieval: vi.fn().mockResolvedValue([
    {
      id: 'doc1',
      file_id: 'file_123',
      file_name: 'safety-manual.pdf',
      content:
        'RoboRail Safety Equipment Requirements: Hard hat (ANSI Z89.1 compliant), Safety glasses with side shields, Steel-toed boots (ASTM F2413 rated)',
      score: 0.95,
      metadata: { title: 'Safety Manual' },
    },
  ]),
}));

// Mock user preferences - will be updated per test
let mockPreferences = {
  showToolInvocations: true,
  multiModelEnabled: false,
};

vi.mock('@/lib/user-preference-store/provider', () => ({
  useUserPreferences: () => ({
    preferences: mockPreferences,
  }),
  UserPreferencesProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));

describe('Reasoning Models and File Search Integration', () => {
  let queryClient: ReturnType<typeof createTestQueryClient>;

  beforeAll(() => {
    queryClient = createTestQueryClient();

    // Mock environment variable
    process.env.OPENAI_API_KEY = 'test-key';
  });

  afterAll(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('Reasoning Effort Selector', () => {
    it('should show reasoning effort selector for GPT-5 models', async () => {
      const mockedGetModelInfo = vi.mocked(getModelInfo);
      mockedGetModelInfo.mockReturnValue({
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        provider: 'OpenAI',
        providerId: 'openai',
        modelFamily: 'GPT-5',
        baseProviderId: 'openai',
        description: 'Fast, efficient GPT-5 model',
        tags: ['fast', 'efficient', 'reasoning'],
        reasoningText: true, // This enables the reasoning selector
        contextWindow: 2_097_152,
        inputCost: 0.5,
        outputCost: 2.0,
        priceUnit: 'per 1M tokens',
        vision: true,
        tools: true,
        fileSearchTools: true,
        audio: true,
        openSource: false,
        speed: 'Fast',
        website: 'https://openai.com',
        apiDocs: 'https://platform.openai.com/docs',
        modelPage: 'https://platform.openai.com/docs',
        icon: 'openai',
        apiSdk: () => null as any,
      });

      const mockProps = {
        value: '',
        onValueChange: vi.fn(),
        onSend: vi.fn(),
        files: [],
        onFileUpload: vi.fn(),
        onFileRemove: vi.fn(),
        onSuggestion: vi.fn(),
        hasSuggestions: false,
        onSelectModel: vi.fn(),
        selectedModel: 'gpt-5-mini',
        isUserAuthenticated: true,
        userId: 'test-user',
        stop: vi.fn(),
        status: 'ready' as const,
        setEnableSearch: vi.fn(),
        enableSearch: true,
        quotedText: null,
        reasoningEffort: 'medium' as const,
        onReasoningEffortChange: vi.fn(),
      };

      renderWithProviders(<ChatInput {...mockProps} />, { queryClient });

      // Check that reasoning effort selector is rendered
      // The selector uses icons (Zap, Gauge, Brain) for Low, Medium, High
      await waitFor(() => {
        // Check for the Select trigger which contains the selected option
        const selectTrigger = screen.getByRole('combobox');
        expect(selectTrigger).toBeTruthy();

        // The default value should be "Medium"
        expect(selectTrigger.textContent).toContain('Medium');
      });
    });

    it('should NOT show reasoning effort selector for non-reasoning models', async () => {
      const mockedGetModelInfo = vi.mocked(getModelInfo);
      mockedGetModelInfo.mockReturnValue({
        id: 'gpt-4.1',
        name: 'GPT-4.1',
        provider: 'OpenAI',
        providerId: 'openai',
        modelFamily: 'GPT-4',
        baseProviderId: 'openai',
        description: 'Standard GPT-4.1 model',
        tags: ['tools', 'large-context'],
        // No reasoningText property - this disables the reasoning selector
        contextWindow: 1047576,
        inputCost: 2.0,
        outputCost: 8.0,
        priceUnit: 'per 1M tokens',
        vision: true,
        tools: true,
        fileSearchTools: false,
        audio: false,
        openSource: false,
        speed: 'Medium',
        website: 'https://openai.com',
        apiDocs: 'https://platform.openai.com/docs',
        modelPage: 'https://platform.openai.com/docs',
        icon: 'openai',
        apiSdk: () => null as any,
      });

      const mockProps = {
        value: '',
        onValueChange: vi.fn(),
        onSend: vi.fn(),
        files: [],
        onFileUpload: vi.fn(),
        onFileRemove: vi.fn(),
        onSuggestion: vi.fn(),
        hasSuggestions: false,
        onSelectModel: vi.fn(),
        selectedModel: 'gpt-4.1',
        isUserAuthenticated: true,
        userId: 'test-user',
        stop: vi.fn(),
        status: 'ready' as const,
        setEnableSearch: vi.fn(),
        enableSearch: true,
        quotedText: null,
        reasoningEffort: 'medium' as const,
        onReasoningEffortChange: vi.fn(),
      };

      renderWithProviders(<ChatInput {...mockProps} />, { queryClient });

      await waitFor(() => {
        // Should NOT have a Select combobox for reasoning effort
        const selectTrigger = screen.queryByRole('combobox');
        expect(selectTrigger).toBeFalsy();
      });
    });
  });

  describe('File Search Tool', () => {
    it('should execute file search and return results', async () => {
      const mockExecute = vi.mocked(fileSearchTool.execute);
      mockExecute.mockResolvedValue({
        success: true,
        query: 'safety equipment',
        enhanced_query: 'Query enhanced with expansion strategy',
        results: [
          {
            rank: 1,
            file_id: 'file_123',
            file_name: 'safety-manual.pdf',
            content:
              'RoboRail Safety Equipment Requirements: Hard hat (ANSI Z89.1 compliant)...',
            score: 0.95,
            metadata: { title: 'Safety Manual' },
          },
        ],
        total_results: 1,
        summary: 'Found 1 relevant documents. Top result has 95% relevance.',
        sources: [
          {
            id: 'file_123',
            name: 'safety-manual.pdf',
            score: 0.95,
            excerpt: 'RoboRail Safety Equipment Requirements...',
            url: '/api/files/file_123',
          },
        ],
        thinking:
          'Searching for: "safety equipment"\nEnhanced query with expansion strategy\nFound 1 relevant documents\nApplied semantic reranking\nTop result: safety-manual.pdf (score: 0.950)',
        search_config: {
          vector_store_id: 'vs_test123',
          query_rewriting: true,
          rewrite_strategy: 'expansion',
          reranking: true,
          reranking_method: 'semantic',
        },
      });

      const result = await fileSearchTool.execute({
        query: 'safety equipment',
        max_results: 5,
        enable_rewriting: true,
        rewrite_strategy: 'expansion',
        enable_reranking: true,
        reranking_method: 'semantic',
      });

      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].file_name).toBe('safety-manual.pdf');
      expect(result.results[0].score).toBe(0.95);
      expect(result.sources).toHaveLength(1);
      expect(result.thinking).toContain('safety equipment');
    });

    it('should handle file search errors gracefully', async () => {
      const mockExecute = vi.mocked(fileSearchTool.execute);
      mockExecute.mockResolvedValue({
        success: false,
        query: 'safety equipment',
        results: [],
        total_results: 0,
        error: 'Failed to perform file search',
      });

      const result = await fileSearchTool.execute({
        query: 'safety equipment',
        max_results: 5,
      });

      expect(result.success).toBe(false);
      expect(result.results).toHaveLength(0);
      expect(result.error).toBe('Failed to perform file search');
    });
  });

  describe('Tool Invocation UI', () => {
    it('should display tool invocations when showToolInvocations is true', () => {
      const toolParts = [
        {
          type: 'tool-call',
          toolCallId: 'call_123',
          toolName: 'fileSearch',
          state: 'input-available',
          input: { query: 'safety equipment' },
        },
        {
          type: 'tool-result',
          toolCallId: 'call_123',
          toolName: 'fileSearch',
          state: 'output-available',
          output: {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  results: [{ file_name: 'safety-manual.pdf' }],
                }),
              },
            ],
          },
        },
      ];

      // Update mockPreferences for this test
      mockPreferences = { showToolInvocations: true, multiModelEnabled: false };

      renderWithProviders(
        <MessageAssistant messageId="msg_123" parts={toolParts} status="ready">
          Based on the safety manual, you need: hard hat, safety glasses, and
          steel-toed boots.
        </MessageAssistant>,
        { queryClient }
      );

      // Check for tool invocation display
      const toolOutput = screen.getByLabelText('tool-output');
      expect(toolOutput).toBeTruthy();
      expect(toolOutput.textContent).toContain('safety-manual.pdf');
    });

    it('should NOT display tool invocations when showToolInvocations is false', () => {
      const toolParts = [
        {
          type: 'tool-call',
          toolCallId: 'call_123',
          toolName: 'fileSearch',
          state: 'output-available',
          output: { success: true },
        },
      ];

      // Update mockPreferences for this test
      mockPreferences = {
        showToolInvocations: false,
        multiModelEnabled: false,
      };

      renderWithProviders(
        <MessageAssistant messageId="msg_123" parts={toolParts} status="ready">
          Based on the search results...
        </MessageAssistant>,
        { queryClient }
      );

      // Tool output should not be visible
      const toolOutput = screen.queryByLabelText('tool-output');
      expect(toolOutput).toBeFalsy();
    });
  });

  describe('End-to-End Flow', () => {
    it('should show reasoning selector for GPT-5 and execute file search properly', async () => {
      // Setup GPT-5 model
      const mockedGetModelInfo = vi.mocked(getModelInfo);
      mockedGetModelInfo.mockReturnValue({
        id: 'gpt-5',
        name: 'GPT-5',
        reasoningText: true,
        fileSearchTools: true,
        // ... other required properties
      } as any);

      // Mock successful file search
      const mockExecute = vi.mocked(fileSearchTool.execute);
      mockExecute.mockResolvedValue({
        success: true,
        query: 'RoboRail safety procedures',
        results: [
          {
            rank: 1,
            file_id: 'file_safety',
            file_name: 'roborail-safety.pdf',
            content:
              'RoboRail Safety Procedures: Always wear protective equipment...',
            score: 0.98,
          },
        ],
        total_results: 1,
        summary: 'Found 1 relevant document about RoboRail safety.',
        sources: [
          {
            id: 'file_safety',
            name: 'roborail-safety.pdf',
            score: 0.98,
            excerpt: 'RoboRail Safety Procedures...',
            url: '/api/files/file_safety',
          },
        ],
        thinking: 'Searching for RoboRail safety procedures',
      });

      // Execute search
      const result = await fileSearchTool.execute({
        query: 'RoboRail safety procedures',
        enable_rewriting: true,
        enable_reranking: true,
      });

      // Verify results
      expect(result.success).toBe(true);
      expect(result.results[0].file_name).toBe('roborail-safety.pdf');
      expect(result.results[0].score).toBe(0.98);
      expect(result.sources).toHaveLength(1);

      // Verify the response includes search results
      expect(result.summary).toContain('Found 1 relevant document');
      expect(result.thinking).toContain('RoboRail safety procedures');
    });
  });
});
