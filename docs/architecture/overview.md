### System Architecture Overview

This document describes the high-level system architecture for the Next.js AI chat application. Secrets or environment-specific values are intentionally omitted.

```mermaid
graph LR
  subgraph Client [Browser / UI]
    A[React UI\napp/components/**]
    A --> B[Zustand Stores\nlib/*-store/**]
    A --> C[TanStack Query Provider]
  end

  subgraph NextApp [Next.js App]
    D[API Routes\napp/api/**/route.ts]
    D --> D1[Chat Route\napp/api/chat/route.ts]
    D1 --> D1a[Validation\napp/api/chat/validation.ts]
    D1 --> D1b[Services\napp/api/chat/services.ts]
    D1 --> D1c[Streaming\napp/api/chat/streaming.ts]
    D1 --> D1d[Utils / Errors\napp/api/chat/utils.ts]

    D --> D2[Monitoring\napp/api/monitoring/route.ts]
    D --> D3[Settings & Keys\napp/api/settings/**]
    D --> D4[User Prefs / Keys\napp/api/user-*/*]
  end

  subgraph DomainLib [Domain / Lib Layer]
    L1[Models Registry\nlib/models/**]
    L2[OpenProviders Factory\nlib/openproviders/**]
    L3[Tools (zod)\nlib/tools/**]
    L4[Security & CSRF\nlib/security/**, lib/csrf.ts]
    L5[Supabase Clients\nlib/supabase/**]
    L6[LangSmith Client\nlib/langsmith/**]
    L7[Logger (pino)\nlib/logger.ts]
  end

  subgraph External [External Services]
    X1[AI Providers\nOpenAI, Anthropic, Google, etc.]
    X2[Ollama (local)\nHTTP API]
    X3[Supabase]
    X4[LangSmith]
    X5[Browser Storage\nsessionStorage (cache)]
  end

  A -->|fetch| D
  D1a --> L1
  D1b --> L1
  D1b --> L2
  D1b --> L5
  D1b --> L7
  D1c --> L7
  L2 --> X1
  L2 --> X2
  L5 --> X3
  L6 --> X4
  D2 --> L7
  D1c --> X5
```

Key notes:
- Clear boundary between UI, API routes, domain/lib utilities, and external services
- Provider access is abstracted via `lib/openproviders` using an adapter/factory pattern
- Streaming concerns isolated in `app/api/chat/streaming.ts` with monitoring hooks
- Optional caching uses sessionStorage client-side; upgradeable to Redis/Upstash
