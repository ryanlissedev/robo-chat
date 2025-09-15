# RoboChat Agents Guide

This guide explains how to work with agents, MCP tools, and swarm-style coordination in RoboChat. It consolidates the essentials from CLAUDE.md and adapts them to this codebase.

## Quick Start
```bash
./SETUP.sh               # Automated setup (deps, env, validation)
pnpm dev                 # Start dev server (http://localhost:3000)
pnpm build && pnpm start # Production mode
```

Core commands:
```bash
pnpm type-check          # TypeScript validation
pnpm lint:fix            # Auto-fix code issues (Biome config)
pnpm test                # Run unit/integration tests (Vitest)
pnpm test:e2e            # Playwright E2E tests
```

## Environment
1) Copy `.env.example` to `.env.local`
2) Required variables: Supabase URL/key, OpenAI/Anthropic (or other provider) keys
3) Optional: additional AI providers, CSRF secret, gateway settings

See `docs/AI_GATEWAY.md` and `docs/guides/ONBOARDING.md` for provider setup details.

## Project Structure
- `app/`        Next.js 14 App Router
- `components/` UI components (Tailwind v4)
- `lib/`        Core services, models, MCP utilities
- `tests/`      Unit, integration, and E2E tests
- `docs/`       Architecture, performance, troubleshooting
- `swarm-config/` Swarm topologies and agent specs
- `memory/agents/` Persistent per‑agent memory areas

## MCP and Agents
RoboChat supports MCP (Model Context Protocol) clients and tools via AI SDK v5.

MCP loaders in this repo:
- `lib/mcp/load-mcp-from-local.ts`  Use a local MCP server via stdio
- `lib/mcp/load-mcp-from-url.ts`    Connect to an MCP server via SSE

Example: add Claude Flow MCP server (optional)
```bash
claude mcp add claude-flow npx claude-flow@alpha mcp start
```

Then, load tools from your app code using the provided helpers. The returned client exposes MCP tools adapted to AI SDK tools.

References:
- `docs/ai_sdk_llm.md` (MCP sections)
- `CLAUDE.md` (coordination conventions)

## Swarm Topologies and Agent Specs
- `swarm-config/mesh-topology.json` defines a mesh network of 8 independent agents for maximum parallelism
- `swarm-config/agent-specifications.md` documents each agent’s role and deliverables

Guidelines derived from CLAUDE.md:
- Batch related operations: prefer a single, well‑scoped invocation per multi‑step task
- Keep outputs organized: never write transient outputs at repo root; prefer `docs/`, `memory/`, or relevant subdirs
- Use independent agents where possible to maximize parallel execution and fault isolation

## Agent Memory
Use `memory/agents/` for per‑agent state and `memory/agents/shared/` for cross‑agent knowledge.
See `memory/agents/README.md` for directory conventions and best practices (isolation, persistence, cleanup).

## Development Workflow
Recommended loop for agentic development:
1) Define or choose a topology in `swarm-config/`
2) Ensure environment keys and MCP server (if used) are configured
3) Implement features in `lib/services/` and UI in `components/app/chat/`
4) Validate via `pnpm test` and `pnpm test:e2e`
5) Document outcomes in `docs/` (e.g., performance notes, integration details)

Related references:
- Performance: `src/lib/performance/*`, `docs/performance-optimization-guide.md`, `PERFORMANCE_OPTIMIZATION_SUMMARY.md`
- Chat flow: `components/app/chat/*`, `docs/chat-flow-architecture.md`
- Providers/models: `lib/models/*`, `app/api/providers/route.ts`

## GPT‑5 Integration
GPT‑5 family is integrated through OpenAI’s Responses API in this project.
- Overview and code paths: `docs/GPT5_IMPLEMENTATION.md`
- Frontend/streaming support: `lib/services/StreamingResponseService.ts`
- Tests and validation: see `tests/**/gpt5*` and related references in `docs/TEST-RESULTS.md`

## Troubleshooting
- General: `docs/guides/TROUBLESHOOTING.md`
- Security: `docs/SECURITY.md`
- Test infra: `docs/TEST_INFRASTRUCTURE_FIXES.md`

## Notes and Conventions
- Keep docs in `docs/`; avoid writing ad‑hoc files to repo root
- Prefer editing existing files over creating new ones unless required
- Use `SETUP.sh` to bootstrap local dev and validation
- Follow CLAUDE.md for batching/coordination semantics when running agent swarms

---

If you want, I can wire a minimal example that loads MCP tools at runtime and demonstrates a simple multi‑agent workflow using the mesh topology above.
