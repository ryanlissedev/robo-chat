import type { OpenProvidersOptions } from '@/lib/openproviders';
import { openproviders } from '@/lib/openproviders';
import type { ModelConfig } from '../types';
import type { ModelSettings } from '@/lib/types/models';

const openaiModels: ModelConfig[] = [
  // GPT-5 Models (August 2025)
  {
    id: 'gpt-5-nano',
    name: 'GPT-5 Nano',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'GPT-5',
    baseProviderId: 'openai',
    description: 'Fastest and most cost-efficient GPT-5 variant',
    tags: ['fastest', 'cost-efficient'],
    contextWindow: 2_097_152,
    inputCost: 0.2,
    outputCost: 0.8,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    audio: true,
    openSource: false,
    speed: 'Fast',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/gpt-5',
    modelPage: 'https://platform.openai.com/docs/models/gpt-5-nano',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders(
        'gpt-5-nano',
        settings as OpenProvidersOptions,
        apiKey
      );
    },
  },
  {
    id: 'gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'GPT-5',
    baseProviderId: 'openai',
    description: 'Fast, efficient GPT-5 model with file search capabilities',
    tags: ['fast', 'efficient', 'file-search', 'default'],
    contextWindow: 2_097_152,
    inputCost: 0.5,
    outputCost: 2.0,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    audio: true,
    openSource: false,
    speed: 'Fast',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/gpt-5',
    modelPage: 'https://platform.openai.com/docs/models/gpt-5-mini',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders(
        'gpt-5-mini',
        settings as OpenProvidersOptions,
        apiKey
      );
    },
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'GPT-5',
    baseProviderId: 'openai',
    description:
      'Standard GPT-5 model with balanced performance and file search',
    tags: ['balanced', 'file-search', 'reasoning'],
    contextWindow: 2_097_152,
    inputCost: 2.5,
    outputCost: 10.0,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    audio: true,
    openSource: false,
    speed: 'Medium',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/gpt-5',
    modelPage: 'https://platform.openai.com/docs/models/gpt-5',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders('gpt-5', settings as OpenProvidersOptions, apiKey);
    },
  },
  // Legacy GPT-4 models for compatibility
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'GPT-4o',
    baseProviderId: 'openai',
    description: 'Legacy GPT-4o mini model',
    tags: ['legacy', 'fast'],
    contextWindow: 128_000,
    inputCost: 0.15,
    outputCost: 0.6,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    audio: false,
    openSource: false,
    speed: 'Fast',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/gpt-4o-mini',
    modelPage: 'https://platform.openai.com/docs/models/gpt-4o-mini',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders(
        'gpt-4o-mini',
        settings as OpenProvidersOptions,
        apiKey
      );
    },
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'GPT-4o',
    baseProviderId: 'openai',
    description: 'Legacy GPT-4o model',
    tags: ['legacy', 'balanced'],
    contextWindow: 128_000,
    inputCost: 2.5,
    outputCost: 10.0,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    audio: false,
    openSource: false,
    speed: 'Medium',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/gpt-4o',
    modelPage: 'https://platform.openai.com/docs/models/gpt-4o',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders(
        'gpt-4o',
        settings as OpenProvidersOptions,
        apiKey
      );
    },
  },
];

export { openaiModels };
