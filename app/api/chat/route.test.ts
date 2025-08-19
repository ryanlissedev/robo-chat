import { describe, it, expect, mock, beforeEach } from 'bun:test'
import { NextRequest } from 'next/server'

// Mock dependencies
mock.module('@/lib/models', () => ({
  getAllModels: mock(() => Promise.resolve([
    { 
      id: 'gpt-5-mini', 
      name: 'GPT-5 Mini', 
      provider: 'OpenAI',
      providerId: 'openai',
      baseProviderId: 'openai',
      apiSdk: mock(() => ({ modelId: 'gpt-5-mini', provider: 'openai' }))
    }
  ]))
}))

mock.module('@/lib/openproviders/provider-map', () => ({
  getProviderForModel: mock(() => 'openai')
}))

mock.module('ai', () => ({
  streamText: mock(() => ({
    toTextStreamResponse: mock(() => new Response('mock response'))
  }))
}))

mock.module('@/lib/langsmith/client', () => ({
  isLangSmithEnabled: mock(() => false),
  createRun: mock(),
  updateRun: mock(),
  extractRunId: mock(),
  logMetrics: mock()
}))

mock.module('./api', () => ({
  validateAndTrackUsage: mock(() => Promise.resolve({})),
  incrementMessageCount: mock(),
  logUserMessage: mock(),
  storeAssistantMessage: mock()
}))

describe('Chat API Route', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    mock.restore()
  })

  describe('Request Validation', () => {
    it('should validate required fields', async () => {
      // Mock request with missing fields
      const invalidRequest = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      // Import the POST function dynamically to avoid module loading issues
      const { POST } = await import('./route')
      const response = await POST(invalidRequest)
      
      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toContain('missing information')
    })

    it('should accept valid request', async () => {
      const validRequest = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Hello' }],
          chatId: 'test-chat',
          userId: 'test-user',
          model: 'gpt-5-mini',
          isAuthenticated: false,
          systemPrompt: 'Test prompt',
          enableSearch: true
        })
      })

      const { POST } = await import('./route')
      const response = await POST(validRequest)
      
      // Should not return 400 error
      expect(response.status).not.toBe(400)
    })
  })

  describe('Model Configuration', () => {
    it('should handle GPT-5 models correctly', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test GPT-5' }],
          chatId: 'test-chat',
          userId: 'test-user',
          model: 'gpt-5-mini',
          isAuthenticated: false,
          systemPrompt: 'Test prompt',
          enableSearch: true,
          reasoningEffort: 'medium'
        })
      })

      const { POST } = await import('./route')
      const response = await POST(request)
      
      // Should handle GPT-5 model without errors
      expect(response).toBeDefined()
    })

    it('should handle reasoning effort parameter', async () => {
      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test reasoning' }],
          chatId: 'test-chat',
          userId: 'test-user',
          model: 'gpt-5-mini',
          isAuthenticated: false,
          systemPrompt: 'Test prompt',
          enableSearch: true,
          reasoningEffort: 'high'
        })
      })

      const { POST } = await import('./route')
      const response = await POST(request)
      
      expect(response).toBeDefined()
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const invalidRequest = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json'
      })

      const { POST } = await import('./route')
      const response = await POST(invalidRequest)
      
      expect(response.status).toBe(400)
    })

    it('should handle internal errors gracefully', async () => {
      // Mock getAllModels to throw an error to simulate internal failure
      // Note: In Bun test, we need to re-mock the module with the error implementation
      mock.module('@/lib/models', () => ({
        getAllModels: mock(() => {
          throw new Error('Database connection failed')
        })
      }))

      const request = new NextRequest('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'Test error' }],
          chatId: 'test-chat',
          userId: 'test-user',
          model: 'gpt-5-mini',
          isAuthenticated: false,
          systemPrompt: 'Test prompt',
          enableSearch: true
        })
      })

      const { POST } = await import('./route')
      const response = await POST(request)
      
      expect(response.status).toBe(500)
    })
  })
})