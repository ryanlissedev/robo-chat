import React from 'react';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChatInput } from '@/components/app/chat-input/chat-input';
import { getModelInfo } from '@/lib/models';
import { renderWithProviders } from '../test-utils';

// Mock the model info function
vi.mock('@/lib/models', () => ({
  getModelInfo: vi.fn(),
}));

// Mock user preferences provider
vi.mock('@/lib/user-preference-store/provider', () => ({
  UserPreferencesProvider: ({ children }: { children: React.ReactNode }) => children,
  useUserPreferences: vi.fn(() => ({
    isModelHidden: vi.fn(() => false),
  })),
}));

// Mock user provider
vi.mock('@/lib/user-store/provider', () => ({
  UserProvider: ({ children }: { children: React.ReactNode }) => children,
  useUser: vi.fn(() => ({
    user: null,
    isLoading: false,
  })),
}));

// Mock model provider
vi.mock('@/lib/model-store/provider', () => ({
  ModelProvider: ({ children }: { children: React.ReactNode }) => children,
  useModel: vi.fn(() => ({
    models: [],
    userKeyStatus: {},
    favoriteModels: [],
    userConfig: {},
    isLoading: false,
    refreshModels: vi.fn(),
    refreshUserKeyStatus: vi.fn(),
    refreshFavoriteModels: vi.fn(),
    refreshFavoriteModelsSilent: vi.fn(),
    refreshUserConfig: vi.fn(),
    refreshAll: vi.fn(),
  })),
}));

describe('Reasoning Effort Selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    renderWithProviders(
      <ChatInput {...mockProps} selectedModel="gpt-5-mini" />
    );

    // Should render reasoning effort selector - look for the select trigger button
    expect(
      screen.queryByRole('combobox')
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

    renderWithProviders(
      <ChatInput {...mockProps} selectedModel="gpt-4o-mini" />
    );

    // Should render reasoning effort selector - look for the select trigger button
    expect(
      screen.queryByRole('combobox')
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

    renderWithProviders(
      <ChatInput {...mockProps} selectedModel="gpt-4.1" />
    );

    // Should NOT render reasoning effort selector
    expect(
      screen.queryByRole('combobox')
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

    renderWithProviders(
      <ChatInput {...mockProps} selectedModel="o1-mini" />
    );

    // Should render reasoning effort selector - look for the select trigger button
    expect(
      screen.queryByRole('combobox')
    ).toBeTruthy();
  });
});
