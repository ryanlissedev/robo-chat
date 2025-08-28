# LangSmith Feedback and Observability Implementation

_Generated: 2025-01-28 | Sources: 4 URLs + web search_

## 🎯 Quick Reference

<key-points>
- Use `client.createFeedback()` with run_id/trace_id for feedback submission
- Critical env vars: `LANGSMITH_TRACING=true`, `LANGSMITH_API_KEY=<key>`
- Serverless: Must flush traces with `awaitPendingTraceBatches()` or set `LANGSMITH_TRACING_BACKGROUND=false`
- AI SDK: Use `wrapAISDK(ai)` or OTEL with `experimental_telemetry: { isEnabled: true }`
- Feedback can be attached to ANY child run, not just root traces
</key-points>

## 📋 Overview

<summary>
LangSmith provides comprehensive observability for LLM applications through tracing and feedback collection. The platform supports both LangChain/LangGraph applications and framework-agnostic implementations via the AI SDK integration. Key challenges include proper serverless environment handling and ensuring trace data is flushed before function termination.
</summary>

## 🔧 Implementation Details

<details>

### Installation/Setup

**Required Packages:**
```bash
# Core LangSmith
npm install langsmith

# For AI SDK integration  
npm install @ai-sdk/openai langsmith

# For OTEL tracing
npm install @opentelemetry/sdk-trace-base @opentelemetry/exporter-trace-otlp-proto @opentelemetry/context-async-hooks

# For Next.js
npm install @vercel/otel
```

**Essential Environment Variables:**
```bash
export LANGSMITH_TRACING=true
export LANGCHAIN_TRACING_V2=true
export LANGSMITH_API_KEY="<your-langsmith-api-key>"
export LANGCHAIN_API_KEY="<your-langsmith-api-key>"  # Same as above
export OTEL_ENABLED=true
export OPENAI_API_KEY="<your-openai-api-key>"

# For serverless environments (critical)
export LANGSMITH_TRACING_BACKGROUND=false
```

### Basic Tracing Setup

**Method 1: AI SDK Wrapper (Recommended)**
```javascript
import { openai } from '@ai-sdk/openai';
import * as ai from 'ai';
import { wrapAISDK } from 'langsmith/experimental/vercel';

const { generateText, streamText, generateObject, streamObject } = wrapAISDK(ai);

await generateText({
  model: openai('gpt-4o-mini'),
  prompt: 'Write a vegetarian lasagna recipe for 4 people.',
});
```

**Method 2: OTEL Integration**
```javascript
import { initializeOTEL } from "langsmith/experimental/otel/setup";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const { DEFAULT_LANGSMITH_SPAN_PROCESSOR } = initializeOTEL();

try {
  const result = await generateText({
    model: openai("gpt-4o-mini"),
    prompt: "Write a vegetarian lasagna recipe for 4 people.",
    experimental_telemetry: {
      isEnabled: true,
    },
  });
} finally {
  await DEFAULT_LANGSMITH_SPAN_PROCESSOR.shutdown();
}
```

### Feedback Submission

**Basic Feedback Creation:**
```javascript
import { Client } from "langsmith";

const client = new Client();

// Feedback for root trace
await client.createFeedback(
  runId,           // or trace_id  
  "user_feedback", // feedback key
  {
    score: 1.0,
    comment: "Great response!",
  }
);

// Feedback for child run
await client.createFeedback(childRunId, "correctness", {
  score: 0.8,
  comment: "Mostly accurate",
});
```

**Python Example (Non-blocking):**
```python
from langsmith import Client

client = Client()

# Non-blocking feedback creation (recommended for production)
client.create_feedback(
    key="user_feedback",
    score=1,
    trace_id=trace_id,  # Enables background processing
    comment="User said this was helpful"
)
```

### Serverless Environment Handling

**Method 1: Environment Variable**
```bash
export LANGSMITH_TRACING_BACKGROUND=false
```

