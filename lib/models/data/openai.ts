import type { OpenProvidersOptions } from '@/lib/openproviders';
import { openproviders } from '@/lib/openproviders';
import type { ModelSettings } from '@/lib/types/models';
import type { ModelConfig } from '../types';

const openaiModels: ModelConfig[] = [
  // GPT-5 Series (September 2025)
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'GPT-5',
    baseProviderId: 'openai',
    description:
      'Latest flagship model with 94.6% on AIME 2025, 74.9% on SWE-bench',
    tags: ['flagship', 'multimodal', 'reasoning', 'default'],
    reasoningText: true,
    contextWindow: 128_000,
    inputCost: 2.5,
    outputCost: 10,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    fileSearchTools: true,
    audio: true,
    openSource: false,
    speed: 'Fast',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/gpt-5',
    modelPage: 'https://platform.openai.com/docs/models/gpt-5',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders('gpt-5', settings as OpenProvidersOptions, apiKey);
    },
  },
  {
    id: 'gpt-5-pro',
    name: 'GPT-5 Pro',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'GPT-5',
    baseProviderId: 'openai',
    description: 'Most capable GPT-5 for challenging tasks',
    tags: ['pro', 'advanced', 'reasoning', 'flagship'],
    reasoningText: true,
    contextWindow: 128_000,
    inputCost: 15,
    outputCost: 60,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    fileSearchTools: true,
    audio: true,
    openSource: false,
    speed: 'Medium',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/gpt-5',
    modelPage: 'https://platform.openai.com/docs/models/gpt-5-pro',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders(
        'gpt-5-pro',
        settings as OpenProvidersOptions,
        apiKey
      );
    },
  },

  // GPT-4.1 Series (September 2025)
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'GPT-4',
    baseProviderId: 'openai',
    description: 'Specialized for coding with precise instruction following',
    tags: ['coding', 'tools', 'large-context'],
    contextWindow: 128_000,
    inputCost: 2.0,
    outputCost: 8.0,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    fileSearchTools: true,
    audio: false,
    openSource: false,
    speed: 'Medium',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/gpt-4.1',
    modelPage: 'https://platform.openai.com/docs/models/gpt-4.1',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders('gpt-4.1', settings as OpenProvidersOptions, apiKey);
    },
  },

  // GPT-4o Series (Improved)
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'GPT-4o',
    baseProviderId: 'openai',
    description:
      'Improved flagship with enhanced instruction-following and coding',
    tags: ['flagship', 'multimodal', 'balanced'],
    contextWindow: 128_000,
    inputCost: 2.5,
    outputCost: 10.0,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    fileSearchTools: true,
    audio: true,
    openSource: false,
    speed: 'Medium',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/gpt-4o',
    modelPage: 'https://platform.openai.com/docs/models/gpt-4o',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders('gpt-4o', settings as OpenProvidersOptions, apiKey);
    },
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'GPT-4o',
    baseProviderId: 'openai',
    description: 'Fast and efficient GPT-4o variant',
    tags: ['fast', 'efficient', 'cost-effective'],
    contextWindow: 128_000,
    inputCost: 0.15,
    outputCost: 0.6,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    fileSearchTools: true,
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

  // O-Series Reasoning Models (September 2025)
  {
    id: 'o3',
    name: 'O3',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'o-series',
    baseProviderId: 'openai',
    description:
      'Most powerful reasoning model with state-of-the-art performance',
    tags: ['reasoning', 'advanced', 'visual', 'math', 'code'],
    reasoningText: true,
    contextWindow: 200_000,
    inputCost: 15,
    outputCost: 60,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    fileSearchTools: true,
    audio: false,
    openSource: false,
    speed: 'Slow',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/o3',
    modelPage: 'https://platform.openai.com/docs/models/o3',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders('o3', settings as OpenProvidersOptions, apiKey);
    },
  },
  {
    id: 'o3-pro',
    name: 'O3 Pro',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'o-series',
    baseProviderId: 'openai',
    description: 'Extended reasoning with longer thinking time',
    tags: ['reasoning', 'pro', 'advanced', 'complex'],
    reasoningText: true,
    contextWindow: 200_000,
    inputCost: 30,
    outputCost: 120,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    fileSearchTools: true,
    audio: false,
    openSource: false,
    speed: 'Slow',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/o3',
    modelPage: 'https://platform.openai.com/docs/models/o3-pro',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders('o3-pro', settings as OpenProvidersOptions, apiKey);
    },
  },
  {
    id: 'o4-mini',
    name: 'O4 Mini',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'o-series',
    baseProviderId: 'openai',
    description: 'Fast, cost-efficient reasoning for math and coding',
    tags: ['reasoning', 'efficient', 'math', 'coding'],
    reasoningText: true,
    contextWindow: 128_000,
    inputCost: 3,
    outputCost: 12,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    fileSearchTools: true,
    audio: false,
    openSource: false,
    speed: 'Medium',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/o4-mini',
    modelPage: 'https://platform.openai.com/docs/models/o4-mini',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders('o4-mini', settings as OpenProvidersOptions, apiKey);
    },
  },
  {
    id: 'o1',
    name: 'O1',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'o-series',
    baseProviderId: 'openai',
    description: 'Previous generation reasoning model',
    tags: ['reasoning', 'math', 'science'],
    reasoningText: true,
    contextWindow: 200_000,
    inputCost: 15,
    outputCost: 60,
    priceUnit: 'per 1M tokens',
    vision: false,
    tools: false,
    fileSearchTools: false,
    audio: false,
    openSource: false,
    speed: 'Slow',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/o1',
    modelPage: 'https://platform.openai.com/docs/models/o1',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders('o1', settings as OpenProvidersOptions, apiKey);
    },
  },
  {
    id: 'o1-mini',
    name: 'O1 Mini',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'o-series',
    baseProviderId: 'openai',
    description: 'Efficient reasoning model',
    tags: ['reasoning', 'efficient', 'coding', 'math'],
    reasoningText: true,
    contextWindow: 128_000,
    inputCost: 3,
    outputCost: 12,
    priceUnit: 'per 1M tokens',
    vision: false,
    tools: false,
    fileSearchTools: false,
    audio: false,
    openSource: false,
    speed: 'Medium',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/o1-mini',
    modelPage: 'https://platform.openai.com/docs/models/o1-mini',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders('o1-mini', settings as OpenProvidersOptions, apiKey);
    },
  },

  // Legacy GPT-4 Models
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'GPT-4',
    baseProviderId: 'openai',
    description: 'Previous generation GPT-4 model',
    tags: ['legacy', 'tools'],
    contextWindow: 128_000,
    inputCost: 10,
    outputCost: 30,
    priceUnit: 'per 1M tokens',
    vision: true,
    tools: true,
    fileSearchTools: false,
    audio: false,
    openSource: false,
    speed: 'Medium',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/gpt-4-turbo',
    modelPage: 'https://platform.openai.com/docs/models/gpt-4-turbo',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders(
        'gpt-4-turbo',
        settings as OpenProvidersOptions,
        apiKey
      );
    },
  },
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'GPT-4',
    baseProviderId: 'openai',
    description: 'Original GPT-4 model',
    tags: ['legacy'],
    contextWindow: 8_192,
    inputCost: 30,
    outputCost: 60,
    priceUnit: 'per 1M tokens',
    vision: false,
    tools: true,
    fileSearchTools: false,
    audio: false,
    openSource: false,
    speed: 'Slow',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/gpt-4',
    modelPage: 'https://platform.openai.com/docs/models/gpt-4',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders('gpt-4', settings as OpenProvidersOptions, apiKey);
    },
  },

  // GPT-3.5 Models (Still Available)
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'OpenAI',
    providerId: 'openai',
    modelFamily: 'GPT-3.5',
    baseProviderId: 'openai',
    description: 'Fast, cost-effective model for simple tasks',
    tags: ['fast', 'cheap', 'legacy'],
    contextWindow: 16_385,
    inputCost: 0.5,
    outputCost: 1.5,
    priceUnit: 'per 1M tokens',
    vision: false,
    tools: true,
    fileSearchTools: false,
    audio: false,
    openSource: false,
    speed: 'Fast',
    website: 'https://openai.com',
    apiDocs: 'https://platform.openai.com/docs/models/gpt-3-5-turbo',
    modelPage: 'https://platform.openai.com/docs/models/gpt-3-5-turbo',
    icon: 'openai',
    apiSdk: (apiKey?: string, opts?: unknown) => {
      const settings = opts as ModelSettings;
      return openproviders(
        'gpt-3.5-turbo',
        settings as OpenProvidersOptions,
        apiKey
      );
    },
  },
];

export { openaiModels };
export default openaiModels;