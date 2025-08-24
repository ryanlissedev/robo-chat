# 🤖 AI SDK v5 Migration Guide

## Overview

This guide documents the migration from AI SDK v4 to v5, including breaking changes, new patterns, and compatibility strategies used in RoboChat.

## Key Changes in v5

### 1. Message Format Changes

#### v4 Format (Deprecated)
```typescript
// v4: Simple content string
interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

const message: Message = {
  role: 'user',
  content: 'Hello, AI!'
}
```

#### v5 Format (Current)
```typescript
// v5: Content parts array
interface Message {
  role: 'user' | 'assistant' | 'system'
  content: Array<TextPart | ToolCallPart | ToolResultPart>
}

const message: Message = {
  role: 'user',
  content: [
    { type: 'text', text: 'Hello, AI!' }
  ]
}
```

### 2. Our Compatibility Layer

We maintain backward compatibility with a unified interface:

```typescript
// app/lib/ai/message-adapter.ts
export interface ExtendedUIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content?: string // v4 compatibility
  parts?: MessagePart[] // v5 format
  reasoning?: ReasoningPart[] // Extended feature
  sources?: Source[] // Extended feature
}

// Adapter function
export function adaptMessage(message: any): ExtendedUIMessage {
  // Handle v4 format
  if (typeof message.content === 'string') {
    return {
      ...message,
      parts: [{ type: 'text', text: message.content }]
    }
  }
  
  // Handle v5 format
  if (Array.isArray(message.content)) {
    return {
      ...message,
      parts: message.content,
      content: extractTextContent(message.content)
    }
  }
  
  return message
}
```

## Migration Patterns

### 1. Streaming Responses

#### v4 Pattern
```typescript
// v4: Text-only streaming
import { streamText } from 'ai'

const stream = await streamText({
  model: 'gpt-4',
  prompt: 'Hello'
})

for await (const chunk of stream) {
  console.log(chunk) // string chunks
}
```

#### v5 Pattern
```typescript
// v5: Multi-part streaming
import { streamText } from 'ai'

const stream = await streamText({
  model: 'gpt-4',
  messages: [
    { role: 'user', content: 'Hello' }
  ]
})

for await (const part of stream.textStream) {
  console.log(part) // text parts
}

// Access different streams
for await (const toolCall of stream.toolCallStream) {
  console.log(toolCall) // tool calls
}
```

### 2. Tool Calling

#### v4 Implementation
```typescript
// v4: Function-based tools
const result = await streamText({
  model: 'gpt-4',
  functions: {
    search: {
      description: 'Search the web',
      parameters: z.object({
        query: z.string()
      }),
      execute: async ({ query }) => {
        return await searchWeb(query)
      }
    }
  }
})
```

#### v5 Implementation
```typescript
// v5: Tool-based approach
import { tool } from 'ai'

const searchTool = tool({
  description: 'Search the web',
  parameters: z.object({
    query: z.string()
  }),
  execute: async ({ query }) => {
    return await searchWeb(query)
  }
})

const result = await streamText({
  model: 'gpt-4',
  tools: {
    search: searchTool
  }
})
```

### 3. Provider Configuration

#### v4 Setup
```typescript
// v4: Direct provider import
import { OpenAI } from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})
```

#### v5 Setup
```typescript
// v5: Provider registry pattern
import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// Unified interface
export function getProvider(name: string) {
  switch (name) {
    case 'openai': return openai
    case 'anthropic': return anthropic
    default: throw new Error(`Unknown provider: ${name}`)
  }
}
```

## RoboChat Implementation

### 1. Message Processing Pipeline

```typescript
// app/api/chat/route.ts
export async function POST(request: Request) {
  const { messages, provider, model } = await request.json()
  
  // Convert to v5 format
  const v5Messages = messages.map(adaptMessage)
  
  // Get provider
  const aiProvider = getProvider(provider)
  
  // Stream response
  const result = await streamText({
    model: aiProvider(model),
    messages: v5Messages,
    tools: getTools(),
  })
  
  // Convert stream to SSE
  return new Response(
    streamToSSE(result),
    {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      }
    }
  )
}
```

### 2. Client-Side Handling

```typescript
// app/hooks/use-chat.ts
export function useChat() {
  const [messages, setMessages] = useState<ExtendedUIMessage[]>([])
  
  async function sendMessage(content: string) {
    // Create v5-compatible message
    const userMessage: ExtendedUIMessage = {
      id: generateId(),
      role: 'user',
      content, // v4 compatibility
      parts: [{ type: 'text', text: content }] // v5 format
    }
    
    setMessages(prev => [...prev, userMessage])
    
    // Stream response
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [...messages, userMessage]
      })
    })
    
    // Process stream
    const reader = response.body?.getReader()
    const assistantMessage: ExtendedUIMessage = {
      id: generateId(),
      role: 'assistant',
      parts: []
    }
    
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      
      const chunk = parseSSE(value)
      if (chunk.type === 'text') {
        assistantMessage.parts?.push({
          type: 'text',
          text: chunk.content
        })
      }
      
      setMessages(prev => [...prev.slice(0, -1), assistantMessage])
    }
  }
  
  return { messages, sendMessage }
}
```

