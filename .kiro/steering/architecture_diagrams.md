---
inclusion: always
---

# Architecture Patterns & Principles

## System Architecture

Base Chat follows a layered architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer (React)                     │
├─────────────────────────────────────────────────────────────┤
│  UI Components  │  State Management  │  Hooks & Utilities  │
│  - shadcn/ui    │  - Zustand stores  │  - Custom hooks     │
│  - AI elements  │  - TanStack Query  │  - Event handlers   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   API Layer (Next.js)                      │
├─────────────────────────────────────────────────────────────┤
│   Route Handlers  │   Middleware   │   Business Logic     │
│   - /api/chat     │   - CSRF       │   - Chat operations  │
│   - /api/settings │   - Auth       │   - User management  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                 Integration Layer                           │
├─────────────────────────────────────────────────────────────┤
│  AI Providers  │   Database    │   External Services      │
│  - OpenAI      │   - Supabase  │   - LangSmith           │
│  - Anthropic   │   - Auth      │   - File Search         │
│  - Google      │   - Storage   │   - Vector Stores       │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Patterns

### Chat Message Flow
1. **User Input** → Chat Input Component
2. **State Update** → Zustand Chat Store (optimistic)
3. **API Request** → `/api/chat` route handler
4. **AI Processing** → Vercel AI SDK → Provider APIs
5. **Streaming Response** → Real-time UI updates
6. **Persistence** → Supabase database
7. **Observability** → LangSmith tracing

### State Management Architecture
- **Client State (Zustand)**: UI state, temporary data, user preferences
- **Server State (TanStack Query)**: API data, caching, background sync
- **Database State (Supabase)**: Persistent data, user sessions, chat history

## Component Architecture Principles

### Composition Over Inheritance
- Use React composition patterns
- Prefer small, focused components
- Leverage shadcn/ui primitives as building blocks

### Separation of Concerns
```
Component Structure:
├── Presentation Layer    # Pure UI components
├── Logic Layer          # Custom hooks, business logic
├── Data Layer           # API calls, state management
└── Integration Layer    # External service connections
```

### Component Patterns
- **Container Components**: Handle data fetching and state
- **Presentation Components**: Pure UI with props interface
- **Hook Components**: Encapsulate reusable logic
- **Provider Components**: Context and state management

## API Design Patterns

### Route Handler Structure
```typescript
// Standard pattern for API routes
export async function POST(request: Request) {
  // 1. Authentication & authorization
  // 2. Input validation & sanitization
  // 3. Business logic execution
  // 4. Response formatting
  // 5. Error handling
}
```

### Error Handling Strategy
- **Client Errors (4xx)**: Validation, authentication issues
- **Server Errors (5xx)**: System failures, external service issues
- **Graceful Degradation**: Fallback behaviors for service outages

### Security Patterns
- **CSRF Protection**: Token-based request validation
- **Input Sanitization**: All user inputs cleaned and validated
- **Rate Limiting**: Prevent abuse of API endpoints
- **Encryption**: Sensitive data encrypted at rest

## AI Integration Architecture

### Provider Abstraction
```typescript
// Unified interface for all AI providers
interface AIProvider {
  generateResponse(messages: Message[]): AsyncIterable<string>
  supportedModels: Model[]
  rateLimits: RateLimit
}
```

### Model Selection Strategy
- **User Preference**: Saved model selections per user
- **Fallback Chain**: Automatic failover between providers
- **Cost Optimization**: Route to appropriate model based on complexity

### Streaming Implementation
- **Server-Sent Events**: Real-time response streaming
- **Optimistic Updates**: Immediate UI feedback
- **Error Recovery**: Handle stream interruptions gracefully

## Database Architecture

### Schema Design Principles
- **Normalized Structure**: Minimize data duplication
- **RLS Policies**: Row-level security for multi-tenant data
- **Indexing Strategy**: Optimize for common query patterns
- **Migration Management**: Version-controlled schema changes

### Data Access Patterns
- **Repository Pattern**: Centralized data access logic
- **Query Optimization**: Efficient database queries
- **Caching Strategy**: Reduce database load with smart caching

## Performance Optimization

### Client-Side Optimization
- **Code Splitting**: Dynamic imports for large components
- **Lazy Loading**: Load components on demand
- **Memoization**: Prevent unnecessary re-renders
- **Bundle Analysis**: Monitor and optimize bundle size

### Server-Side Optimization
- **Response Caching**: Cache static and semi-static responses
- **Database Optimization**: Efficient queries and indexing
- **CDN Integration**: Static asset delivery optimization

## Deployment Architecture

### Environment Strategy
- **Development**: Local development with hot reload
- **Staging**: Production-like environment for testing
- **Production**: Optimized build with monitoring

### Scaling Considerations
- **Horizontal Scaling**: Stateless API design
- **Database Scaling**: Read replicas and connection pooling
- **CDN Strategy**: Global content distribution
- **Monitoring**: Performance and error tracking

## Extension Points

### Adding New AI Providers
1. Implement provider interface in `lib/openproviders/`
2. Add model configurations in `lib/models/data/`
3. Update provider map and UI selectors
4. Test integration and error handling

### Custom Tool Integration
1. Define tool interface in `lib/tools/`
2. Implement tool logic and validation
3. Register with AI SDK tool system
4. Add UI components for tool results
