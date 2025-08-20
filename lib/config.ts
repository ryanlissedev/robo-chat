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
    label: "Brainstorm",
    highlight: "Brainstorm",
    prompt: `Brainstorm`,
    items: [
      "Brainstorm ideas for a weekend project",
      "Brainstorm marketing angles for a new product",
      "Brainstorm ways to improve team collaboration",
      "Brainstorm names for a newsletter or app",
    ],
    icon: Sparkle,
  },
  {
    label: "Write",
    highlight: "Write",
    prompt: `Write`,
    items: [
      "Write a friendly email to a client about a project update",
      "Write a concise bio for my profile",
      "Write a blog post outline on a topic I choose",
      "Write social captions in different tones (formal, playful, witty)",
    ],
    icon: Notepad,
  },
  {
    label: "Summarize",
    highlight: "Summarize",
    prompt: `Summarize`,
    items: [
      "Summarize an article into key bullet points",
      "Summarize a long email thread with action items",
      "Summarize a meeting transcript with decisions and owners",
      "Summarize this text at beginner, intermediate, and expert levels",
    ],
    icon: BookOpenText,
  },
  {
    label: "Explain",
    highlight: "Explain",
    prompt: `Explain`,
    items: [
      "Explain this concept to me like I'm new to it",
      "Explain pros and cons of two options I provide",
      "Explain how to get started learning a topic with a plan",
      "Explain trade-offs and recommend a choice based on my goals",
    ],
    icon: Lightbulb,
  },
  {
    label: "Improve",
    highlight: "Improve",
    prompt: `Improve`,
    items: [
      "Improve this paragraph for clarity and tone",
      "Improve grammar and make this text more concise",
      "Improve and adapt this email for a different audience",
      "Improve structure: rewrite with headings and bullet points",
    ],
    icon: PaintBrush,
  },
  {
    label: "Code",
    highlight: "Code",
    prompt: `Code`,
    items: [
      "Code a small utility function from my description",
      "Code review this snippet and suggest improvements",
      "Code a test for this function using my framework",
      "Code: explain this error and how to fix it",
    ],
    icon: Code,
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