### 3. Extended Features

#### Reasoning Support
```typescript
// Custom reasoning part
interface ReasoningPart {
  type: 'reasoning'
  content: string
  duration?: number
}

// Handle reasoning in stream
if (chunk.type === 'reasoning') {
  assistantMessage.reasoning = assistantMessage.reasoning || []
  assistantMessage.reasoning.push({
    type: 'reasoning',
    content: chunk.content
  })
}
```

#### Source Citations
```typescript
// Source tracking
interface Source {
  type: 'source'
  url: string
  title: string
  snippet?: string
}

// Inline citations
function processWithCitations(text: string, sources: Source[]) {
  return text.replace(/\[(\d+)\]/g, (match, num) => {
    const source = sources[parseInt(num) - 1]
    return `[${num}](${source.url})`
  })
}
```

## Breaking Changes to Watch For

### 1. Import Changes

```typescript
// ❌ v4 (breaks)
import { useChat } from 'ai/react'
import { Message } from 'ai'

// ✅ v5 (works)
import { useChat } from 'ai/react'
import type { Message } from 'ai'
```

### 2. Response Format

```typescript
// ❌ v4 (breaks)
const response = await ai.complete(prompt)
console.log(response.text)

// ✅ v5 (works)
const response = await ai.streamText({ messages })
for await (const part of response.textStream) {
  console.log(part)
}
```

### 3. Tool Results

```typescript
// ❌ v4 (breaks)
return { result: data }

// ✅ v5 (works)
return {
  type: 'tool-result',
  toolCallId: call.id,
  result: data
}
```

## Testing Migration

### Unit Tests

```typescript
// Test v4 compatibility
describe('Message Adapter', () => {
  it('should handle v4 string content', () => {
    const v4Message = {
      role: 'user',
      content: 'Hello'
    }
    
    const adapted = adaptMessage(v4Message)
    expect(adapted.parts).toEqual([
      { type: 'text', text: 'Hello' }
    ])
  })
  
  it('should handle v5 parts array', () => {
    const v5Message = {
      role: 'user',
      content: [
        { type: 'text', text: 'Hello' }
      ]
    }
    
    const adapted = adaptMessage(v5Message)
    expect(adapted.content).toBe('Hello')
  })
})
```

### Integration Tests

```typescript
// Test streaming
it('should stream v5 responses', async () => {
  const stream = await POST(mockRequest)
  const chunks = await collectStream(stream)
  
  expect(chunks).toContainEqual(
    expect.objectContaining({
      type: 'text',
      content: expect.any(String)
    })
  )
})
```

## Performance Considerations

### 1. Stream Processing

```typescript
// Efficient chunk processing
const decoder = new TextDecoder()
const parser = new EventSourceParser()

async function* processStream(stream: ReadableStream) {
  const reader = stream.getReader()
  let buffer = ''
  
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        yield JSON.parse(line.slice(6))
      }
    }
  }
}
```

### 2. Memory Management

```typescript
// Cleanup large messages
function truncateHistory(messages: Message[], maxTokens = 4000) {
  let tokenCount = 0
  const truncated = []
  
  for (let i = messages.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(messages[i])
    if (tokenCount + tokens > maxTokens) break
    
    truncated.unshift(messages[i])
    tokenCount += tokens
  }
  
  return truncated
}
```

## Common Issues and Solutions

### Issue 1: Type Mismatches

```typescript
// Problem
Type 'string' is not assignable to type 'MessageContent'

// Solution
const content: MessageContent = 
  typeof input === 'string' 
    ? [{ type: 'text', text: input }]
    : input
```

### Issue 2: Stream Handling

```typescript
// Problem
Stream closes unexpectedly

// Solution
try {
  for await (const chunk of stream) {
    // Process chunk
  }
} catch (error) {
  if (error.name === 'AbortError') {
    // Handle abort
  } else {
    throw error
  }
} finally {
  // Cleanup
  reader?.releaseLock()
}
```

### Issue 3: Tool Execution

```typescript
// Problem
Tool results not appearing in stream

// Solution
const result = await streamText({
  model,
  messages,
  tools,
  toolChoice: 'auto', // Ensure tools are enabled
  onToolCall: async (call) => {
    console.log('Tool called:', call)
    // Debug tool execution
  }
})
```

## Migration Checklist

- [ ] Update AI SDK to v5
- [ ] Implement message adapter
- [ ] Update streaming handlers
- [ ] Migrate tool definitions
- [ ] Update provider configuration
- [ ] Add compatibility layer
- [ ] Update TypeScript types
- [ ] Test v4 compatibility
- [ ] Test v5 features
- [ ] Update documentation
- [ ] Monitor performance
- [ ] Handle edge cases

## Resources

- [AI SDK v5 Documentation](https://sdk.vercel.ai/docs)
- [Migration Guide](https://sdk.vercel.ai/docs/guides/migration)
- [GitHub Examples](https://github.com/vercel/ai/tree/main/examples)
- [Discord Community](https://discord.gg/vercel-ai)

## Support

If you encounter issues during migration:
1. Check this guide for common patterns
2. Review the test suite for examples
3. Ask in #dev-help on Slack
4. Consult the AI SDK documentation