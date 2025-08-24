# 📚 API Reference

## Overview

RoboChat provides a RESTful API built with Next.js App Router. All API endpoints are located under `/api/` and support JSON request/response formats.

## Authentication

All API endpoints require authentication via Supabase Auth. Include the session token in requests:

```typescript
headers: {
  'Authorization': `Bearer ${session.access_token}`,
  'Content-Type': 'application/json'
}
```

## Core Endpoints

### Chat API

#### POST `/api/chat`
Stream chat completions with AI providers.

**Request Body:**
```typescript
interface ChatRequest {
  messages: Message[]
  model?: string // Default: 'gpt-4o-mini'
  provider?: string // Default: 'openai'
  temperature?: number // 0-1, Default: 0.7
  maxTokens?: number // Default: 4096
  tools?: string[] // Tool names to enable
  attachments?: Attachment[] // File attachments
  reasoningEffort?: 'low' | 'medium' | 'high'
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string | MessagePart[]
  reasoning?: ReasoningPart[]
}

interface Attachment {
  id: string
  name: string
  type: string
  size: number
  url?: string
}
```

**Response:**
Server-Sent Events (SSE) stream with chunks:
```typescript
// Text chunk
data: {"type":"text","content":"Hello"}

// Tool invocation
data: {"type":"tool","toolName":"search","args":{"query":"..."}}

// Reasoning
data: {"type":"reasoning","content":"Thinking about..."}

// Sources
data: {"type":"source","url":"https://...","title":"..."}

// Done
data: [DONE]
```

**Example:**
```typescript
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [
      { role: 'user', content: 'Hello!' }
    ],
    model: 'gpt-4o',
    provider: 'openai'
  })
})

const reader = response.body.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  
  const chunk = decoder.decode(value)
  const lines = chunk.split('\n')
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6)
      if (data === '[DONE]') break
      
      const parsed = JSON.parse(data)
      console.log(parsed)
    }
  }
}
```

### Feedback API

#### POST `/api/feedback`
Submit feedback for a message.

**Request Body:**
```typescript
interface FeedbackRequest {
  messageId: string
  chatId: string
  rating: 'positive' | 'negative'
  comment?: string
  metadata?: Record<string, any>
}
```

**Response:**
```typescript
interface FeedbackResponse {
  id: string
  success: boolean
  message?: string
}
```

### File API

#### POST `/api/files/upload`
Upload files for processing.

**Request:**
```typescript
const formData = new FormData()
formData.append('file', fileBlob)
formData.append('chatId', chatId)

const response = await fetch('/api/files/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData
})
```

**Response:**
```typescript
interface FileUploadResponse {
  id: string
  name: string
  size: number
  type: string
  url: string
  vectorStoreId?: string
}
```

#### GET `/api/files/:id`
Retrieve file metadata and content.

**Response:**
```typescript
interface FileResponse {
  id: string
  name: string
  content?: string // For text files
  url?: string // For binary files
  metadata: {
    size: number
    type: string
    createdAt: string
    vectorStoreId?: string
  }
}
```

#### DELETE `/api/files/:id`
Delete a file and its embeddings.

**Response:**
```typescript
interface DeleteResponse {
  success: boolean
  message: string
}
```

### Vector Store API

#### POST `/api/vector-stores`
Create a new vector store.

**Request Body:**
```typescript
interface CreateVectorStoreRequest {
  name: string
  provider: 'openai' | 'pinecone' | 'weaviate'
  files?: string[] // File IDs to add
  metadata?: Record<string, any>
}
```

**Response:**
```typescript
interface VectorStore {
  id: string
  name: string
  provider: string
  fileCount: number
  createdAt: string
}
```

#### POST `/api/vector-stores/:id/search`
Search within a vector store.

**Request Body:**
```typescript
interface VectorSearchRequest {
  query: string
  topK?: number // Default: 5
  threshold?: number // Similarity threshold 0-1
}
```

**Response:**
```typescript
interface SearchResult {
  results: Array<{
    id: string
    content: string
    score: number
    metadata: Record<string, any>
  }>
}
```

### User API

#### GET `/api/user/profile`
Get current user profile.

