# RoboChat AI Assistant - Agent Setup

## Quick Setup
```bash
./SETUP.sh               # Automated setup (deps, env, validation)
pnpm dev                 # Start dev server (http://localhost:3000)
pnpm build && pnpm start # Production mode
```

## Core Commands
```bash
pnpm type-check          # TypeScript validation
pnpm lint:fix            # Auto-fix code issues
pnpm test                # Run all tests
pnpm test:e2e            # Playwright E2E tests
```

## Environment Setup
- Copy `.env.example` to `.env.local`
- Required: Supabase URL/key, AI provider keys
- Optional: Additional AI providers, CSRF secret

## Project Structure
- `app/` - Next.js 14 app router
- `components/` - React components
- `lib/` - Core utilities
- `tests/` - Test suites

## Tech Stack
Next.js 14, TypeScript, Tailwind CSS v4, Supabase, AI SDK v5, Vitest, Playwright