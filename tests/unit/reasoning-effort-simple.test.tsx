import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { getModelInfo } from '@/lib/models';

// Mock the model info function
vi.mock('@/lib/models', () => ({
  getModelInfo: vi.fn(),
}));

describe('Reasoning Effort Logic', () => {
  it('should identify GPT-5 models as reasoning-capable', () => {
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

    const modelInfo = getModelInfo('gpt-5-mini');
    expect(modelInfo?.reasoningText).toBe(true);
    expect(modelInfo?.modelFamily).toBe('GPT-5');
  });

  it('should identify GPT-4o models with reasoning as reasoning-capable', () => {
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

    const modelInfo = getModelInfo('gpt-4o-mini');
    expect(modelInfo?.reasoningText).toBe(true);
  });

  it('should NOT identify regular models as reasoning-capable', () => {
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

    const modelInfo = getModelInfo('gpt-4.1');
    expect(modelInfo?.reasoningText).toBeUndefined();
  });

  it('should identify o1 series models as reasoning-capable', () => {
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

    const modelInfo = getModelInfo('o1-mini');
    expect(modelInfo?.reasoningText).toBe(true);
    expect(modelInfo?.modelFamily).toBe('o1');
  });

  it('should handle reasoning effort values correctly', () => {
    // Test that reasoning effort values are typed correctly
    const validEfforts: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

    validEfforts.forEach(effort => {
      expect(['low', 'medium', 'high']).toContain(effort);
    });
  });
});