**Response:**
```typescript
interface UserProfile {
  id: string
  email: string
  name?: string
  avatar?: string
  preferences: {
    theme: 'light' | 'dark' | 'system'
    defaultModel: string
    defaultProvider: string
  }
  quotas: {
    messagesUsed: number
    messagesLimit: number
    storageUsed: number
    storageLimit: number
  }
}
```

#### PATCH `/api/user/preferences`
Update user preferences.

**Request Body:**
```typescript
interface UpdatePreferencesRequest {
  theme?: 'light' | 'dark' | 'system'
  defaultModel?: string
  defaultProvider?: string
  reasoningEffort?: 'low' | 'medium' | 'high'
}
```

### Settings API

#### GET `/api/settings/api-keys`
List user's API keys (encrypted).

**Response:**
```typescript
interface ApiKey {
  id: string
  provider: string
  maskedKey: string // e.g., "sk-...abc"
  createdAt: string
  lastUsed?: string
}
```

#### POST `/api/settings/api-keys`
Add a new API key.

**Request Body:**
```typescript
interface AddApiKeyRequest {
  provider: string
  key: string
  name?: string
}
```

#### DELETE `/api/settings/api-keys/:id`
Remove an API key.

## WebSocket Events

For real-time features, connect to WebSocket:

```typescript
const ws = new WebSocket(`wss://api.example.com/ws?token=${token}`)

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  switch (data.type) {
    case 'chat.message':
      // New message in chat
      break
    case 'chat.typing':
      // Someone is typing
      break
    case 'file.processed':
      // File processing complete
      break
  }
}
```

## Error Handling

All API errors follow a consistent format:

```typescript
interface ApiError {
  error: {
    code: string
    message: string
    details?: any
  }
  status: number
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Malformed request |
| 401 | `UNAUTHORIZED` | Missing or invalid auth |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Server error |

### Error Handling Example

```typescript
try {
  const response = await fetch('/api/chat', {
    method: 'POST',
    // ... request config
  })
  
  if (!response.ok) {
    const error = await response.json()
    
    switch (error.error.code) {
      case 'RATE_LIMITED':
        // Handle rate limiting
        await delay(error.error.details.retryAfter)
        break
      case 'UNAUTHORIZED':
        // Redirect to login
        router.push('/auth/login')
        break
      default:
        throw new Error(error.error.message)
    }
  }
} catch (error) {
  console.error('API Error:', error)
}
```

## Rate Limiting

API endpoints are rate-limited per user:

- **Chat API**: 60 requests/minute
- **File API**: 30 uploads/minute
- **Vector Store**: 100 searches/minute
- **Other endpoints**: 120 requests/minute

Rate limit headers:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1234567890
```

## Pagination

List endpoints support pagination:

```typescript
interface PaginationParams {
  page?: number // Default: 1
  limit?: number // Default: 20, Max: 100
  sort?: string // Field to sort by
  order?: 'asc' | 'desc'
}

interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}
```

Example:
```typescript
const response = await fetch('/api/chats?page=2&limit=10&sort=createdAt&order=desc')
```

## Webhooks

Configure webhooks for events:

```typescript
interface WebhookConfig {
  url: string
  events: string[]
  secret: string
}

// Events available:
// - chat.created
// - chat.completed
// - file.uploaded
// - file.processed
// - user.quota.exceeded
```

## SDK Usage

### TypeScript Client

```typescript
import { ChatClient } from '@/lib/api/client'

const client = new ChatClient({
  apiKey: process.env.API_KEY,
  baseUrl: 'https://api.example.com'
})

// Stream chat
const stream = await client.chat.stream({
  messages: [{ role: 'user', content: 'Hello' }],
  model: 'gpt-4o'
})

for await (const chunk of stream) {
  console.log(chunk)
}

// Upload file
const file = await client.files.upload(fileBlob, {
  chatId: 'chat-123'
})

// Search vector store
const results = await client.vectorStores.search('store-id', {
  query: 'search term',
  topK: 10
})
```

## API Versioning

The API uses URL-based versioning:

- Current version: `/api/v1/`
- Legacy support: 6 months
- Deprecation notices: Via headers

```
X-API-Version: v1
X-API-Deprecation: 2024-12-31
```

## OpenAPI Specification

Download the OpenAPI spec:
```bash
curl https://api.example.com/openapi.json
```

Import to Postman/Insomnia for testing.