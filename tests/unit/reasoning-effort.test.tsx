import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ChatInput } from '@/components/app/chat-input/chat-input';
import { getModelInfo } from '@/lib/models';
import { ModelProvider } from '@/lib/model-store/provider';

// Mock radix-ui tooltip
vi.mock('@radix-ui/react-tooltip', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    Arrow: () => null,
  };
});

// Mock other dependencies that might be needed
vi.mock('@/components/ui/toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
  toast: vi.fn(),
}));

vi.mock('@/lib/user-preference-store/provider', () => ({
  useUserPreferences: () => ({
    preferences: {
      multiModelEnabled: false,
      showToolInvocations: true,
    },
  }),
}));

// Mock the model info
vi.mock('@/lib/models', () => ({
  getModelInfo: vi.fn(),
}));

describe('Reasoning Effort Selector', () => {
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

  it('should show reasoning effort selector for GPT-5 models', () => {
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
      reasoningText: true,
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

    render(
      <ModelProvider>
        <ChatInput {...mockProps} selectedModel="gpt-5-mini" />
      </ModelProvider>
    );

    // Should render reasoning effort selector
    expect(
      screen.queryByRole('button', { name: /reasoning effort/i })
    ).toBeTruthy();
  });

  it('should show reasoning effort selector for GPT-4o models with reasoning', () => {
    const mockedGetModelInfo = vi.mocked(getModelInfo);
    mockedGetModelInfo.mockReturnValue({
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'OpenAI',
      providerId: 'openai',
      modelFamily: 'GPT-4o',
      baseProviderId: 'openai',
      description: 'Fast GPT-4o model',
      tags: ['fast', 'reasoning'],
      reasoningText: true,
      contextWindow: 128_000,
      inputCost: 0.15,
      outputCost: 0.6,
      priceUnit: 'per 1M tokens',
      vision: true,
      tools: true,
      fileSearchTools: false,
      audio: false,
      openSource: false,
      speed: 'Fast',
      website: 'https://openai.com',
      apiDocs: 'https://platform.openai.com/docs',
      modelPage: 'https://platform.openai.com/docs',
      icon: 'openai',
      apiSdk: () => null as any,
    });

    render(
      <ModelProvider>
        <ChatInput {...mockProps} selectedModel="gpt-4o-mini" />
      </ModelProvider>
    );

    // Should render reasoning effort selector
    expect(
      screen.queryByRole('button', { name: /reasoning effort/i })
    ).toBeTruthy();
  });

  it('should NOT show reasoning effort selector for non-reasoning models', () => {
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
      // No reasoningText property
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

    render(
      <ModelProvider>
        <ChatInput {...mockProps} selectedModel="gpt-4.1" />
      </ModelProvider>
    );

    // Should NOT render reasoning effort selector
    expect(
      screen.queryByRole('button', { name: /reasoning effort/i })
    ).toBeFalsy();
  });

  it('should show reasoning effort selector for o-series models', () => {
    const mockedGetModelInfo = vi.mocked(getModelInfo);
    mockedGetModelInfo.mockReturnValue({
      id: 'o1-mini',
      name: 'o1-mini',
      provider: 'OpenAI',
      providerId: 'openai',
      modelFamily: 'o1',
      baseProviderId: 'openai',
      description: 'Reasoning model',
      tags: ['reasoning'],
      reasoningText: true,
      contextWindow: 128000,
      inputCost: 1.1,
      outputCost: 4.4,
      priceUnit: 'per 1M tokens',
      vision: true,
      tools: true,
      fileSearchTools: false,
      audio: false,
      openSource: false,
      speed: 'Slow',
      website: 'https://openai.com',
      apiDocs: 'https://platform.openai.com/docs',
      modelPage: 'https://platform.openai.com/docs',
      icon: 'openai',
      apiSdk: () => null as any,
    });

    render(
      <ModelProvider>
        <ChatInput {...mockProps} selectedModel="o1-mini" />
      </ModelProvider>
    );

    // Should render reasoning effort selector
    expect(
      screen.queryByRole('button', { name: /reasoning effort/i })
    ).toBeTruthy();
  });
});
