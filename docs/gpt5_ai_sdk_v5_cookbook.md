
# GPT‑5 + AI SDK v5 — Node/TypeScript Cookbook

> **Goal:** Use OpenAI’s GPT‑5 family (`gpt-5`, `gpt-5-mini`, `gpt-5-nano`) via the **Vercel AI SDK v5** with type‑safe patterns, streaming, structured outputs (Zod v4), and Responses API tools (web/file search, code interpreter, images/PDF).

---

## 0) Prereqs

- Node 18+ (or Bun/Deno – examples use Node).
- An **OpenAI API key** in `OPENAI_API_KEY`.
- Packages:
  ```bash
  npm i ai @ai-sdk/openai zod
  # or: pnpm add ai @ai-sdk/openai zod
  ```

> AI SDK v5 auto‑selects the correct OpenAI API (Responses vs Chat) based on the model. We’ll **prefer Responses** for GPT‑5.

---

## 1) Quick start — text generation

```ts
// src/basic.ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

async function main() {
  const { text, usage } = await generateText({
    model: openai.responses("gpt-5"), // also: gpt-5-mini, gpt-5-nano
    prompt: "Give me 3 crisp pros/cons of CQRS (one short line each).",
    // Optional OpenAI Responses tuning:
    providerOptions: {
      openai: {
        textVerbosity: "low",          // "low" | "medium" | "high"
        reasoningSummary: "auto",      // get brief reasoning summaries when supported
        serviceTier: "auto",           // "auto" | "flex" | "priority" (where available)
        user: "demo-user-123",
      },
    },
  });

  console.log(text);
  console.log("tokens:", usage);
}

main().catch(console.error);
```

Run:
```bash
node --env-file=.env src/basic.ts
```

---

## 2) Streaming text (token stream)

```ts
// src/stream.ts
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";

async function main() {
  const result = await streamText({
    model: openai.responses("gpt-5-mini"),
    prompt: "Stream a 5‑item checklist for zero‑downtime deploys.",
  });

  for await (const delta of result.textStream) {
    process.stdout.write(delta);
  }
  console.log("\n\n— done");
}

main().catch(console.error);
```

---

## 3) Strict JSON with **Zod v4**

```ts
// src/object.ts
import { z } from "zod";
import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";

const Incident = z.object({
  title: z.string(),
  severity: z.number().int().min(1).max(5),
  tags: z.array(z.string()).default([]),
});

async function main() {
  const { object, warnings } = await generateObject({
    model: openai.responses("gpt-5"),
    schema: Incident,
    prompt: "From the text, extract an incident with title/severity/tags:\n" +
            "DB outage impacting EU traffic for 7 minutes; sev 2; tags: postgres,failover",
    // (Optional) sampling/validation behavior lives under `output` controls in AI SDK:
  });

  console.log(object);
  if (warnings.length) console.warn("schema warnings:", warnings);
}

main().catch(console.error);
```

---

## 4) Tooling via **Responses API**

### 4a) Web Search tool (force usage)

```ts
// src/tools_web.ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

async function main() {
  const result = await generateText({
    model: openai.responses("gpt-5"),
    prompt: "What happened in Amsterdam tech last week? Cite sources.",
    tools: {
      web_search_preview: openai.tools.webSearchPreview({
        searchContextSize: "high",
        userLocation: { type: "approximate", city: "Amsterdam", region: "NH" },
      }),
    },
    toolChoice: { type: "tool", toolName: "web_search_preview" },
  });

  console.log(result.text);
  console.log("sources:", result.sources); // array of { url, title, ... }
}

main().catch(console.error);
```

### 4b) File Search tool

```ts
// src/tools_file.ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

async function main() {
  const result = await generateText({
    model: openai.responses("gpt-5"),
    prompt: "Summarize auth strategy from our docs.",
    tools: {
      file_search: openai.tools.fileSearch({
        vectorStoreIds: ["vs_123"],
        maxNumResults: 8,
      }),
    },
    toolChoice: { type: "tool", toolName: "file_search" },
  });

  console.log(result.text);
}

main().catch(console.error);
```

### 4c) Code Interpreter (Python sandbox)

