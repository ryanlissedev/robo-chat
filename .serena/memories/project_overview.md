# RoboRail Assistant Project Overview

## Purpose
RoboRail Assistant is an AI-powered technical support system designed specifically for the RoboRail machine manufactured by HGG Profiling Equipment b.v. It provides instant access to technical documentation, troubleshooting guidance, and operational instructions using GPT-5 with advanced reasoning capabilities.

## Core Features
- **Intelligent Technical Support**: 24/7 access to RoboRail technical information
- **Multi-Turn Conversations**: Natural dialogue for complex troubleshooting
- **Voice Interaction**: Hands-free operation support via speech-to-speech
- **Document Search**: RAG-powered search through technical manuals
- **Adjustable Reasoning**: Control analysis depth (Low/Medium/High)
- **Multi-format Support**: PDF, DOCX, HTML documentation processing
- **LangSmith Integration**: Complete observability and tracing
- **Feedback System**: Upvote/downvote with optional comments

## Target Users
- **Machine Operators**: Day-to-day RoboRail operation and basic troubleshooting
- **Maintenance Technicians**: Detailed technical specs and maintenance procedures
- **Safety Officers**: Safety manuals and emergency procedures

## Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, shadcn/ui, Radix UI, Phosphor Icons
- **AI**: OpenAI GPT-5, Vercel AI SDK, Multiple AI providers
- **Backend**: Next.js API routes, Node.js
- **Database**: Supabase (PostgreSQL), Vector Store
- **Observability**: LangSmith, OpenTelemetry
- **Testing**: Vitest (unit), Playwright (e2e)
- **Package Manager**: Bun
- **Deployment**: Vercel, Docker