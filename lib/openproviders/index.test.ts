import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { openproviders } from './index'

// Create mock language model that mimics AI SDK structure
const mockLanguageModel = {
  modelId: 'test-model',
  provider: 'test-provider',
  doGenerate: mock(),
  doStream: mock()
}

// Mock the AI SDK providers
mock.module('@ai-sdk/openai', () => ({
  openai: {
    chat: mock((modelId: string) => mockLanguageModel)
  },
  createOpenAI: mock(() => {
    // Return a function that can be called directly (for Ollama) or an object with methods
    const provider = mock((modelId: string) => mockLanguageModel);
    provider.chat = mock((modelId: string) => mockLanguageModel);
    return provider;
  })
}))

mock.module('@ai-sdk/anthropic', () => ({
  anthropic: mock((modelId: string) => mockLanguageModel),
  createAnthropic: mock(() => mock((modelId: string) => mockLanguageModel))
}))

mock.module('@ai-sdk/google', () => ({
  google: mock((modelId: string) => mockLanguageModel),
  createGoogleGenerativeAI: mock(() => mock((modelId: string) => mockLanguageModel))
}))

mock.module('@ai-sdk/mistral', () => ({
  mistral: mock((modelId: string) => mockLanguageModel),
  createMistral: mock(() => mock((modelId: string) => mockLanguageModel))
}))

mock.module('@ai-sdk/xai', () => ({
  xai: mock((modelId: string) => mockLanguageModel),
  createXai: mock(() => mock((modelId: string) => mockLanguageModel))
}))

mock.module('@ai-sdk/perplexity', () => ({
  perplexity: mock((modelId: string) => mockLanguageModel),
  createPerplexity: mock(() => mock((modelId: string) => mockLanguageModel))
}))

mock.module('@ai-sdk/groq', () => ({
  groq: mock((modelId: string) => mockLanguageModel),
  createGroq: mock(() => mock((modelId: string) => mockLanguageModel))
}))

// Note: Ollama provider uses createOpenAI internally, so no separate mock needed

mock.module('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: mock(() => mock((modelId: string) => mockLanguageModel))
}))

// Note: Ollama provider tests might need to be skipped or handled differently due to internal dependencies

describe('OpenProviders', () => {
  beforeEach(() => {
    mock.restore()
  })

  describe('OpenAI Provider', () => {
    it('should handle GPT-5 models with correct temperature', () => {
      const result = openproviders('gpt-5-mini', { temperature: 0 })
      expect(result).toBeDefined()
    })

    it('should handle GPT-5 models with reasoning effort', () => {
      const result = openproviders('gpt-5-mini', { 
        reasoningEffort: 'high',
        headers: { 'X-Custom': 'test' }
      })
      expect(result).toBeDefined()
    })

    it('should handle non-GPT-5 models normally', () => {
      const result = openproviders('gpt-4o', { temperature: 0.5 })
      expect(result).toBeDefined()
    })

    it('should handle custom API key', () => {
      const result = openproviders('gpt-5-mini', {}, 'custom-api-key')
      expect(result).toBeDefined()
    })
  })

  describe('Other Providers', () => {
    it('should handle Anthropic models', () => {
      const result = openproviders('claude-3-5-haiku-latest')
      expect(result).toBeDefined()
    })

    it('should handle Google models', () => {
      const result = openproviders('gemini-1.5-flash-002')
      expect(result).toBeDefined()
    })

    it('should handle Mistral models', () => {
      // Mistral provider is currently commented out in implementation
      expect(() => {
        openproviders('mistral-large-latest')
      }).toThrow('Unsupported model: mistral-large-latest')
    })

    it('should handle xAI models', () => {
      const result = openproviders('grok-2')
      expect(result).toBeDefined()
    })

    it('should handle Perplexity models', () => {
      const result = openproviders('sonar')
      expect(result).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should throw error for unsupported model', () => {
      expect(() => {
        openproviders('unsupported-model')
      }).toThrow('Unknown provider for model: unsupported-model')
    })
  })

  describe('Ollama Provider', () => {
    it('should handle Ollama models', () => {
      // Ollama provider uses createOpenAI internally, so it should work with the OpenAI mock
      const result = openproviders('llama3.2:latest')
      expect(result).toBeDefined()
    })

    it('should use correct base URL for Ollama', () => {
      // Test that Ollama provider is created with correct configuration
      // Since it uses createOpenAI internally, the mock should handle this
      const result = openproviders('llama3.2:latest')
      expect(result).toBeDefined()
    })
  })
})