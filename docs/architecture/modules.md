### Module Boundaries and Contracts

- UI Layer (`app/components/**`, `components/**`)
  - Contracts: Typed props, minimal business logic, uses Zustand/TanStack Query
  - A11y: follow project rule-set; avoid console; prefer `logger` only in server

- API Layer (`app/api/**/route.ts` + chat submodules)
  - `validation.ts`: Normalize and validate request; RECOMMEND move to Zod schemas
  - `services.ts`: User validation, provider selection, system prompt resolution, persistence
  - `streaming.ts`: Streaming orchestration, monitoring hooks, cache key derivation
  - `utils.ts`: Error mapping and helpers

- Domain/Lib Layer (`lib/**`)
  - `openproviders/*`: Adapter/factory over provider SDKs; decouples API route from vendors
  - `models/*`: Registry and dynamic discovery (Ollama) with caching
  - `tools/*`: Zod-powered tools for search and internal knowledge
  - `security/*`, `csrf.ts`, `encryption.ts`: Security primitives
  - `supabase/*`: Client builders and feature flags
  - `logger.ts`: Pino instance

- Stores (`lib/*-store/**`)
  - UI state, user preferences, model store; avoid server-only code here

- Testing (`tests/**`)
  - Unit, integration, e2e; Playwright fixtures & setup

Design Patterns in Use / Proposed:
- Adapter/Factory: `openproviders` (in use)
- Strategy: provider selection per model (in use)
- Facade: `services.ts` consolidates concerns (in use; could be further split)
- Plugin Tools: `tools/*` exposed to models (in use; expand via typed interfaces)
- CQRS hint: Separate read/write in services and persistence (proposed)
