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

export const NON_AUTH_ALLOWED_MODELS = ["gpt-5-mini", "gpt-4o-mini"]

export const FREE_MODELS_IDS = [
  "openrouter:deepseek/deepseek-r1:free",
  "openrouter:meta-llama/llama-3.3-8b-instruct:free",
  "pixtral-large-latest",
  "mistral-large-latest",
  "gpt-5-mini",
  "gpt-4o-mini",
]

export const MODEL_DEFAULT = "gpt-5-mini"

export const APP_NAME = "RoboRail"
export const APP_DOMAIN = "https://roborail.chat"

export const SUGGESTIONS = [
  {
    label: "RoboRail Equipment",
    highlight: "Optimize",
    prompt: `Optimize`,
    items: [
      "Optimize rail grinding patterns for maximum efficiency on curved tracks",
      "Optimize cutting parameters for different steel grades in rail maintenance",
      "Optimize RoboRail positioning system for complex track geometries",
      "Optimize maintenance scheduling for RoboRail fleet operations",
    ],
    icon: Code,
  },
  {
    label: "Track Analysis",
    highlight: "Analyze",
    prompt: `Analyze`,
    items: [
      "Analyze track wear patterns and predict maintenance intervals",
      "Analyze rail surface defects and recommend grinding strategies",
      "Analyze track geometry data for safety compliance",
      "Analyze vibration data from RoboRail operations for equipment health",
    ],
    icon: Brain,
  },
  {
    label: "Safety Protocols",
    highlight: "Design",
    prompt: `Design`,
    items: [
      "Design safety protocols for RoboRail operations in active rail corridors",
      "Design emergency stop procedures for automated rail maintenance",
      "Design worker safety zones around RoboRail equipment",
      "Design communication protocols between RoboRail and train dispatchers",
    ],
    icon: PaintBrush,
  },
  {
    label: "Automation",
    highlight: "Implement",
    prompt: `Implement`,
    items: [
      "Implement autonomous navigation for RoboRail on complex track layouts",
      "Implement predictive maintenance algorithms for grinding equipment",
      "Implement real-time quality monitoring for rail surface finishing",
      "Implement automated reporting systems for track maintenance operations",
    ],
    icon: Sparkle,
  },
  {
    label: "Technical Support",
    highlight: "Troubleshoot",
    prompt: `Troubleshoot`,
    items: [
      "Troubleshoot hydraulic system pressure irregularities in RoboRail",
      "Troubleshoot grinding wheel wear patterns and replacement timing",
      "Troubleshoot positioning accuracy issues in curved track sections",
      "Troubleshoot communication errors between RoboRail control systems",
    ],
    icon: Notepad,
  },
  {
    label: "Process Planning",
    highlight: "Plan",
    prompt: `Plan`,
    items: [
      "Plan efficient work sequences for multi-kilometer rail grinding projects",
      "Plan RoboRail deployment strategy for high-traffic corridors",
      "Plan preventive maintenance schedules for optimal equipment uptime",
      "Plan operator training programs for new RoboRail technology",
    ],
    icon: BookOpenText,
  },
  {
    label: "Best Practices",
    highlight: "Explain",
    prompt: `Explain`,
    items: [
      "Explain proper grinding techniques for different rail profiles and conditions",
      "Explain environmental considerations for rail maintenance operations",
      "Explain quality standards and acceptance criteria for rail surface finishing",
      "Explain integration of RoboRail systems with existing railway infrastructure",
    ],
    icon: Lightbulb,
  },
]

export const ROBORAIL_SYSTEM_PROMPT = `You are the RoboRail Assistant, an AI expert on the RoboRail machine manufactured by HGG Profiling Equipment b.v. Your primary function is to answer honestly but briefly, assisting users with operation, maintenance, troubleshooting, and safety of the RoboRail.

## Key Responsibilities

1. **Query Response:** 
   - Provide concise answers based on the RoboRail manual and your knowledge base.
   - For complex queries, offer a brief response first, then ask if the user requires more details.

2. **Troubleshooting Guidance:**
   - Ask targeted questions to efficiently diagnose issues.
   - Systematically diagnose problems by querying users about symptoms, recent changes, or error messages.

3. **Instructional Support:**
   - Provide clear, step-by-step instructions for operations, maintenance, and calibrations upon request.
   
4. **Safety Emphasis:**
   - Highlight potential hazards and proper safety protocols to ensure user safety during operations.

5. **AI Capabilities:**
   - If inquired about your AI abilities, respond briefly, redirecting focus to RoboRail assistance.

6. **Code and Command Formatting:**
   - Use proper formatting for code examples or machine commands:
     \`\`\`language-name
     code here
     \`\`\`

7. **Clarification and Follow-ups:**
   - Promptly clarify ambiguous queries and ask follow-up questions to provide accurate and helpful information.

8. **Complex Issue Handling:**
   - For issues beyond your scope, recommend contacting HGG customer support and provide their contact information.

9. **Initial Response Strategy:**
   - Provide concise initial responses and then offer additional detail or guidance if requested.

## Output Format

- Provide responses in concise sentences or short paragraphs.
- Use code block formatting for machine commands or code examples where needed.

## Notes

- Ensure all interactions prioritize user safety and proper machine operation.
- Maintain clarity and brevity in all communications.

Your goal is to be a knowledgeable, efficient, and safety-conscious assistant in all aspects of the RoboRail machine.`

export const SYSTEM_PROMPT_DEFAULT = ROBORAIL_SYSTEM_PROMPT

export const FILE_SEARCH_SYSTEM_PROMPT = ROBORAIL_SYSTEM_PROMPT

export const MESSAGE_MAX_LENGTH = 10000
