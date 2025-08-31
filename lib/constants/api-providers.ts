import type { StorageScope } from '@/lib/services/types';

export interface ApiProvider {
  id: string;
  name: string;
  required: boolean;
  description: string;
  badge: string;
}

export const API_PROVIDERS: ApiProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    required: true,
    description: 'Required for GPT models',
    badge: '🤖',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    required: false,
    description: 'For Claude models',
    badge: '🧠',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    required: false,
    description: 'For Mistral models',
    badge: '🌟',
  },
  {
    id: 'google',
    name: 'Google AI',
    required: false,
    description: 'For Gemini models',
    badge: '🔍',
  },
  {
    id: 'perplexity',
    name: 'Perplexity AI',
    required: false,
    description: 'For Perplexity models',
    badge: '🔮',
  },
  {
    id: 'xai',
    name: 'xAI',
    required: false,
    description: 'For Grok models',
    badge: '⚡',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    required: false,
    description: 'For OpenRouter models',
    badge: '🌐',
  },
  {
    id: 'langsmith',
    name: 'LangSmith',
    required: false,
    description: 'For observability',
    badge: '📊',
  },
];

export interface StorageScopeOption {
  value: StorageScope;
  label: string;
  description: string;
}

export const STORAGE_SCOPES: StorageScopeOption[] = [
  {
    value: 'request' as StorageScope,
    label: 'Request Only',
    description: 'Key is discarded after each request (most secure)',
  },
  {
    value: 'tab' as StorageScope,
    label: 'Tab Session',
    description: 'Key persists while this tab is open',
  },
  {
    value: 'session' as StorageScope,
    label: 'Browser Session',
    description: 'Key persists until browser is closed',
  },
  {
    value: 'persistent' as StorageScope,
    label: 'Persistent',
    description:
      'Key is encrypted and stored permanently (requires passphrase)',
  },
] as const;
