# RoboRail 🛡️

**Advanced AI Safety & Security Chat Platform**

[roborail.chat](https://roborail.chat)

RoboRail is the open-source AI assistant specialized in AI safety, security, and production deployment. Built on GPT-5 with advanced reasoning capabilities, file search, and comprehensive observability through LangSmith.

![RoboRail Cover](./public/cover_roborail.jpg)

## 🚀 Core Features

### GPT-5 Integration
- **GPT-5 Mini**: Fast, efficient responses with file search (default)
- **GPT-5 Standard**: Balanced performance for complex tasks
- **GPT-5 Pro**: Maximum capabilities for deep analysis

### Advanced Capabilities
- **🔍 File Search**: Native OpenAI document retrieval and vector search
- **🧠 Adjustable Reasoning**: Control analysis depth (Low/Medium/High)
- **📊 LangSmith Integration**: Complete observability and tracing
- **👍 Feedback System**: Upvote/downvote with optional comments
- **🔐 Security-First**: Built-in safety guardrails and content moderation
- **📁 Multi-format Support**: PDF, code files, documentation analysis

### Specialized Expertise
- AI security frameworks and red teaming
- Production AI system deployment
- Advanced RAG pipelines and vector optimization
- Security-first development practices
- Multi-agent orchestration
- Evaluation and testing frameworks

## 🛠️ Quick Start

### Prerequisites
- Node.js 18+
- OpenAI API key with GPT-5 access
- (Optional) LangSmith API key for observability
- (Optional) Supabase project for persistence

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/roborail.git
cd roborail

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev
```

Visit `http://localhost:3000` to start using RoboRail!

### Docker Deployment

```bash
# Build and run with Docker
docker build -t roborail .
docker run -p 3000:3000 --env-file .env.local roborail
```

### Production Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-org/roborail)

## 💬 Example Prompts

### AI Security & Safety
- "Help me implement input validation and sanitization for my LLM application"
- "Design a red teaming framework for testing AI model robustness"
- "Create a content moderation pipeline with safety classifiers"
- "Implement rate limiting and abuse prevention for an AI API"
- "Build a prompt injection detection system"

### Production Deployment
- "Set up monitoring and alerting for AI model performance degradation"
- "Design a blue-green deployment strategy for model updates"
- "Implement A/B testing for different model versions"
- "Create a rollback strategy for failed model deployments"
- "Build an observability stack for AI system metrics"

### RAG & Vector Search
- "Optimize my RAG pipeline for better retrieval accuracy"
- "Implement hybrid search with keyword and semantic matching"
- "Design a chunking strategy for technical documentation"
- "Create a multi-index architecture for different document types"
- "Build a reranking system for search results"

### Evaluation & Testing
- "Create a comprehensive evaluation suite for my chatbot"
- "Design regression tests for model updates"
- "Implement automated quality checks for AI responses"
- "Build a benchmark dataset for my specific use case"
- "Create a human-in-the-loop evaluation workflow"

### Multi-Agent Systems
- "Design an agent orchestration system for complex workflows"
- "Implement tool use validation and error handling"
- "Create a supervisor agent for quality control"
- "Build a consensus mechanism for multi-agent decisions"
- "Design fault-tolerant agent communication"

## 🔧 Configuration

### Environment Variables

```bash
# Core Configuration
OPENAI_API_KEY=sk-...              # Required: OpenAI API key with GPT-5 access
ROBORAIL_MODE=production           # App mode: development/staging/production

# LangSmith Observability (Recommended)
LANGSMITH_API_KEY=ls-...           # LangSmith API key
LANGSMITH_PROJECT=roborail         # Project name for tracing
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

## 📊 Observability with LangSmith

RoboRail includes comprehensive LangSmith integration for:
- **Trace Analysis**: View complete execution traces
- **Performance Metrics**: Token usage, latency, throughput
- **User Feedback**: Correlate feedback with specific runs
- **Error Tracking**: Identify and debug issues
- **A/B Testing**: Compare different configurations

Access your traces at: `https://smith.langchain.com/project/roborail`

## 🗄️ Database Schema

When using Supabase, RoboRail automatically manages:
- Chat history and message storage
- User feedback and ratings
- File attachments and vector stores
- Usage analytics and metrics

Run migrations:
```bash
npx supabase migration up
```

## 🔐 Security Features

- **Input Validation**: Automatic sanitization of user inputs
- **Rate Limiting**: Configurable per-user and per-IP limits
- **Content Filtering**: Built-in safety classifiers
- **Audit Logging**: Complete activity tracking
- **RLS Policies**: Row-level security for multi-tenancy
- **CSRF Protection**: Token-based request validation

## 🛠️ Development

### Tech Stack
- **Frontend**: Next.js 14, React 18, TypeScript
- **UI**: Tailwind CSS, shadcn/ui, Radix UI
- **AI**: OpenAI GPT-5, Vercel AI SDK
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

- **GitHub Issues**: [Report bugs or request features](https://github.com/your-org/roborail/issues)
- **Discord**: [Join our community](https://discord.gg/roborail)
- **Documentation**: [docs.roborail.ai](https://docs.roborail.ai)

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

RoboRail is designed for defensive security and safety applications. It should not be used for:
- Creating malicious code or exploits
- Bypassing security measures
- Unauthorized access or attacks
- Any illegal or unethical activities

---

**RoboRail** - Your AI Safety & Security Copilot 🛡️