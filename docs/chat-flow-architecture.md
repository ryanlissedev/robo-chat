# Chat Flow Architecture Documentation

_Generated: 2025-09-15 | Comprehensive analysis of message handling and API structure_

## 🎯 Quick Reference

<key-points>
- API endpoint: `POST /api/chat` with Zod validation (ChatRequestSchema)
- Required fields: messages, chatId, userId, model, isAuthenticated, systemPrompt, enableSearch
- enableSearch controls retrieval behavior: native file_search tools vs fallback retrieval
- Messages support both v4 (string content) and v5 (parts array) formats
- Streaming responses via AI SDK with reasoning extraction for GPT-5 models
</key-points>

## 📋 Overview

<summary>
The chat flow architecture in this application follows a comprehensive service-oriented design that handles message validation, user authentication, file search capabilities, and streaming responses. The system supports both authenticated and guest users with different rate limiting and model access policies.
</summary>

## 🔧 Implementation Details

<details>

### API Endpoint Structure

The main chat endpoint at `/api/chat` follows this flow:

1. **Request Validation** (ChatRequestSchema via Zod)
2. **Service Delegation** (ChatService.processChatRequest)
3. **Context Building** (ChatContextBuilder)
4. **Retrieval Decision** (RetrievalService)
5. **Streaming Response** (StreamingService)

### Required Request Format

```typescript
interface ChatRequest {
  messages: ExtendedUIMessage[];          // REQUIRED: Array of chat messages
  chatId: string;                         // REQUIRED: Chat session identifier
  userId: string;                         // REQUIRED: User identifier (authenticated or guest)
  model: string;                          // REQUIRED: Model ID (e.g., "gpt-4", "claude-3")
  isAuthenticated: boolean;               // REQUIRED: Authentication status
  systemPrompt: string;                   // REQUIRED: System prompt for the conversation
  enableSearch: boolean;                  // REQUIRED: Enable file search/retrieval

  // OPTIONAL fields
  message_group_id?: string;              // Optional: Message grouping identifier
  reasoningEffort?: 'low' | 'medium' | 'high';  // Optional: Default 'medium'
  verbosity?: 'low' | 'medium' | 'high'; // Optional: Default 'medium'
  reasoningSummary?: 'auto' | 'detailed'; // Optional: Default 'auto'
  context?: 'chat';                       // Optional: Context type
  personalityMode?: 'safety-focused' | 'technical-expert' | 'friendly-assistant';
}
```

### Message Structure

Messages support both AI SDK v4 and v5 formats:

```typescript
interface ExtendedUIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';

  // Content formats (v4 compatibility)
  content?: string | Array<{
    type: string;
    text?: string;
    [key: string]: unknown;
  }>;

  // v5 parts format
  parts?: MessagePart[];

  // Timestamps
  createdAt?: Date;
  updatedAt?: Date;

  // File attachments
  experimental_attachments?: Array<{
    name: string;
    contentType: string;
    url: string;
    size?: number;
  }>;

  // AI-specific fields
  model?: string;
  provider?: string;
  reasoning?: Array<{ type: 'text'; text: string }>;
  langsmithRunId?: string | null;
}
```

### enableSearch Flag Behavior

The `enableSearch` flag controls retrieval behavior:

**When enableSearch = true:**
- If model supports native file_search tools → Use native OpenAI file search
- If model doesn't support file_search → Use fallback retrieval (vector/two-pass)

**When enableSearch = false:**
- No retrieval performed
- Standard chat completion without file search

**Retrieval Decision Logic:**
```typescript
// In RetrievalService.shouldUseFallbackRetrieval()
function shouldUseFallbackRetrieval(
  enableSearch: boolean,
  modelSupportsFileSearchTools: boolean
): boolean {
  return enableSearch && !modelSupportsFileSearchTools;
}
```

### Client-Side Integration

Example client-side usage with AI SDK v5:

```typescript
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

const { sendMessage } = useChat({
  transport: new DefaultChatTransport({
    api: '/api/chat',
  }),
  experimental_throttle: 60,
  onFinish: ({ message }) => {
    // Handle completion
  },
  onError: (error) => {
    // Handle errors
  },
});

// Send message with proper format
await sendMessage(
  { text: userInput },
  {
    body: {
      chatId: 'chat-123',
      userId: 'user-456',
      model: 'gpt-4',
      isAuthenticated: true,
      systemPrompt: 'You are a helpful assistant',
      enableSearch: false,
      reasoningEffort: 'medium',
      verbosity: 'low',
      reasoningSummary: 'auto',
      context: 'chat'
    }
  }
);
```

</details>

## ⚠️ Important Considerations

