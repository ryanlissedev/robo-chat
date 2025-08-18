import { Client } from 'langsmith'
import { traceable } from 'langsmith/traceable'
import { wrapOpenAI } from 'langsmith/wrappers'
import OpenAI from 'openai'

// Initialize LangSmith client
export const langsmithClient = process.env.LANGSMITH_API_KEY
  ? new Client({
      apiKey: process.env.LANGSMITH_API_KEY,
      apiUrl: 'https://api.smith.langchain.com',
    })
  : null

// Check if LangSmith is enabled
export const isLangSmithEnabled = () => {
  return !!(
    process.env.LANGSMITH_API_KEY &&
    process.env.LANGSMITH_TRACING === 'true'
  )
}

// Get the current project name
export const getLangSmithProject = () => {
  return process.env.LANGSMITH_PROJECT || 'zola-chat'
}

// Wrap chat completion calls with tracing
export const traceChat = traceable(
  async (params: {
    model: string
    messages: any[]
    tools?: any
    temperature?: number
    max_tokens?: number
    stream?: boolean
    metadata?: Record<string, any>
  }) => {
    // This wrapper will be used in the chat route
    // The actual implementation will be done there
    return params
  },
  {
    name: 'chat-completion',
    project_name: getLangSmithProject(),
  }
)

// Wrap OpenAI client for automatic tracing
export function createTracedOpenAI(apiKey: string) {
  if (!isLangSmithEnabled()) {
    return new OpenAI({ apiKey })
  }

  const client = wrapOpenAI(new OpenAI({ apiKey }))
  return client
}

// Create a feedback entry
export async function createFeedback({
  runId,
  feedback,
  score,
  comment,
  userId,
}: {
  runId: string
  feedback: 'upvote' | 'downvote'
  score?: number
  comment?: string
  userId?: string
}) {
  if (!langsmithClient || !isLangSmithEnabled()) {
    console.log('LangSmith not enabled, skipping feedback')
    return null
  }

  try {
    const feedbackScore = score ?? (feedback === 'upvote' ? 1 : 0)

    await langsmithClient.createFeedback({
      runId,
      key: 'user-feedback',
      score: feedbackScore,
      value: feedback,
      comment,
      feedbackId: `${runId}-${Date.now()}`,
      feedbackConfig: {
        type: 'user',
      },
      sourceInfo: {
        userId,
      },
    })

    return {
      success: true,
      runId,
      feedback,
      score: feedbackScore,
    }
  } catch (error) {
    console.error('Error creating LangSmith feedback:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

// Get run details
export async function getRunDetails(runId: string) {
  if (!langsmithClient || !isLangSmithEnabled()) {
    return null
  }

  try {
    const run = await langsmithClient.readRun(runId)
    return run
  } catch (error) {
    console.error('Error fetching run details:', error)
    return null
  }
}

// Helper to extract run ID from response metadata
export function extractRunId(response: any): string | null {
  return response?.metadata?.runId || response?.headers?.['x-langsmith-run-id'] || null
}

// Create a traced function for any async operation
export function createTracedFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  name: string,
  metadata?: Record<string, any>
): T {
  if (!isLangSmithEnabled()) {
    return fn
  }

  return traceable(fn, {
    name,
    project_name: getLangSmithProject(),
    metadata,
  }) as T
}

// Log custom metrics
export async function logMetrics({
  runId,
  metrics,
}: {
  runId: string
  metrics: Record<string, any>
}) {
  if (!langsmithClient || !isLangSmithEnabled()) {
    return
  }

  try {
    await langsmithClient.updateRun(runId, {
      extra: {
        metrics,
      },
    })
  } catch (error) {
    console.error('Error logging metrics to LangSmith:', error)
  }
}

// Create a run for manual tracing
export async function createRun({
  name,
  inputs,
  runType = 'chain',
  metadata,
  parentRunId,
}: {
  name: string
  inputs: Record<string, any>
  runType?: 'chain' | 'llm' | 'tool' | 'retriever'
  metadata?: Record<string, any>
  parentRunId?: string
}) {
  if (!langsmithClient || !isLangSmithEnabled()) {
    return null
  }

  try {
    const run = await langsmithClient.createRun({
      name,
      inputs,
      runType,
      projectName: getLangSmithProject(),
      extra: metadata,
      parentRunId,
    })

    return run
  } catch (error) {
    console.error('Error creating LangSmith run:', error)
    return null
  }
}

// Update a run with outputs
export async function updateRun({
  runId,
  outputs,
  error,
  endTime,
}: {
  runId: string
  outputs?: Record<string, any>
  error?: string
  endTime?: Date
}) {
  if (!langsmithClient || !isLangSmithEnabled()) {
    return
  }

  try {
    await langsmithClient.updateRun(runId, {
      outputs,
      error,
      endTime: endTime || new Date(),
    })
  } catch (error) {
    console.error('Error updating LangSmith run:', error)
  }
}