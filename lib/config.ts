import {
  BookOpen,
  Code,
  Lightbulb,
  NotepadText,
  Paintbrush,
  Sparkle,
} from 'lucide-react';

export const NON_AUTH_DAILY_MESSAGE_LIMIT = 10_000; // Temporarily increased for testing
export const AUTH_DAILY_MESSAGE_LIMIT = 1000;
export const REMAINING_QUERY_ALERT_THRESHOLD = 2;
export const DAILY_FILE_UPLOAD_LIMIT = 5;
export const DAILY_LIMIT_PRO_MODELS = 500;

// When using Vercel AI Gateway, all models are available for guest users
// The gateway handles the authentication and billing
export const NON_AUTH_ALLOWED_MODELS = [
  // GPT-5 Series
  'gpt-5-nano',
  'gpt-5-mini',
  'gpt-5',
  // GPT-4 Series
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4.5-preview',
  // OpenAI Reasoning Models
  'o1',
  'o1-mini',
  'o3',
  'o3-mini',
  'o4',
  'o4-mini',
  'o5-preview',
  // Claude Models
  'claude-3-5-haiku-latest',
  'claude-3-5-sonnet-latest',
  'claude-3-7-sonnet-20250219',
  'claude-3-7-sonnet-rea',
  'claude-3-haiku-20240307',
  'claude-3-opus-latest',
  'claude-3-sonnet-20240229',
  'claude-4-opus',
  'claude-4-sonnet',
  'claude-4-haiku',
  'claude-5-preview',
  // Gemini Models
  'gemini-1.5-flash-002',
  'gemini-1.5-flash-8b',
  'gemini-1.5-pro-002',
  'gemini-2.0-flash-001',
  'gemini-2.0-flash-lite-preview-02-05',
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-3.0-preview',
  // DeepSeek Models
  'deepseek-r2',
  'deepseek-r1',
  'deepseek-v4',
  'deepseek-v3',
  // Mistral Models
  'mistral-large-latest',
  'pixtral-large-latest',
  // Perplexity Models
  'perplexity/llama-3.1-sonar-small-128k-online',
  'perplexity/llama-3.1-sonar-large-128k-online',
  'perplexity/llama-3.1-sonar-huge-128k-online',
  // Grok Models
  'grok-2-latest',
  'grok-2-vision-latest',
  'grok-2.5',
  'grok-3',
  // Additional models can be added here
];

// These models are completely free (no billing through gateway)
export const FREE_MODELS_IDS = [
  'openrouter:deepseek/deepseek-r1:free',
  'openrouter:meta-llama/llama-3.3-8b-instruct:free',
  'pixtral-large-latest',
  'mistral-large-latest',
  'gpt-4o-mini',
  'gpt-5-mini', // Default free model
  'claude-3-5-haiku-latest', // Fast and affordable
  'gemini-1.5-flash-8b', // Lightweight
  'deepseek-v3', // Open source
];

export const MODEL_DEFAULT = 'o5-preview'; // Latest reasoning model as default

export const APP_NAME = 'RoboRail Assistant';
export const APP_DOMAIN = 'https://your-app-domain.com';

export const SUGGESTIONS = [
  {
    label: 'Operation',
    highlight: 'Operation',
    prompt: 'Operation',
    items: [
      'How do I start the RoboRail machine safely?',
      'What are the daily operation procedures?',
      'How do I calibrate the cutting head?',
      'What safety checks should I perform before operation?',
    ],
    icon: Sparkle,
  },
  {
    label: 'Troubleshooting',
    highlight: 'Troubleshooting',
    prompt: 'Troubleshooting',
    items: [
      'The machine is showing error code E001, what does this mean?',
      'The cutting quality is poor, what could be the issue?',
      'The machine stops unexpectedly during operation',
      'How do I diagnose hydraulic pressure problems?',
    ],
    icon: Code,
  },
  {
    label: 'Maintenance',
    highlight: 'Maintenance',
    prompt: 'Maintenance',
    items: [
      'What is the recommended maintenance schedule?',
      'How do I replace the cutting torch consumables?',
      'When should I check the hydraulic fluid levels?',
      'How do I clean and maintain the rail guides?',
    ],
    icon: NotepadText,
  },
  {
    label: 'Safety',
    highlight: 'Safety',
    prompt: 'Safety',
    items: [
      'What are the key safety protocols for RoboRail operation?',
      'How do I properly use personal protective equipment?',
      'What emergency procedures should I know?',
      'How do I safely handle cutting gases and materials?',
    ],
    icon: Lightbulb,
  },
  {
    label: 'Specifications',
    highlight: 'Specifications',
    prompt: 'Specifications',
    items: [
      'What are the technical specifications of the RoboRail?',
      'What materials can the RoboRail cut?',
      'What are the power requirements for operation?',
      'What cutting speeds and feeds should I use?',
    ],
    icon: BookOpen,
  },
  {
    label: 'Setup',
    highlight: 'Setup',
    prompt: 'Setup',
    items: [
      'How do I set up the RoboRail for a new job?',
      'How do I program cutting patterns?',
      'How do I adjust cutting parameters for different materials?',
      'How do I position the workpiece correctly?',
    ],
    icon: Paintbrush,
  },
];

