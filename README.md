# RoboRail Assistant 🤖

**AI-Powered Technical Support for HGG RoboRail Machine**

![HGG Logo](./public/hgg-logo.svg)

The RoboRail Assistant is an intelligent AI-powered support system designed specifically for the RoboRail machine manufactured by HGG Profiling Equipment b.v. Built on GPT-5 with advanced reasoning capabilities, it provides instant access to technical documentation, troubleshooting guidance, and operational instructions.

## 🚀 Core Features

### Intelligent Technical Support
- **Instant Answers**: 24/7 access to RoboRail technical information
- **Multi-Turn Conversations**: Natural dialogue for complex troubleshooting
- **Voice Interaction**: Hands-free operation support via speech-to-speech
- **Document Search**: RAG-powered search through technical manuals

### Advanced AI Capabilities
- **🧠 Adjustable Reasoning**: Control analysis depth (Low/Medium/High)
- **📁 Multi-format Support**: PDF, DOCX, HTML documentation processing
- **🔍 Contextual Search**: Find relevant information across all manuals
- **📊 LangSmith Integration**: Complete observability and tracing
- **👍 Feedback System**: Upvote/downvote with optional comments

### RoboRail Expertise
- Machine operation procedures and best practices
- Maintenance schedules and repair instructions
- Safety protocols and compliance guidelines
- Troubleshooting guides for common issues
- Technical specifications and part information
- Emergency procedures and safety warnings

## 🛠️ Quick Start

### Prerequisites
- Node.js 18+
- OpenAI API key with GPT-5 access
- (Optional) LangSmith API key for observability
- (Optional) Supabase project for conversation history

### Installation

```bash
# Clone the repository
git clone https://github.com/HGG-Profiling/roborail-assistant.git
cd roborail-assistant

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local with your API keys

# Run development server
npm run dev
```

Visit `http://localhost:3000` to start using the RoboRail Assistant!

### Docker Deployment

```bash
# Build and run with Docker
docker build -t roborail-assistant .
docker run -p 3000:3000 --env-file .env.local roborail-assistant
```

### Production Deployment

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/HGG-Profiling/roborail-assistant)

## 👥 User Personas

### Machine Operator
- Responsible for day-to-day RoboRail operation
- Needs quick access to operating procedures and basic troubleshooting
- Benefits from voice interaction while working hands-on

### Maintenance Technician  
- Performs routine maintenance and repairs
- Requires detailed technical specifications and maintenance schedules
- Uses advanced troubleshooting guides and repair procedures

### Safety Officer
- Ensures safe and compliant operations
- Needs access to safety manuals and emergency procedures
- Reviews compliance guidelines and safety protocols

## 💬 Example Questions

### Operation & Procedures
- "How do I start up the RoboRail machine safely?"
- "What are the daily pre-operation checks I need to perform?"
- "Show me the proper cutting sequence for steel beams"
- "What safety equipment is required when operating the machine?"

### Maintenance & Troubleshooting
- "The cutting head is producing rough edges - what should I check?"
- "When was the last recommended maintenance for the hydraulic system?"
- "How do I replace the cutting torch consumables?"
- "The machine stopped mid-cut - what are the possible causes?"

### Technical Specifications
- "What is the maximum cutting thickness for stainless steel?"
- "Show me the wiring diagram for the control panel"
- "What are the recommended cutting speeds for different materials?"
- "Where can I find the part number for the drive motor?"

### Safety & Emergency
- "What should I do if there's a gas leak during operation?"
- "Show me the emergency stop procedures"
- "What personal protective equipment is required?"
- "How do I safely shut down the machine for maintenance?"

## 🔧 Configuration

### Environment Variables

```bash
# Core Configuration
OPENAI_API_KEY=sk-...              # Required: OpenAI API key with GPT-5 access
ROBORAIL_MODE=production           # App mode: development/staging/production

# LangSmith Observability (Recommended)
LANGSMITH_API_KEY=ls-...           # LangSmith API key
LANGSMITH_PROJECT=roborail-assistant # Project name for tracing
LANGSMITH_TRACING=true             # Enable tracing

# Supabase (Optional - for conversation history)
NEXT_PUBLIC_SUPABASE_URL=...       # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...  # Supabase anonymous key
SUPABASE_SERVICE_ROLE=...          # Service role key

# Security & Rate Limiting
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

The RoboRail Assistant includes comprehensive LangSmith integration for:
- **Trace Analysis**: View complete execution traces for troubleshooting sessions
- **Performance Metrics**: Token usage, latency, and response times
- **User Feedback**: Correlate technician feedback with specific interactions
- **Error Tracking**: Identify and debug technical support issues
- **Usage Analytics**: Monitor which topics are most frequently asked

Access your traces at: `https://smith.langchain.com/project/roborail-assistant`

## 🗄️ Database Schema

When using Supabase, the RoboRail Assistant automatically manages:
- Conversation history and technical support sessions
- User feedback and satisfaction ratings
- Document attachments and technical manuals
- Usage analytics and support metrics

Run migrations:
```bash
npx supabase migration up
```

## 🔐 Security Features

- **Input Validation**: Automatic sanitization of technical queries
- **Rate Limiting**: Configurable limits to prevent system overload
- **Data Privacy**: Secure handling of proprietary technical information
- **Audit Logging**: Complete tracking of support interactions
- **Access Control**: Role-based access for different user types
- **CSRF Protection**: Token-based request validation

## 🛠️ Development

