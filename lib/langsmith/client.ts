import OpenAI from 'openai'

// Type definitions for LangSmith
type LangSmithMessage = {
  role: string
  content: string
  [key: string]: unknown
}

type LangSmithTool = {
  type: string
  function?: {
    name: string
    description?: string
    parameters?: Record<string, unknown>
  }
  [key: string]: unknown
}

// LangSmith Client interface
interface LangSmithClient {
  createFeedback(params: {
    runId: string
    key: string
    score: number
    value: string
    comment?: string
    metadata?: Record<string, unknown>
  }): Promise<unknown>
  
  createRun(params: {
    name: string
    inputs: Record<string, unknown>
    run_type: string
    project_name: string
    extra?: Record<string, unknown>
    parentRunId?: string
  }): Promise<unknown>
}

// Lazy initializer to avoid hard dependency on 'langsmith'
async function getLangSmithDeps() {
  try {
    const [{ Client }, traceableMod, wrappersMod] = await Promise.all([
      import('langsmith'),
      import('langsmith/traceable').catch(() => ({ traceable: <T extends (...args: unknown[]) => unknown>(fn: T) => fn })),
      import('langsmith/wrappers').catch(() => ({ wrapOpenAI: (c: OpenAI) => c })),
    ])
    return {
      Client,
      traceable: (traceableMod as { traceable: <T extends (...args: unknown[]) => unknown>(fn: T, _opts?: Record<string, unknown>) => T }).traceable,
      wrapOpenAI: (wrappersMod as { wrapOpenAI: (client: OpenAI) => OpenAI }).wrapOpenAI,
    }
  } catch {
    return null
  }
}

async function getClient(): Promise<LangSmithClient | null> {
  if (!process.env.LANGSMITH_API_KEY) return null
  const deps = await getLangSmithDeps()
  if (!deps) return null
  const { Client } = deps
  return new Client({
    apiKey: process.env.LANGSMITH_API_KEY,
    apiUrl: 'https://api.smith.langchain.com',
  }) as unknown as LangSmithClient
}

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

// No-op trace wrapper to keep API stable
export const traceChat = async (params: {
  model: string
  messages: LangSmithMessage[]
  tools?: LangSmithTool[]
  temperature?: number
  max_tokens?: number
  stream?: boolean
  metadata?: Record<string, unknown>
}) => params

// Wrap OpenAI client for automatic tracing
export async function createTracedOpenAI(apiKey: string) {
  if (!isLangSmithEnabled()) {
    return new OpenAI({ apiKey })
  }
  const deps = await getLangSmithDeps()
  if (!deps) return new OpenAI({ apiKey })
  const { wrapOpenAI } = deps
  return wrapOpenAI(new OpenAI({ apiKey }))
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
  if (!isLangSmithEnabled()) {
    console.log('LangSmith not enabled, skipping feedback')
    return null
  }

  try {
    const feedbackScore = score ?? (feedback === 'upvote' ? 1 : 0)
    const client = await getClient()
    if (!client) return null
    await client.createFeedback({
      runId,
      key: 'user-feedback',
      score: feedbackScore,
      value: feedback,
      comment,
      metadata: {
        feedbackId: `${runId}-${Date.now()}`,
        type: 'user',
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
  if (!isLangSmithEnabled()) {
    return null
  }

  try {
    const client = await getClient()
    if (!client) return null
    const run = await (client as unknown as { readRun: (id: string) => Promise<unknown> }).readRun(runId)
    return run
  } catch (error) {
    console.error('Error fetching run details:', error)
    return null
  }
}

// Helper to extract run ID from response metadata
export function extractRunId(response: Record<string, unknown>): string | null {
  const metadata = response?.metadata as Record<string, unknown> | undefined;
  const headers = response?.headers as Record<string, unknown> | undefined;
  return (metadata?.runId as string) || (headers?.['x-langsmith-run-id'] as string) || null
}

// Create a traced function for any async operation
export function createTracedFunction<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T
): T {
  // No-op wrapper to avoid hard dependency on langsmith
  return fn
}

// Log custom metrics
export async function logMetrics({
  runId,
  metrics,
}: {
  runId: string
  metrics: Record<string, unknown>
}) {
  if (!isLangSmithEnabled()) {
    return
  }

  try {
    const client = await getClient()
    if (!client) return
    await (client as unknown as { updateRun: (id: string, data: { extra: { metrics: Record<string, unknown> } }) => Promise<unknown> }).updateRun(runId, {
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
  inputs: Record<string, unknown>
  runType?: 'chain' | 'llm' | 'tool' | 'retriever'
  metadata?: Record<string, unknown>
  parentRunId?: string
}) {
  if (!isLangSmithEnabled()) {
    return null
  }

  try {
    const client = await getClient()
    if (!client) return null
   const run = await client.createRun({
      name,
      inputs,
      run_type: runType,
      project_name: getLangSmithProject(),
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
  outputs?: Record<string, unknown>
  error?: string
  endTime?: Date
}) {
  if (!isLangSmithEnabled()) {
    return
  }

  try {
    const client = await getClient()
    if (!client) return
    await (client as unknown as { updateRun: (id: string, data: { outputs?: Record<string, unknown>; error?: string; end_time: string }) => Promise<unknown> }).updateRun(runId, {
      outputs,
      error,
      end_time: (endTime || new Date()).toISOString(),
    })
  } catch (error) {
    console.error('Error updating LangSmith run:', error)
  }
}