```ts
// src/tools_code.ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

async function main() {
  const result = await generateText({
    model: openai.responses("gpt-5"),
    prompt: "Write and run Python to compute the first 20 Fibonacci numbers.",
    tools: {
      code_interpreter: openai.tools.codeInterpreter({
        container: { fileIds: [] }, // or a container id string
      }),
    },
  });

  console.log(result.text);
  // Depending on provider behavior, check result.toolCalls / providerMetadata for outputs.
}

main().catch(console.error);
```

---

## 5) Images & PDFs as **data parts**

```ts
// src/vision.ts
import fs from "node:fs";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

async function main() {
  const result = await generateText({
    model: openai.responses("gpt-5"),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Describe this plot and extract 3 insights." },
          { type: "image", image: fs.readFileSync("./chart.png") },
          {
            type: "file",
            data: fs.readFileSync("./design.pdf"),
            mediaType: "application/pdf",
            filename: "design.pdf",
          },
        ],
      },
    ],
  });

  console.log(result.text);
}

main().catch(console.error);
```

---

## 6) Model map & helpers (type‑safe switches)

```ts
// src/models.ts
import { openai } from "@ai-sdk/openai";
import type { LanguageModelV1 } from "ai";

export const MODELS = {
  main: openai.responses("gpt-5"),
  mini: openai.responses("gpt-5-mini"),
  nano: openai.responses("gpt-5-nano"),
} as const;

export type ModelKey = keyof typeof MODELS;

export function modelFor(k: ModelKey): LanguageModelV1 {
  return MODELS[k];
}
```

Usage:
```ts
// src/switch.ts
import { generateText } from "ai";
import { modelFor } from "./models";

async function ask(key: "main" | "mini" | "nano", prompt: string) {
  const res = await generateText({
    model: modelFor(key),
    prompt,
    providerOptions: {
      openai: {
        textVerbosity: key === "nano" ? "low" : "medium",
        reasoningSummary: key === "main" ? "auto" : "none",
      },
    },
  });
  return res.text;
}
```

---

## 7) Minimal CLI (Node)

```ts
// src/cli.ts
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

const [,, modelArg = "gpt-5", ...rest] = process.argv;
const prompt = rest.join(" ") || "Explain Raft in one paragraph.";

(async () => {
  const { text } = await generateText({
    model: openai.responses(modelArg as "gpt-5"|"gpt-5-mini"|"gpt-5-nano"),
    prompt,
    providerOptions: { openai: { textVerbosity: "medium" } },
  });
  console.log(text);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

Run:
```bash
node --env-file=.env src/cli.ts "List three safe concurrency patterns"
node --env-file=.env src/cli.ts gpt-5-mini "Convert this cURL to fetch()"
node --env-file=.env src/cli.ts gpt-5-nano "Summarize this error: EADDRINUSE"
```

---

## 8) Patterns & tips

- **Prefer `openai.responses("<model>")`** for GPT‑5 series.
- Tune **`textVerbosity`** and **`reasoningSummary`** (where supported).
- For cheap/fast: **`gpt-5-nano`**, balanced: **`gpt-5-mini`**, max quality: **`gpt-5`**.
- Use **Zod schemas** with `generateObject` for guaranteed shape.
- Push heavy tasks (search, file search, code execution) into **tools** rather than prompt‑stuffing.
- Capture `result.sources` when using **web_search_preview** to show citations.
- Log `result.usage` for cost accounting.

---

## 9) Env template

```
# .env
OPENAI_API_KEY=sk-...
```

---

## 10) Project layout (suggested)

```
.
├─ src/
│  ├─ basic.ts          # simple text gen
│  ├─ stream.ts         # streaming
│  ├─ object.ts         # Zod structured output
│  ├─ tools_web.ts      # web search tool
│  ├─ tools_file.ts     # file search tool
│  ├─ tools_code.ts     # code interpreter tool
│  ├─ vision.ts         # images + pdf
│  ├─ models.ts         # model map/switch
│  └─ cli.ts            # minimal CLI
└─ .env
```

---

### Appendix — Common issues

- **401 Unauthorized** → missing/invalid `OPENAI_API_KEY`.
- **Tool errors** → check the exact tool names: `web_search_preview`, `file_search`, `code_interpreter`.
- **PDF/image inputs** → use `type: "file"` / `type: "image"` with correct `mediaType` for PDFs.

Happy building.
