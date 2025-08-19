import { describe, it, expect, beforeEach } from 'vitest'
import { getAllModels, getModelInfo } from '@/lib/models'
import { MockRoboRailModel, mockResponses } from './models.mock'

describe('AI Models', () => {
  describe('getAllModels', () => {
    it('should return all available models', async () => {
      const models = await getAllModels()
      expect(models).toBeDefined()
      expect(Array.isArray(models)).toBe(true)
      expect(models.length).toBeGreaterThan(0)
    })

    it('should include GPT-5 models', async () => {
      const models = await getAllModels()
      const gpt5Models = models.filter((model) => model.id.startsWith('gpt-5'))
      expect(gpt5Models.length).toBeGreaterThan(0)
    })

    it('should include required model properties', async () => {
      const models = await getAllModels()
      const firstModel = models[0]
      
      expect(firstModel).toHaveProperty('id')
      expect(firstModel).toHaveProperty('name')
      expect(firstModel).toHaveProperty('provider')
      expect(firstModel).toHaveProperty('providerId')
      expect(firstModel).toHaveProperty('apiSdk')
      expect(typeof firstModel.apiSdk).toBe('function')
    })
  })

  describe('getModelInfo', () => {
    it('should return model info for valid model ID', async () => {
      const models = await getAllModels()
      const firstModelId = models[0].id
      
      const modelInfo = getModelInfo(firstModelId)
      expect(modelInfo).toBeDefined()
      expect(modelInfo?.id).toBe(firstModelId)
    })

    it('should return undefined for invalid model ID', () => {
      const modelInfo = getModelInfo('invalid-model-id')
      expect(modelInfo).toBeUndefined()
    })

    it('should return correct model info for gpt-5-mini', () => {
      const modelInfo = getModelInfo('gpt-5-mini')
      expect(modelInfo).toBeDefined()
      expect(modelInfo?.name).toBe('GPT-5 Mini')
      expect(modelInfo?.provider).toBe('OpenAI')
    })
  })
})

describe('MockRoboRailModel', () => {
  let mockModelInstance: MockRoboRailModel

  beforeEach(() => {
    mockModelInstance = new MockRoboRailModel()
  })

  describe('generateStream', () => {
    it('should generate stream for known prompts', async () => {
      const stream = await mockModelInstance.generateStream('what is roborail')
      expect(stream).toBeInstanceOf(ReadableStream)
    })

    it('should handle unknown prompts with default response', async () => {
      const stream = await mockModelInstance.generateStream('unknown prompt')
      expect(stream).toBeInstanceOf(ReadableStream)
    })

    it('should match partial prompts', async () => {
      const stream = await mockModelInstance.generateStream('roborail specs')
      expect(stream).toBeInstanceOf(ReadableStream)
    })
  })

  describe('addResponse', () => {
    it('should add custom responses', async () => {
      const customResponse = {
        content: 'Custom test response',
        delay: 50
      }
      
      mockModelInstance.addResponse('test prompt', customResponse)
      const stream = await mockModelInstance.generateStream('test prompt')
      expect(stream).toBeInstanceOf(ReadableStream)
    })
  })

  describe('generateError', () => {
    it('should generate error stream', () => {
      const errorStream = mockModelInstance.generateError('Test error')
      expect(errorStream).toBeInstanceOf(ReadableStream)
    })
  })

  describe('generateInterruptedStream', () => {
    it('should generate interrupted stream', () => {
      const interruptedStream = mockModelInstance.generateInterruptedStream('test', 2)
      expect(interruptedStream).toBeInstanceOf(ReadableStream)
    })
  })
})

describe('Mock Responses', () => {
  it('should have predefined responses for common queries', () => {
    expect(mockResponses).toHaveProperty('what is roborail')
    expect(mockResponses).toHaveProperty('roborail specifications')
    expect(mockResponses).toHaveProperty('plasma cutting troubleshooting')
    expect(mockResponses).toHaveProperty('hello')
    expect(mockResponses).toHaveProperty('hi')
  })

  it('should have proper response structure', () => {
    const response = mockResponses['what is roborail']
    expect(response).toHaveProperty('content')
    expect(response).toHaveProperty('delay')
    expect(typeof response.content).toBe('string')
    expect(typeof response.delay).toBe('number')
  })

  it('should include technical responses', () => {
    const techResponse = mockResponses['plasma cutting troubleshooting']
    expect(techResponse.content).toContain('consumables')
    expect(techResponse.content).toContain('air pressure')
    expect(techResponse.content).toContain('cutting speed')
  })
})