### Tech Stack Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    RoboRail Assistant Architecture              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Frontend Layer                 Backend Layer                   │
│  ┌─────────────────┐           ┌─────────────────┐              │
│  │   Next.js 14    │◄────────► │   API Routes    │              │
│  │   React 18      │           │   (Next.js)     │              │
│  │   TypeScript    │           └─────────────────┘              │
│  └─────────────────┘                     │                     │
│           │                              │                     │
│           ▼                              ▼                     │
│  ┌─────────────────┐           ┌─────────────────┐              │
│  │ UI Components   │           │   AI Services   │              │
│  │ ├─Tailwind CSS  │           │ ├─OpenAI GPT-5  │              │
│  │ ├─shadcn/ui     │◄────────► │ ├─Vercel AI SDK │              │
│  │ ├─Radix UI      │           │ └─RAG System    │              │
│  │ └─Phosphor Icons│           └─────────────────┘              │
│  └─────────────────┘                     │                     │
│           │                              │                     │
│           ▼                              ▼                     │
│  ┌─────────────────┐           ┌─────────────────┐              │
│  │ User Interface  │           │   Data Layer    │              │
│  │ ├─Chat Input    │◄────────► │ ├─Supabase      │              │
│  │ ├─Reasoning UI  │           │ ├─PostgreSQL    │              │
│  │ ├─File Upload   │           │ └─Vector Store  │              │
│  │ └─Voice I/O     │           └─────────────────┘              │
│  └─────────────────┘                     │                     │
│                                          │                     │
│                                          ▼                     │
│           Observability & Monitoring                           │
│           ┌─────────────────────────────┐                      │
│           │ ├─LangSmith Tracing         │                      │
│           │ ├─Performance Metrics       │                      │
│           │ ├─User Feedback System      │                      │
│           │ └─Error Tracking            │                      │
│           └─────────────────────────────┘                      │
└─────────────────────────────────────────────────────────────────┘
```

### Core Technologies
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

## 📚 Documentation & Learning Resources

### Installation Guides
- [General Installation Guide](./INSTALL.md)
- [Windows Installation Guide](./docs/WINDOWS_INSTALL.md) - Complete step-by-step guide for Windows
- [Configuration Reference](./docs/CONFIG.md)
- [Deployment Guide](./docs/DEPLOY.md)

### Learning Resources

```
┌─────────────────────────────────────────────────────────────────┐
│                    Learning Path for Developers                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Beginner Path              Advanced Path                       │
│  ┌─────────────────┐       ┌─────────────────┐                 │
│  │   JavaScript    │       │   TypeScript    │                 │
│  │   Fundamentals  │────► │   Advanced      │                 │
│  │                 │       │                 │                 │
│  └─────────────────┘       └─────────────────┘                 │
│           │                          │                         │
│           ▼                          ▼                         │
│  ┌─────────────────┐       ┌─────────────────┐                 │
│  │     React       │       │    Next.js      │                 │
│  │   Components    │────► │   App Router    │                 │
│  │     & Hooks     │       │   & Server      │                 │
│  └─────────────────┘       └─────────────────┘                 │
│           │                          │                         │
│           ▼                          ▼                         │
│  ┌─────────────────┐       ┌─────────────────┐                 │
│  │   Tailwind CSS  │       │   AI/LLM APIs   │                 │
│  │   & shadcn/ui   │────► │   Integration   │                 │
│  │                 │       │                 │                 │
│  └─────────────────┘       └─────────────────┘                 │
│                                     │                         │
│                                     ▼                         │
│                           ┌─────────────────┐                 │
│                           │  RoboRail Dev   │                 │
│                           │   Ready! 🎯     │                 │
│                           └─────────────────┘                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Frontend Development
- **JavaScript**: [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- **TypeScript**: [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- **React**: [React Documentation](https://react.dev/learn)
- **Next.js**: [Next.js Documentation](https://nextjs.org/docs)

#### Styling & UI
- **Tailwind CSS**: [Tailwind CSS Docs](https://tailwindcss.com/docs)
- **shadcn/ui**: [shadcn/ui Components](https://ui.shadcn.com/)
- **Radix UI**: [Radix UI Primitives](https://www.radix-ui.com/docs/primitives)

#### AI & Backend
- **OpenAI API**: [OpenAI Platform Docs](https://platform.openai.com/docs)
- **Vercel AI SDK**: [AI SDK Documentation](https://sdk.vercel.ai/docs)
- **LangSmith**: [LangSmith Docs](https://docs.smith.langchain.com/)

#### Database & Storage
- **Supabase**: [Supabase Documentation](https://supabase.com/docs)
- **PostgreSQL**: [PostgreSQL Tutorial](https://www.postgresql.org/docs/)

## 🤝 Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/HGG-Profiling/roborail-assistant/issues)
- **HGG Support**: Contact your local HGG representative
- **Technical Documentation**: Access through the assistant interface

## 🏢 About HGG Profiling Equipment b.v.

HGG Profiling Equipment is a leading manufacturer of automated cutting and drilling machines for the steel construction and shipbuilding industries. The RoboRail machine is designed for high-precision profiling of steel beams and structural components.

## 📄 License

Apache License 2.0 - See [LICENSE](./LICENSE) for details

## 🙏 Acknowledgments

Built with:
- [OpenAI GPT-5](https://openai.com) — Advanced language model
- [LangSmith](https://smith.langchain.com) — LLM observability
- [Vercel AI SDK](https://sdk.vercel.ai) — AI integration framework
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [Supabase](https://supabase.com) — Backend infrastructure

## 📋 Success Metrics

- **User Satisfaction**: Measured through feedback ratings
- **Issue Resolution**: Percentage of queries successfully resolved
- **Support Efficiency**: Reduction in traditional support ticket volume
- **Adoption Rate**: Active users across different roles

---

**RoboRail Assistant** - Your AI-Powered Technical Support System 🤖