<warnings>
- **Authentication**: Guest users can only use free models or provide BYOK credentials
- **Rate Limiting**: Different limits apply for authenticated vs guest users
- **File Search**: Requires vector stores configured (OPENAI_VECTOR_STORE_IDS)
- **Model Support**: Not all models support native file_search tools
- **Message Validation**: All messages must pass Zod schema validation
- **Error Handling**: Always implement proper error boundaries for streaming responses
</warnings>

## 🔗 Resources

<references>
- [ChatService.ts](/Users/neo/Developer/experiments/HGG/robo-chat/lib/services/ChatService.ts) - Main service orchestration
- [schemas.ts](/Users/neo/Developer/experiments/HGG/robo-chat/lib/validation/schemas.ts) - Request validation schemas
- [StreamingService.ts](/Users/neo/Developer/experiments/HGG/robo-chat/lib/services/StreamingService.ts) - Response streaming
- [RetrievalService.ts](/Users/neo/Developer/experiments/HGG/robo-chat/lib/services/RetrievalService.ts) - File search handling
- [ai-extended.ts](/Users/neo/Developer/experiments/HGG/robo-chat/app/types/ai-extended.ts) - Message type definitions
</references>

## 🏷️ Metadata

<meta>
research-date: 2025-09-15
confidence: high
version-checked: AI SDK v5, GPT-5 support
architecture-pattern: service-oriented
</meta>

---

## Service Architecture Deep Dive

### 1. Request Flow

```
POST /api/chat
     ↓
ChatRequestSchema.safeParse() (Zod validation)
     ↓
ChatService.processChatRequest()
     ↓
RequestValidator.validateRequestData()
     ↓
RequestValidator.validateAndTrackUsage()
     ↓
ChatContextBuilder.buildChatContext()
     ↓
ModelConfigurationService.getModelConfiguration()
     ↓
[Decision Point: Fallback Retrieval?]
     ↓
RetrievalService.handleFallbackRetrieval() OR AIStreamHandler.createStreamingResponse()
     ↓
StreamingService.createStreamingResponse()
     ↓
Response (streamed)
```

### 2. Service Responsibilities

| Service | Responsibility |
|---------|---------------|
| **ChatService** | Main orchestration, coordinates all other services |
| **RequestValidator** | Validates requests, checks usage limits, transforms messages |
| **ChatContextBuilder** | Builds complete context (model, tools, credentials, prompts) |
| **ModelConfigurationService** | Model resolution, configuration, capability detection |
| **RetrievalService** | File search, vector retrieval, fallback handling |
| **StreamingService** | Response streaming, reasoning extraction, persistence |
| **AIStreamHandler** | Low-level AI SDK integration, tool invocations |

### 3. Message Transformation Pipeline

```
Raw Request Messages
     ↓
MessageService.transformMessagesToV5Format()
     ↓
MessageService.filterValidMessages()
     ↓
MessageService.convertToExtendedUIMessages()
     ↓
MessageService.createCompatibleMessages()
     ↓
AI SDK Compatible Messages
```

### 4. Authentication & Authorization Matrix

| User Type | Free Models | Paid Models | File Search | Rate Limits |
|-----------|-------------|-------------|-------------|-------------|
| **Authenticated** | ✅ Always | ✅ With API Key | ✅ With vector stores | Higher limits |
| **Guest (No BYOK)** | ✅ Limited | ❌ Forbidden | ❌ Forbidden | Lower limits |
| **Guest (With BYOK)** | ✅ Limited | ✅ With valid key | ✅ With valid key | Lower limits |

### 5. Error Handling Strategy

The architecture implements comprehensive error handling at multiple levels:

- **Validation Errors**: Caught by Zod schemas, return 400 with detailed error info
- **Authentication Errors**: Handled by RequestValidator, return 401/403
- **Rate Limit Errors**: Handled by usage tracking, return 429
- **Provider Errors**: Caught by StreamingService, return 500 with sanitized message
- **Streaming Errors**: Handled by AI SDK, graceful degradation

### 6. File Search Integration

The system supports multiple file search strategies:

1. **Native OpenAI File Search**: Used when model supports `file_search` tool
2. **Vector Retrieval**: Fallback using vector similarity search
3. **Two-Pass Retrieval**: Enhanced vector search with query rewriting via GPT-4.1

Configuration through environment variables:
- `OPENAI_VECTOR_STORE_IDS`: Native file search vector stores
- `RETRIEVAL_TWO_PASS_ENABLED`: Enable enhanced retrieval
- `RETRIEVAL_TOP_K`: Number of chunks to retrieve
- `RETRIEVAL_MAX_TOKENS`: Token budget for retrieved content

This architecture ensures robust, scalable, and maintainable chat functionality with comprehensive error handling and flexible retrieval capabilities.