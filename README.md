# RoboRail Assistant Chat

Powerful AI chat platform for productive conversations.

RoboRail Assistant Chat is a sophisticated AI chat platform that supports GPT-5 models, optional file search, and observability hooks. It's designed to be your intelligent assistant for all your conversational needs.

## 🚀 Core Features

### Models (incl. GPT-5)

- **GPT-5 Mini**: Fast, efficient (default)
- **GPT-5 Standard**: Balanced performance
- **GPT-5 Pro**: Deep analysis

### Capabilities

- 🔍 Optional file search (OpenAI vector stores)
- 🧠 Reasoning effort (Low/Medium/High)
- 📊 Observability hooks (LangSmith optional)
- 👍 Feedback system (optional)
- 🔐 Sensible defaults (rate limits, sanitization)
- 📁 Multi-format support (PDF/code/docs)

This scaffold is intentionally neutral. Add your own domain expertise via prompts, tools, and UI.

## 🛠️ Quick Start

### Prerequisites

- Node.js 18+
- OpenAI API key with GPT-5 access
- (Optional) LangSmith API key for observability
- (Optional) Supabase project for persistence

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/roborail-assistant-chat.git
cd roborail-assistant-chat

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
pnpm run dev
```

Visit `http://localhost:3000` to start using RoboRail Assistant Chat!

### Docker Deployment

```bash
# Build and run with Docker
docker build -t base-chat .
docker run -p 3000:3000 --env-file .env.local base-chat
```

### Production Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-org/base-chat)

## 💬 Example Prompts

Try these generic starters:

- "Brainstorm ideas for a weekend project"
- "Summarize this article into bullet points"
- "Explain this concept to a beginner"
- "Improve this paragraph for clarity"
- "Write a short email about a project update"
- "Why am I getting this error? Suggest a fix"

## 🔧 Configuration

### Environment Variables

```bash
# Core Configuration
OPENAI_API_KEY=sk-...              # Required: OpenAI API key (GPT-5 optional)
APP_MODE=production                # App mode: development/staging/production

# LangSmith Observability (Recommended)
LANGSMITH_API_KEY=ls-...           # LangSmith API key (optional)
LANGSMITH_PROJECT=base-chat        # Project name for tracing
LANGSMITH_TRACING=true             # Enable tracing

# Supabase (Optional - for persistence)
NEXT_PUBLIC_SUPABASE_URL=...       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...  # Supabase anonymous key
SUPABASE_SERVICE_ROLE=...          # Service role key

# Security
CSRF_SECRET=...                    # 32-character random string
RATE_LIMIT_ENABLED=true           # Enable rate limiting
MAX_REQUESTS_PER_MINUTE=60        # Rate limit threshold
```

### Reasoning Effort Levels

Configure the default reasoning effort in your chat:

- **Low**: Fast responses, basic analysis (~ 1-2 seconds)
- **Medium**: Balanced depth and speed (~ 3-5 seconds) [Default]
- **High**: Deep analysis, comprehensive reasoning (~ 5-10 seconds)

## 📊 Observability with LangSmith (Optional)

Base Chat includes hooks for LangSmith:

- **Trace Analysis**: View complete execution traces
- **Performance Metrics**: Token usage, latency, throughput
- **User Feedback**: Correlate feedback with specific runs
- **Error Tracking**: Identify and debug issues
- **A/B Testing**: Compare different configurations

Access your traces at: `https://smith.langchain.com/project/base-chat`

## 🗄️ Database Schema

When using Supabase, Base Chat can manage:

- Chat history and message storage
- User feedback and ratings
- File attachments and vector stores
- Usage analytics and metrics

Run migrations:

```bash
npx supabase migration up
```

## 🔐 Security Defaults

- Input sanitization helpers
- Rate limiting hooks
- Optional content filtering
- Audit logging scaffolds
- RLS policies via Supabase (optional)
- CSRF protection

## 🛠️ Development

### Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **AI**: OpenAI (incl. GPT-5), Vercel AI SDK
- **Observability**: LangSmith, OpenTelemetry
- **Database**: Supabase (PostgreSQL)
- **Deployment**: Vercel, Docker

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Run security audit
npm audit

# Type checking
npm run type-check
```

## 📚 Documentation

- [Installation Guide](./docs/INSTALL.md)
- [Configuration Reference](./docs/CONFIG.md)
- [API Documentation](./docs/API.md)
- [Security Best Practices](./docs/SECURITY.md)
- [Deployment Guide](./docs/DEPLOY.md)

## 🤝 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/your-org/base-chat/issues)
- **Documentation**: add your own docs site link

## 📄 License

Apache License 2.0 - See [LICENSE](./LICENSE) for details

## 🙏 Acknowledgments

Built with:

- [OpenAI GPT-5](https://openai.com) — Advanced language model
- [LangSmith](https://smith.langchain.com) — LLM observability
- [Vercel AI SDK](https://sdk.vercel.ai) — AI integration framework
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [Supabase](https://supabase.com) — Backend infrastructure

## ⚠️ Disclaimer

This scaffold should not be used for:

- Creating malicious code or exploits
- Bypassing security measures
- Unauthorized access or attacks
- Any illegal or unethical activities

---

**Base Chat** - A clean starting point for AI chat
