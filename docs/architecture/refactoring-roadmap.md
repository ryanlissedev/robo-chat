### Refactoring Roadmap

#### Prioritized Matrix (Impact ⬆ / Effort ⬇ favored)

| Item | Area | Impact (1-5) | Effort (1-5) | Priority |
|---|---|---:|---:|---|
| Replace console with logger in server | Observability | 4 | 1 | High |
| Zod schemas for /api/chat and shared | Validation | 5 | 2 | High |
| Split services.ts into focused modules | Architecture | 4 | 3 | High |
| Consolidate OpenRouter config duplication | Providers | 3 | 2 | Med |
| Remove unused deps (exa-js, embla-*) | Dependencies | 3 | 1 | Med |
| Enforce no-any in server modules | TS Quality | 4 | 3 | Med |
| Centralize env flags helpers | DX | 2 | 1 | Med |
| Server-side cache (Redis) option | Perf | 3 | 3 | Med |
| UI memoization in chat lists | Perf | 3 | 2 | Med |

---

### Vertical Slices (each = branch + PR)

#### Slice RS-01: Introduce Zod validation for /api/chat
- Complexity: 3/10; Effort: ~0.5-1 day; Deps: none
- Steps:
  1) Create `app/api/chat/schemas.ts` with request/response Zod schemas
  2) Replace ad-hoc checks in `validation.ts` with schema.parse + safeParse
  3) Add unit tests for edge cases; adapt existing tests
  4) Wire typed responses; keep legacy compatibility
- DoD:
  - [ ] All new validations tested
  - [ ] TypeScript infers `ValidatedChatRequest` from Zod
  - [ ] No runtime type errors

#### Slice RS-02: Replace console with structured logger
- Complexity: 2/10; Effort: ~0.25 day; Deps: RS-01 optional
- Steps:
  1) Search server files for console.* and replace with `logger` calls
  2) Ensure no secrets/keys logged; remove key length logs
  3) Add unit tests for error paths using logger spies
- DoD: no console in server modules; tests green

#### Slice RS-03: Extract services.ts into modules
- Complexity: 5/10; Effort: ~1-2 days; Deps: RS-01
- Steps:
  - Create `auth-and-usage.ts`, `model-resolution.ts`, `persistence.ts`, `telemetry.ts`
  - Move logic and update imports; keep public API stable
  - Add unit tests per module
- DoD: file < 500 LOC each; coverage maintained

#### Slice RS-04: Provider factory typing and OpenRouter consolidation
- Complexity: 4/10; Effort: ~1 day; Deps: RS-03
- Steps:
  - Define `ProviderClient` interface and return type for `openproviders()`
  - Create helper to DRY OpenRouter API key wiring
- DoD: no `unknown`/`any` in factory; duplicated config removed

#### Slice RS-05: Env helpers and config hardening
- Complexity: 2/10; Effort: ~0.5 day; Deps: none
- Steps:
  - `lib/env.ts` for safe getters, booleans, required vars
  - Replace direct `process.env` access in hot paths
- DoD: consistent env access; tests added

#### Slice RS-06: Optional server cache layer (Redis)
- Complexity: 5/10; Effort: ~1 day; Deps: RS-01
- Steps:
  - Introduce Redis client behind interface; feature-flag via env
  - Implement `getCachedResponse`/`cacheResponse` using Redis when enabled
- DoD: integration test proving cache hit/miss behavior

#### Slice RS-07: UI performance pass for chat lists
- Complexity: 3/10; Effort: ~0.5 day; Deps: none
- Steps:
  - Audit `message` rendering and memoize row components
  - Verify stable keys; avoid index keys
- DoD: Render count reduced in profiler

---

### Process Quality Gates (per PR)
- Tests (unit/integration/e2e) all pass; coverage unchanged or improved
- TS strict: no `any` or `unknown` leakage in public types
- Lint and format clean (Ultracite/Biome)
- Build succeeds and basic smoke run OK
- Security scan (secrets, CSP if applicable) clean

### Research Resources
- AI SDK v5 docs, Zod docs, Pino logger best practices, Supabase JS client, LangSmith usage
- Prompts for juniors: “Map all console.* usages to structured logging events with fields; ensure no PII or secrets are logged.”
