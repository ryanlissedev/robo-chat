# RoboChat AI Assistant - Agent Commands

## Quick Start
```bash
./SETUP.sh              # Run initial setup (installs deps, configures env)
pnpm run dev             # Start development server with Turbopack
pnpm run build           # Production build
pnpm start               # Start production server
```

## Development Commands
```bash
pnpm run type-check      # TypeScript validation
pnpm run lint            # Check code quality with Biome
pnpm run lint:fix        # Auto-fix linting issues
pnpm run format          # Format code with Biome
```

## Testing Commands
```bash
pnpm test                # Run all tests with Vitest
pnpm run test:unit       # Unit tests only
pnpm run test:integration # Integration tests
pnpm run test:e2e        # End-to-end tests with Playwright
pnpm run test:coverage   # Generate coverage report
```

## Key Files
- `.env.local` - Environment variables (copy from .env.example)
- `app/` - Next.js 14 app directory
- `components/` - React components
- `lib/` - Utility functions and services
- `tests/` - Test suites (unit, integration, e2e)

## Tech Stack
Next.js 14, TypeScript, Tailwind CSS, Supabase, AI SDK v5, Vitest, Playwright