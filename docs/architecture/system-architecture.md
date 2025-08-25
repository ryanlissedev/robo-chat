# System Architecture Overview

This document provides a high-level system view of the Next.js app, backend API routes, domain libraries, and external dependencies.

## Runtime Topology

```mermaid
flowchart LR
  subgraph Browser [Browser]
    UI[React 19 UI Components\n`components/` & `app/components/`]
    Hook[AI Chat Hook\n`app/components/chat/use-chat-core.ts`]
  end

  subgraph NextApp [Next.js (App Router)]
    RouteChat[POST /api/chat\n`app/api/chat/route.ts`]
    RouteHealth[GET /api/health\n`app/api/health/route.ts`]
    OtherRoutes[Other API Routes\n`app/api/**`]
  end

  subgraph DomainLibs [Domain Libraries]
    LibChat[Chat Orchestration\n`lib/chat/**`]
    LibProviders[Model Providers\n`lib/openproviders/**`]
    LibLangsmith[LangSmith Client\n`lib/langsmith/client.ts`]
    LibSupabase[Supabase Helpers\n`lib/supabase/**`]
    LibLogger[Logger\n`lib/logger.ts`]
    LibConfig[App Config\n`lib/config.ts`]
    LibUsage[Usage & Limits\n`lib/usage.ts`]
  end

  subgraph Infra [External Services]

## Guest BYOK Flow (Browser → API → Providers)

- Browser (Guest): User supplies provider key in GuestKeyModal; stored per scope:
  - Request-only (no storage)
  - Tab memory (in-memory)
  - Session (AES-GCM; tab key in memory; bundle in sessionStorage)
  - Persistent (AES-GCM with passphrase; bundle in localStorage)
- Request: Client attaches headers when available
  - X-Model-Provider, X-Provider-Api-Key, X-Credential-Source=guest-byok
- API (app/api/chat/route.ts): Credential precedence
  - User BYOK → Guest header → Env key
  - Never persists guest keys; logs redact X-Provider-Api-Key
- Providers: lib/openproviders/index.ts uses apiKey override per call

    LLM[AI SDK v5 Providers\nOpenAI, Anthropic, Google, Mistral, xAI, etc.]
    Supabase[(Supabase Auth/DB/Storage)]
    LangSmith[(LangSmith Tracing)]
    Upstash[(Redis Cache) optional]
  end

  UI --> Hook
  Hook -->|DefaultChatTransport| RouteChat
  RouteChat --> LibProviders
  RouteChat --> LibLangsmith
  RouteChat --> LibLogger
  RouteChat --> LibChat
  RouteChat --> LibUsage
  RouteChat --> Supabase
  LibProviders --> LLM
  LibLangsmith --> LangSmith
  LibSupabase <--> Supabase
```

## Notes
- API routes in `app/api/**` orchestrate domain libraries in `lib/**`.
- `use-chat-core.ts` uses AI SDK v5 `useChat` with a `DefaultChatTransport` to stream UI messages.
- Observability via `lib/logger.ts` and optional LangSmith tracing (`lib/langsmith/client.ts`).
- Optional caching pattern in `app/api/chat/streaming.ts` references Upstash but currently falls back to `sessionStorage` (client-only), which is ineffective on server routes (see Data Flow & Gaps).
