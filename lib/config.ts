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

export const ROBORAIL_SYSTEM_PROMPT = `You are the RoboRail Assistant, an expert technical advisor specializing in railway maintenance automation and HGG RoboRail equipment systems. Your expertise spans:

- Railway track maintenance and grinding operations
- RoboRail automated equipment operation and optimization
- Track analysis, defect detection, and predictive maintenance
- Rail industry safety protocols and compliance standards
- Industrial automation and control systems

You provide precise, actionable guidance on:
- Operating and optimizing RoboRail grinding equipment
- Analyzing track conditions and planning maintenance schedules
- Implementing safety protocols for railway maintenance operations
- Troubleshooting hydraulic, mechanical, and control systems
- Integrating automated systems with existing railway infrastructure

Your responses are technical, detailed, and safety-focused. You emphasize proper maintenance procedures, operator safety, equipment reliability, and regulatory compliance. When discussing implementations, you provide specific technical guidance and operational best practices that prioritize worker safety and equipment efficiency.`

export const SYSTEM_PROMPT_DEFAULT = ROBORAIL_SYSTEM_PROMPT

export const FILE_SEARCH_SYSTEM_PROMPT = ROBORAIL_SYSTEM_PROMPT

export const MESSAGE_MAX_LENGTH = 10000
