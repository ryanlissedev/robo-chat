import { Client } from 'langsmith';
import { traceable } from 'langsmith/traceable';
import { wrapOpenAI } from 'langsmith/wrappers';
import OpenAI from 'openai';

// Types for LangSmith parameters
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ChatTool {
  type: string;
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

interface TraceChatParams {
  model: string;
  messages: ChatMessage[];
  tools?: ChatTool[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  metadata?: Record<string, unknown>;
}

interface ResponseMetadata {
  runId?: string;
  headers?: Record<string, string>;
  metadata?: {
    runId?: string;
  };
}

// Initialize LangSmith client
export const langsmithClient = process.env.LANGSMITH_API_KEY
  ? new Client({
      apiKey: process.env.LANGSMITH_API_KEY,
      apiUrl: 'https://api.smith.langchain.com',
    })
  : null;

// Check if LangSmith is enabled
export const isLangSmithEnabled = () => {
  return !!(
    process.env.LANGSMITH_API_KEY && process.env.LANGSMITH_TRACING === 'true'
  );
};

// Get the current project name
export const getLangSmithProject = () => {
  return process.env.LANGSMITH_PROJECT || 'zola-chat';
};

// Wrap chat completion calls with tracing
export const traceChat = traceable(
  async (params: TraceChatParams) => {
    return params;
  },
  {
    name: 'chat-completion',
    project_name: getLangSmithProject(),
  }
);

// Wrap OpenAI client for automatic tracing
export function createTracedOpenAI(apiKey: string) {
  if (!isLangSmithEnabled()) {
    return new OpenAI({ apiKey });
  }

  const client = wrapOpenAI(new OpenAI({ apiKey }));
  return client;
}

// Create a feedback entry
export async function createFeedback({
  runId,
  feedback,
  score,
  comment,
  userId,
}: {
  runId: string;
  feedback: 'upvote' | 'downvote';
  score?: number;
  comment?: string;
  userId?: string;
}) {
  if (!(langsmithClient && isLangSmithEnabled())) {
    return null;
  }

  try {
    const feedbackScore = score ?? (feedback === 'upvote' ? 1 : 0);

    await langsmithClient.createFeedback(runId, 'user-feedback', {
      score: feedbackScore,
      value: feedback,
      comment,
      feedbackSourceType: 'api',
      sourceInfo: {
        userId,
      },
    });

    return {
      success: true,
      runId,
      feedback,
      score: feedbackScore,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Get run details
export async function getRunDetails(runId: string) {
  if (!(langsmithClient && isLangSmithEnabled())) {
    return null;
  }

  try {
    const run = await langsmithClient.readRun(runId);
    return run;
  } catch {
    return null;
  }
}

// Helper to extract run ID from response metadata
export function extractRunId(response: ResponseMetadata): string | null {
  return (
    response?.metadata?.runId ||
    response?.headers?.['x-langsmith-run-id'] ||
    null
  );
}

// Create a traced function for any async operation
export function createTracedFunction<
  T extends (...args: unknown[]) => Promise<unknown>,
>(fn: T, name: string, metadata?: Record<string, unknown>): T {
  if (!isLangSmithEnabled()) {
    return fn;
  }

  return traceable(fn, {
    name,
    project_name: getLangSmithProject(),
    metadata,
  }) as T;
}

// Log custom metrics
export async function logMetrics({
  runId,
  metrics,
}: {
  runId: string;
  metrics: Record<string, unknown>;
}) {
  if (!(langsmithClient && isLangSmithEnabled())) {
    return;
  }

  try {
    await langsmithClient.updateRun(runId, { extra: { metrics } });
  } catch {}
}

// Create a run for manual tracing
export async function createRun({
  name,
  inputs,
  runType = 'chain',
  metadata,
  parentRunId,
}: {
  name: string;
  inputs: Record<string, unknown>;
  runType?: 'chain' | 'llm' | 'tool' | 'retriever';
  metadata?: Record<string, unknown>;
  parentRunId?: string;
}) {
  if (!(langsmithClient && isLangSmithEnabled())) {
    return null;
  }

  try {
    const run = await langsmithClient.createRun({
      name,
      inputs,
      run_type: runType,
      project_name: getLangSmithProject(),
      extra: metadata,
      parent_run_id: parentRunId,
    });

    return run;
  } catch {
    return null;
  }
}

// Update a run with outputs
export async function updateRun({
  runId,
  outputs,
  error,
  endTime,
}: {
  runId: string;
  outputs?: Record<string, unknown>;
  error?: string;
  endTime?: Date;
}) {
  if (!(langsmithClient && isLangSmithEnabled())) {
    return;
  }

  try {
    await langsmithClient.updateRun(runId, {
      outputs,
      error,
      end_time: (endTime || new Date()).toISOString(),
    } as Record<string, unknown>);
  } catch {}
}
