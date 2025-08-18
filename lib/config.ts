import {
  BookOpenText,
  Brain,
  Code,
  Lightbulb,
  Notepad,
  PaintBrush,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr"

export const NON_AUTH_DAILY_MESSAGE_LIMIT = 5
export const AUTH_DAILY_MESSAGE_LIMIT = 1000
export const REMAINING_QUERY_ALERT_THRESHOLD = 2
export const DAILY_FILE_UPLOAD_LIMIT = 5
export const DAILY_LIMIT_PRO_MODELS = 500

export const NON_AUTH_ALLOWED_MODELS = ["gpt-5-mini"]

export const FREE_MODELS_IDS = [
  "openrouter:deepseek/deepseek-r1:free",
  "openrouter:meta-llama/llama-3.3-8b-instruct:free",
  "pixtral-large-latest",
  "mistral-large-latest",
  "gpt-5-mini",
]

export const MODEL_DEFAULT = "gpt-5-mini"

export const APP_NAME = "RoboRail"
export const APP_DOMAIN = "https://roborail.chat"

export const SUGGESTIONS = [
  {
    label: "Security",
    highlight: "Implement",
    prompt: `Implement`,
    items: [
      "Implement input validation and sanitization for my LLM application",
      "Implement rate limiting and abuse prevention for an AI API",
      "Implement a prompt injection detection system",
      "Implement secure API key management for production",
    ],
    icon: Code,
  },
  {
    label: "Red Team",
    highlight: "Design",
    prompt: `Design`,
    items: [
      "Design a red teaming framework for testing AI model robustness",
      "Design adversarial test cases for my chatbot",
      "Design a jailbreak detection system",
      "Design security benchmarks for LLM applications",
    ],
    icon: PaintBrush,
  },
  {
    label: "Production",
    highlight: "Create",
    prompt: `Create`,
    items: [
      "Create a monitoring dashboard for AI model performance",
      "Create a rollback strategy for failed model deployments",
      "Create an A/B testing framework for model versions",
      "Create a CI/CD pipeline for safe model updates",
    ],
    icon: Sparkle,
  },
  {
    label: "RAG & Search",
    highlight: "Optimize",
    prompt: `Optimize`,
    items: [
      "Optimize my RAG pipeline for better retrieval accuracy",
      "Optimize chunking strategies for technical documentation",
      "Optimize vector embeddings for semantic search",
      "Optimize reranking for multi-index architectures",
    ],
    icon: BookOpenText,
  },
  {
    label: "Evaluation",
    highlight: "Build",
    prompt: `Build`,
    items: [
      "Build a comprehensive evaluation suite for my chatbot",
      "Build automated quality checks for AI responses",
      "Build regression tests for model updates",
      "Build a human-in-the-loop evaluation workflow",
    ],
    icon: Notepad,
  },
  {
    label: "Multi-Agent",
    highlight: "Architect",
    prompt: `Architect`,
    items: [
      "Architect an agent orchestration system for complex workflows",
      "Architect tool use validation and error handling",
      "Architect a supervisor agent for quality control",
      "Architect fault-tolerant agent communication",
    ],
    icon: Brain,
  },
  {
    label: "Best Practices",
    highlight: "Explain",
    prompt: `Explain`,
    items: [
      "Explain OWASP Top 10 for LLM applications",
      "Explain defense-in-depth for AI systems",
      "Explain responsible AI disclosure practices",
      "Explain compliance requirements for AI in production",
    ],
    icon: Lightbulb,
  },
]

export const ROBORAIL_SYSTEM_PROMPT = `You are the RoboRail Assistant, an expert technical advisor specializing in AI safety, security, and production deployment. Your expertise spans:

- AI security frameworks and red teaming methodologies
- Production AI system deployment and monitoring
- Advanced RAG pipelines and vector search optimization
- Security-first development practices and compliance
- Multi-agent orchestration and evaluation frameworks

You provide precise, actionable guidance on:
- Implementing safety guardrails and content moderation
- Designing secure AI architectures with proper isolation
- Optimizing retrieval systems for accuracy and relevance
- Building robust evaluation and testing frameworks
- Establishing monitoring and observability for AI systems

Your responses are technical, detailed, and security-conscious. You emphasize defensive coding, proper authentication, rate limiting, and audit logging. When discussing implementations, you provide specific code examples and architectural patterns that prioritize safety and reliability.`

export const SYSTEM_PROMPT_DEFAULT = ROBORAIL_SYSTEM_PROMPT

export const FILE_SEARCH_SYSTEM_PROMPT = ROBORAIL_SYSTEM_PROMPT

export const MESSAGE_MAX_LENGTH = 10000
