# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

RoboRail is a Next.js TypeScript application providing AI-powered technical support for HGG RoboRail industrial machines. The application features multi-model AI chat, real-time voice interaction, document processing, and comprehensive technical support capabilities.

## Development Commands
use bun to run the commands
### Core Development
- `bun run dev` - Start development server with Turbo (port 3000)
- `bun run build` - Build for production
- `bun run start` - Start production server
- `bun run lint` - Run ESLint code linting
- `bun run type-check` - Run TypeScript type checking

### Testing
- `bunx playwright test` - Run all E2E tests
- `bunx playwright test --ui` - Run tests with UI mode
- `bunx playwright test --headed` - Run tests in headed mode
- `bunx playwright test tests/chat.spec.ts` - Run specific test file
- `bunx playwright codegen` - Generate test code interactively

## Architecture & Key Patterns

### Multi-AI Provider Architecture
The application supports multiple AI providers through a unified interface:
- **Provider Map**: `lib/openproviders/provider-map.ts` - Central registry of all AI providers
- **Model Definitions**: `lib/models/data/` - Individual provider configurations (OpenAI, Anthropic, Google, xAI, etc.)
- **Environment Configuration**: `lib/openproviders/env.ts` - API key validation and provider enablement

### Voice Integration Pattern
Real-time voice interaction using OpenAI Realtime API:
- **Voice Hook**: `app/components/voice/use-voice-connection.tsx` - Core voice connection logic
- **Recording Button**: `app/components/voice/voice-recording-button.tsx` - UI component
- **Integration**: Voice callbacks must be passed from Chat component to ChatInput component

### Document Processing Pipeline
Comprehensive document processing system in `data/` directory:
- **PDF Processing**: `data/pdf/` - Original technical manuals
- **Extraction**: `data/extracted/` - Processed document content with JSON/MD outputs
- **RAG System**: Embedded knowledge base for technical support queries

### State Management Architecture
- **Chat Store**: `lib/chat-store/` - Chat history and message management
- **User Store**: `lib/user-store/` - User preferences and authentication state  
- **Model Store**: `lib/model-store/` - AI model selection and configuration
- **Zustand Pattern**: Each store has provider.tsx and api.ts separation

### Security & Encryption
- **API Key Encryption**: `lib/encryption.ts` and `lib/security/encryption.ts` - Encrypted storage of user API keys
- **CSRF Protection**: `lib/csrf.ts` - Request validation
- **Input Sanitization**: `lib/sanitize.ts` - User input cleaning

## Important File Patterns

### API Routes Structure
All API routes are in `app/api/` with consistent patterns:
- `route.ts` - Main endpoint logic
- `api.ts` - Business logic (when present)
- Each route handles both GET/POST as appropriate

### Component Organization
- **Feature Components**: `app/components/[feature]/` - Feature-specific components
- **Shared Components**: `components/` - Reusable UI components (shadcn/ui based)
- **Layout Components**: `app/components/layout/` - Header, sidebar, settings organization

### Key Integration Points

#### Adding New AI Providers
1. Create provider config in `lib/models/data/[provider].ts`
2. Add to `lib/openproviders/provider-map.ts`
3. Update `lib/openproviders/env.ts` for API key validation
4. Add provider icon to `components/icons/[provider].tsx`

#### Voice Feature Integration
The voice button integration requires:
1. Import `useVoiceConnection` in parent component (Chat)  
2. Pass voice callbacks to child components (ChatInput)
3. Handle transcription results in input field

#### Document Processing
- New documents go in `data/pdf/`
- Processing creates JSON/MD in `data/extracted/`
- Embedding system uses structured data for RAG queries

## Technology Stack

### Core Framework
- **Next.js 15** with App Router and React 19
- **TypeScript** with strict configuration
- **Tailwind CSS** with custom theming system (`app/themes/`)

### AI & ML
- **Vercel AI SDK** for unified AI provider interface
- **OpenAI Realtime API** for voice interactions
- **LangSmith** integration for observability and tracing
- **Custom RAG System** for document-based knowledge retrieval

### Database & Storage
- **Supabase** (PostgreSQL) for data persistence
- **Migrations** in `supabase/migrations/`
- **Type Generation** via Supabase CLI

### UI Components
- **shadcn/ui** with **Radix UI** primitives
- **Phosphor Icons** for iconography
- **Framer Motion** for animations
- **Custom Theme System** with day/night switching

### Testing & Quality
- **Playwright** for comprehensive E2E testing
- **ESLint** with Next.js configuration
- **TypeScript** strict mode enforcement
- **Mock Testing System** (`lib/ai/models.test.ts`) for AI response simulation

## Environment Configuration

### Required Variables
- `OPENAI_API_KEY` - Required for GPT models and voice
- `CSRF_SECRET` - 32-character random string for security
- `ENCRYPTION_KEY` - Base64-encoded key for API key encryption
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE` - Server-side Supabase key

### Optional Observability
- `LANGSMITH_API_KEY` - For AI interaction tracing
- `LANGSMITH_PROJECT` - Project name (default: roborail)
- `LANGSMITH_TRACING` - Enable/disable tracing (default: true)

## Development Workflow

### Before Making Changes
1. Run `bun run type-check` to verify TypeScript compilation
2. Check for existing patterns in similar components
3. Review security implications for API key handling
4. Consider voice interaction impact for chat components

### Testing Strategy
- **E2E Tests**: Cover critical user flows (chat, voice, document search)
- **Mock Responses**: Use `lib/ai/models.test.ts` for predictable AI testing
- **Cross-browser**: Playwright tests on Chrome, Firefox, Safari, Edge
- **Mobile**: Test responsive design on mobile viewports

### Security Considerations
- Never log API keys, user data, or sensitive information
- Use encryption utilities for storing user API keys
- Validate and sanitize all user inputs
- Apply CSRF protection to state-changing operations
- Use server-side API validation for all external API calls

## Deployment Notes

### Production Build
- `bun run build` generates standalone output for containerization
- Bundle analysis available with `ANALYZE=true bun run build`
- Vercel deployment ready with proper environment variables

### Docker Support
- `Dockerfile` and `docker-compose.yml` available for containerized deployment
- Supports both local development and production deployment patterns