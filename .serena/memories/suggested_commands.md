# RoboRail Assistant - Suggested Commands

## Development Commands (Bun-based)
```bash
# Development
bun run dev                    # Start development server with Turbopack
bun run build                  # Build for production
bun run start                  # Start production server
bun run type-check             # TypeScript type checking

# Testing
bun run test                   # Run unit tests with Vitest
bun run test:ui                # Run tests with UI
bun run test:coverage          # Run tests with coverage report
bun run test:watch             # Run tests in watch mode
bun run test:e2e               # Run Playwright e2e tests
bun run test:e2e:ui            # Run e2e tests with UI
bun run test:e2e:debug         # Debug e2e tests
bun run test:e2e:headed        # Run e2e tests in headed mode

# Playwright
bun run playwright:install     # Install Playwright browsers
bun run playwright:codegen     # Generate test code

# Code Quality
bun run lint                   # Run ESLint
bun run lint --fix             # Fix linting issues

# Package Management
bun install                    # Install dependencies
bun run install:clean          # Clean install (removes node_modules and bun.lockb)

# Makefile Commands
make help                      # Show available commands
make setup                     # Initial project setup
make dev                       # Start development server
make test                      # Run tests
make validate                  # Run all validation checks (lint, type-check, build)
make clean                     # Clean build artifacts
make reset                     # Reset project (clean + install)
make status                    # Show project status
```

## System Commands (macOS/Darwin)
```bash
# File operations
find . -name "*.ts" -type f    # Find TypeScript files
grep -r "pattern" --include="*.ts" .  # Search in TypeScript files
ls -la                         # List files with details
cd path/to/directory           # Change directory

# Git operations
git status                     # Check git status
git add .                      # Stage all changes
git commit -m "message"        # Commit changes
git push                       # Push to remote
git pull                       # Pull from remote

# Process management
ps aux | grep node             # Find Node.js processes
kill -9 PID                    # Kill process by PID
lsof -i :3000                  # Check what's using port 3000
```

## Environment Setup
```bash
# Copy environment template
cp .env.example .env.local

# Required environment variables
OPENAI_API_KEY=sk-...          # OpenAI API key with GPT-5 access
CSRF_SECRET=...                # 32-character random string

# Optional variables
LANGSMITH_API_KEY=ls-...       # LangSmith observability
NEXT_PUBLIC_SUPABASE_URL=...   # Supabase project URL
SUPABASE_SERVICE_ROLE=...      # Supabase service role key
```

## Testing Commands
```bash
# Unit tests
bun run test                   # Run all unit tests
bun run test lib/utils.test.ts # Run specific test file
bun run test:coverage          # Generate coverage report

# E2E tests
bun run test:e2e               # Run all e2e tests
bun run test:e2e --project=chromium  # Run on specific browser
bun run test:e2e --headed      # Run with browser visible
bun run test:e2e --debug       # Debug mode

# Test development
bun run playwright:codegen http://localhost:3000  # Generate test code
```

## Deployment Commands
```bash
# Docker
docker build -t roborail-assistant .
docker run -p 3000:3000 --env-file .env.local roborail-assistant

# Vercel
vercel deploy                  # Deploy to Vercel
vercel --prod                  # Deploy to production
```