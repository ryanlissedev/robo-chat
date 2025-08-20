/**
 * Enhanced metadata support for AI SDK v5
 * Provides rich metadata for messages, tool calls, and system events
 */

import type { UIMessage } from 'ai'

export interface MessageMetadata {
  // Timing information
  timestamp: Date
  processingTime?: number
  streamStartTime?: Date
  streamEndTime?: Date
  
  // Model information
  model?: string
  temperature?: number
  maxTokens?: number
  
  // Usage statistics
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  
  // Tool information
  toolCalls?: ToolCallMetadata[]
  
  // Error tracking
  error?: {
    code: string
    message: string
    retryable: boolean
    timestamp: Date
  }
  
  // User context
  userId?: string
  sessionId?: string
  
  // Feature flags
  searchEnabled?: boolean
  reasoningEffort?: 'low' | 'medium' | 'high'
  
  // Custom fields
  custom?: Record<string, any>
}

export interface ToolCallMetadata {
  toolName: string
  toolCallId: string
  startTime: Date
  endTime?: Date
  duration?: number
  status: 'pending' | 'success' | 'error'
  error?: string
  result?: any
}

/**
 * Create metadata for a new message
 */
export function createMessageMetadata(
  options: Partial<MessageMetadata> = {}
): MessageMetadata {
  return {
    timestamp: new Date(),
    ...options,
  }
}

/**
 * Update message metadata with timing information
 */
export function updateMessageTiming(
  metadata: MessageMetadata,
  updates: {
    streamStartTime?: Date
    streamEndTime?: Date
    processingTime?: number
  }
): MessageMetadata {
  return {
    ...metadata,
    ...updates,
    processingTime: updates.streamEndTime && updates.streamStartTime
      ? updates.streamEndTime.getTime() - updates.streamStartTime.getTime()
      : updates.processingTime,
  }
}

/**
 * Track tool call in metadata
 */
export function trackToolCall(
  metadata: MessageMetadata,
  toolCall: ToolCallMetadata
): MessageMetadata {
  const toolCalls = metadata.toolCalls || []
  const existingIndex = toolCalls.findIndex(tc => tc.toolCallId === toolCall.toolCallId)
  
  if (existingIndex >= 0) {
    toolCalls[existingIndex] = toolCall
  } else {
    toolCalls.push(toolCall)
  }
  
  return {
    ...metadata,
    toolCalls,
  }
}

/**
 * Extract metadata from AI SDK v5 message
 */
export function extractMessageMetadata(message: UIMessage): MessageMetadata {
  const metadata: MessageMetadata = {
    timestamp: message.createdAt || new Date(),
  }
  
  // Extract tool calls if present
  if ('toolInvocations' in message && Array.isArray(message.toolInvocations)) {
    metadata.toolCalls = message.toolInvocations.map(invocation => ({
      toolName: invocation.toolName,
      toolCallId: invocation.toolCallId,
      startTime: new Date(),
      status: invocation.state === 'result' ? 'success' : 
              invocation.state === 'error' ? 'error' : 'pending',
      result: invocation.state === 'result' ? invocation.result : undefined,
      error: invocation.state === 'error' ? invocation.error : undefined,
    }))
  }
  
  // Extract experimental metadata if present
  if ('experimental_metadata' in message) {
    const experimental = message.experimental_metadata as any
    if (experimental) {
      metadata.model = experimental.model
      metadata.temperature = experimental.temperature
      metadata.maxTokens = experimental.maxTokens
      metadata.promptTokens = experimental.promptTokens
      metadata.completionTokens = experimental.completionTokens
      metadata.totalTokens = experimental.totalTokens
    }
  }
  
  return metadata
}

/**
 * Aggregate metadata for analytics
 */
export function aggregateMetadata(messages: UIMessage[]): {
  totalTokens: number
  totalProcessingTime: number
  averageProcessingTime: number
  toolCallCount: number
  errorCount: number
  modelUsage: Record<string, number>
} {
  const result = {
    totalTokens: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
    toolCallCount: 0,
    errorCount: 0,
    modelUsage: {} as Record<string, number>,
  }
  
  let messageCount = 0
  
  messages.forEach(message => {
    const metadata = extractMessageMetadata(message)
    
    if (metadata.totalTokens) {
      result.totalTokens += metadata.totalTokens
    }
    
    if (metadata.processingTime) {
      result.totalProcessingTime += metadata.processingTime
      messageCount++
    }
    
    if (metadata.toolCalls) {
      result.toolCallCount += metadata.toolCalls.length
    }
    
    if (metadata.error) {
      result.errorCount++
    }
    
    if (metadata.model) {
      result.modelUsage[metadata.model] = (result.modelUsage[metadata.model] || 0) + 1
    }
  })
  
  if (messageCount > 0) {
    result.averageProcessingTime = result.totalProcessingTime / messageCount
  }
  
  return result
}

/**
 * Format metadata for display
 */
export function formatMetadata(metadata: MessageMetadata): string {
  const parts: string[] = []
  
  if (metadata.model) {
    parts.push(`Model: ${metadata.model}`)
  }
  
  if (metadata.totalTokens) {
    parts.push(`Tokens: ${metadata.totalTokens}`)
  }
  
  if (metadata.processingTime) {
    parts.push(`Time: ${(metadata.processingTime / 1000).toFixed(2)}s`)
  }
  
  if (metadata.toolCalls && metadata.toolCalls.length > 0) {
    parts.push(`Tools: ${metadata.toolCalls.length}`)
  }
  
  return parts.join(' • ')
}