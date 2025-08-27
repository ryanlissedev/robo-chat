# RoboChat AI Assistant - Agent Commands

## Quick Start
```bash
./SETUP.sh              # Run initial setup (installs deps, configures env)
npm run dev             # Start development server with Turbopack
npm run build           # Production build
npm start               # Start production server
```

## Development Commands
```bash
npm run type-check      # TypeScript validation
npm run lint            # Check code quality with Biome
npm run lint:fix        # Auto-fix linting issues
npm run format          # Format code with Biome
```

## Testing Commands
```bash
npm test                # Run all tests with Vitest
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests with Playwright
npm run test:coverage   # Generate coverage report
```

## Key Files
- `.env.local` - Environment variables (copy from .env.example)
- `app/` - Next.js 14 app directory
- `components/` - React components
- `lib/` - Utility functions and services
- `tests/` - Test suites (unit, integration, e2e)

## Tech Stack
Next.js 14, TypeScript, Tailwind CSS, Supabase, AI SDK v5, Vitest, Playwright