**Method 2: Manual Flush (Recommended)**
```javascript
import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";

const client = new Client();

const tracedFn = traceable(async () => {
  return "Some return value";
}, {
  client: client,
});

try {
  const result = await tracedFn();
} finally {
  // Critical: Wait for all traces to flush
  await client.awaitPendingTraceBatches();
}
```

**Next.js Setup:**
```javascript
// instrumentation.ts (root directory)
import { registerOTel } from "@vercel/otel";
import { initializeOTEL } from "langsmith/experimental/otel/setup";

const { DEFAULT_LANGSMITH_SPAN_PROCESSOR } = initializeOTEL({});

export function register() {
  registerOTel({
    serviceName: "your-project-name",
    spanProcessors: [DEFAULT_LANGSMITH_SPAN_PROCESSOR],
  });
}
```

### Advanced Features

**Custom Metadata:**
```javascript
await generateText({
  model: openai("gpt-4o-mini"),
  prompt: "Write a recipe.",
  experimental_telemetry: {
    isEnabled: true,
    metadata: { 
      userId: "123", 
      language: "english",
      ls_run_name: "custom-run-name" // Custom run name
    },
  },
});
```

**Tool Calls Tracing:**
```javascript
import { tool } from 'ai';
import { z } from 'zod';

await generateText({
  model: openai('gpt-4o-mini'),
  messages: [{
    role: 'user',
    content: 'What are my orders? My user ID is 123',
  }],
  tools: {
    listOrders: tool({
      description: 'list all orders',
      parameters: z.object({ userId: z.string() }),
      execute: async ({ userId }) => `User ${userId} has orders: 1, 2, 3`,
    }),
  },
  experimental_telemetry: { isEnabled: true },
});
```

**High Concurrency Rate Limit Handling:**
```javascript
const client = new Client({
  manualFlushMode: true, // Prevents automatic batching
});

const myTracedFunc = traceable(async () => {
  // Your logic here...
}, { client });

try {
  await myTracedFunc();
} finally {
  await client.flush(); // Manual flush
}
```

</details>

## ⚠️ Important Considerations

<warnings>
- **Serverless Critical**: Always flush traces before function termination using `awaitPendingTraceBatches()` or set `LANGSMITH_TRACING_BACKGROUND=false`
- **Environment Variables**: Both `LANGSMITH_API_KEY` and `LANGCHAIN_API_KEY` should be set to the same value
- **SDK Versions**: Require `langsmith >= 0.3.37` for OTEL support, `>= 0.3.43` for Python non-blocking feedback
- **Rate Limits**: At high concurrency, use `manualFlushMode: true` and manual `flush()` calls
- **Child Runs**: Feedback can be attached to ANY child run in a trace, not just the root
- **Authentication**: Only requires API key setup - no additional auth for feedback submission
- **Trace Visibility**: With `manualFlushMode`, runs won't appear until `flush()` is called
</warnings>

## 🔗 Resources

<references>
- [LangSmith Observability Quick Start](https://docs.smith.langchain.com/observability) - Main setup guide
- [User Feedback SDK Guide](https://docs.smith.langchain.com/evaluation/how_to_guides/attach_user_feedback) - Feedback implementation
- [AI SDK LangSmith Integration](https://ai-sdk.dev/providers/observability/langsmith) - Vercel AI SDK setup
- [Vercel AI SDK Tracing Guide](https://docs.smith.langchain.com/observability/how_to_guides/trace_with_vercel_ai_sdk) - Detailed OTEL setup
- [Serverless Environments](https://docs.smith.langchain.com/observability/how_to_guides/serverless_environments) - Serverless best practices
</references>

## 🏷️ Metadata

<meta>
research-date: 2025-01-28
confidence: high
version-checked: langsmith>=0.3.63, AI SDK v4+
key-patterns: feedback-submission, serverless-flushing, otel-tracing, environment-setup
</meta>