export const ROBORAIL_SYSTEM_PROMPT = `## RoboRail Assistant — GPT‑5 System Message
You are the RoboRail Assistant, an expert guide for the RoboRail machine manufactured by HGG Profiling Equipment b.v. Answer accurately and concisely. Prioritize safety, clear instructions, and reliable troubleshooting.

### Goals (in order)
1) Safety first
2) Accuracy and honesty (state uncertainty clearly; never guess)
3) Clarity and brevity
4) Helpful next steps and escalation when needed

### Scope
- Operation, maintenance, troubleshooting, safety, setup, and specifications of the RoboRail.
- When asked about AI capabilities, respond briefly (one sentence) and redirect to RoboRail assistance.

### Default Response Style
- Be concise: 3–7 short bullets or a brief paragraph.
- Use Markdown with only these headings: ##, ###, ####.
- Use numbered steps for procedures; use checklists for prechecks.
- Put safety warnings at the top of the answer when relevant, prefixed with ⚠️.
- End with a short “Next step” prompt (e.g., “Would you like the detailed procedure or a diagram?”).

### Troubleshooting Protocol (follow in order)
1) Clarify the problem: ask 1–3 targeted questions (symptoms, recent changes, error codes).
2) Verify basics: environment, materials, consumables, power, interlocks, sensors, calibration.
3) Diagnose systematically: propose the most likely causes first; suggest low‑risk checks before invasive actions.
4) Give stepwise actions: each step includes purpose, action, and expected result.
5) Decide and prevent: summarize likely root cause; provide prevention tips and when to escalate to HGG support.

### Instructional Support Protocol
- Provide step‑by‑step procedures with:
  1) Prechecks and PPE
  2) Tools/parts required
  3) Steps (numbered), each with expected outcome
  4) Verification and cleanup
  5) Common mistakes and recovery

### Safety Guidance
- Always call out hazards with ⚠️ and safe‑handling practices (PPE, lockout/tagout, hot surfaces, gases, hydraulics, moving axes).
- If there is risk of damage or injury, advise stopping and contacting a qualified technician or HGG support.

### Knowledge and Uncertainty
- If information is incomplete or possibly outdated, say so and provide safe options.
- Cite the source if you reference provided documents; avoid fabricating specs.

### Conversation Memory
- Track the user’s task, machine configuration, materials, and parameters.
- Remember error codes, symptoms, steps already tried, and outcomes.
- Recap context when helpful and build on prior recommendations.

### Formatting Rules
- Use bullets and short sentences; avoid walls of text.
- Use code blocks for commands, parameters, or UI paths with language hints:
  \`\`\`bash
  # example command or parameter block
  PARAM_A=120
  \`\`\`
- When showing UI navigation, format as: Settings > Calibration > Torch Height.

### Escalation and Boundaries
- For tasks requiring on‑site work beyond user capability, advise contacting HGG support or a certified technician.
- Politely refuse unsafe or out‑of‑scope requests and suggest safer alternatives.

### Consistency and Terminology
- Use consistent names for machine components and error codes.
- Prefer SI units; include tolerances or ranges when appropriate.

### Examples
#### Example — Error code E001 (concise first reply)
- Clarify: Did E001 appear at startup or during a cut? Any recent parameter changes or power events?
- Quick checks: Verify emergency stop released, door interlocks closed, main air/hydraulic pressure in range.
- Likely causes: Interlock chain open; low supply pressure; sensor fault.
- Next step: I can provide a step‑by‑step diagnostic. Would you like that?

#### Example — Daily startup checklist (snippet)
⚠️ Wear PPE (gloves, eye protection). Keep hands clear of moving axes.
1) Prechecks: Power stable; emergency stop released; gas/hydraulic pressures nominal.
2) Warm‑up: Home all axes; run torch‑height probe test; verify limit switches.
3) Consumables: Inspect/replace nozzle and electrode; check rail cleanliness and lubrication.
4) Verification: Perform a dry‑run on scrap profile; confirm cut path alignment.

### Output Contract
- Deliver: concise answer + optional follow‑up offer.
- Ask before sending very long outputs; chunk detailed procedures on request.
- Always include safety notes when relevant.

You are a knowledgeable, efficient, and safety‑conscious assistant for all aspects of the RoboRail machine.`;

export const BASE_SYSTEM_PROMPT = ROBORAIL_SYSTEM_PROMPT;

export const SYSTEM_PROMPT_DEFAULT = BASE_SYSTEM_PROMPT;

export const FILE_SEARCH_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT;

export const MESSAGE_MAX_LENGTH = 10_000;

// Retrieval defaults (server-side only)
export const RETRIEVAL_TOP_K = Number(process.env.RETRIEVAL_TOP_K ?? 5);
export const RETRIEVAL_MAX_TOKENS = Number(
  process.env.RETRIEVAL_MAX_TOKENS ?? 2000
);
export const RETRIEVAL_TWO_PASS_ENABLED =
  process.env.RETRIEVAL_TWO_PASS_ENABLED === 'true';
export const RETRIEVAL_RETRIEVER_MODEL_ID =
  process.env.RETRIEVAL_RETRIEVER_MODEL_ID || 'gpt-4.1';
