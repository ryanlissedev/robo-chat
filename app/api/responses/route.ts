/**
 * GPT-5 Responses API Route
 * Implements the OpenAI Responses API for GPT-5 models with AI SDK v5
 *
 * This route provides proper GPT-5 integration with advanced features:
 * - Responses API compatibility
 * - Web search tools
 * - File search tools
 * - Code interpreter
 * - Vision and audio support
 * - Structured outputs with Zod
 */

import { generateText, streamText, generateObject } from 'ai';
import { createOpenAI, openai } from '@ai-sdk/openai';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// GPT-5 model validation
const GPT5_MODELS = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-pro'] as const;
type GPT5Model = (typeof GPT5_MODELS)[number];

// Request schema for validation (more flexible typing for AI SDK compatibility)
const RequestSchema = z.object({
  model: z.enum(GPT5_MODELS),
  messages: z.array(z.any()), // Use flexible typing for AI SDK compatibility
  stream: z.boolean().optional().default(false),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().positive().optional(),
  tools: z
    .object({
      web_search_preview: z
        .object({
          searchContextSize: z.enum(['low', 'medium', 'high']).optional(),
          userLocation: z
            .object({
              type: z.literal('approximate'),
              city: z.string(),
              region: z.string(),
            })
            .optional(),
        })
        .optional(),
      file_search: z
        .object({
          vectorStoreIds: z.array(z.string()),
          maxNumResults: z.number().positive().max(20).optional().default(10),
        })
        .optional(),
      code_interpreter: z
        .object({
          container: z
            .union([z.object({ fileIds: z.array(z.string()) }), z.string()])
            .optional(),
        })
        .optional(),
    })
    .optional(),
  toolChoice: z
    .union([
      z.literal('auto'),
      z.literal('none'),
      z.object({
        type: z.literal('tool'),
        toolName: z.enum([
          'web_search_preview',
          'file_search',
          'code_interpreter',
        ]),
      }),
    ])
    .optional(),
  schema: z.any().optional(), // For structured outputs
  providerOptions: z
    .object({
      openai: z
        .object({
          textVerbosity: z
            .enum(['low', 'medium', 'high'])
            .optional()
            .default('medium'),
          reasoningSummary: z
            .enum(['auto', 'detailed', 'none'])
            .optional()
            .default('auto'),
          serviceTier: z
            .enum(['auto', 'flex', 'priority'])
            .optional()
            .default('auto'),
          user: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
});

type RequestBody = z.infer<typeof RequestSchema>;

/**
 * POST handler for GPT-5 Responses API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validatedBody = RequestSchema.parse(body);
    const {
      model,
      messages,
      stream,
      temperature,
      maxTokens,
      tools,
      toolChoice,
      schema,
      providerOptions,
    } = validatedBody;

    // Validate API key
    const authHeader = request.headers.get('authorization');
    const apiKey =
      authHeader?.replace('Bearer ', '') || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing OpenAI API key' },
        { status: 401 }
      );
    }

    // Create OpenAI provider with Responses API
    const openaiProvider = createOpenAI({
      apiKey,
      ...providerOptions?.openai,
    });

    // Configure model with Responses API (for GPT-5 models)
    const modelInstance = openaiProvider.responses(model);

    // Set up tools if provided
    const configuredTools: Record<string, any> = {};

    if (tools?.web_search_preview) {
      configuredTools.web_search_preview = openai.tools.webSearchPreview({
        searchContextSize:
          tools.web_search_preview.searchContextSize || 'medium',
        userLocation: tools.web_search_preview.userLocation,
      });
    }

    if (tools?.file_search) {
      configuredTools.file_search = openai.tools.fileSearch({
        vectorStoreIds: tools.file_search.vectorStoreIds,
        maxNumResults: tools.file_search.maxNumResults || 10,
      });
    }

    if (tools?.code_interpreter) {
      configuredTools.code_interpreter = openai.tools.codeInterpreter({
        container: tools.code_interpreter.container || { fileIds: [] },
      });
    }

    // Handle structured output with schema
    if (schema) {
      const result = await generateObject({
        model: modelInstance,
        schema: z.object(schema),
        messages: messages as any,
        temperature,
        ...(maxTokens && { maxTokens }),
        providerOptions: {
          openai: {
            textVerbosity: providerOptions?.openai?.textVerbosity || 'medium',
            reasoningSummary:
              providerOptions?.openai?.reasoningSummary || 'auto',
            serviceTier: providerOptions?.openai?.serviceTier || 'auto',
            ...(providerOptions?.openai?.user && {
              user: providerOptions.openai.user,
            }),
          },
        },
      });

      return NextResponse.json({
        object: result.object,
        usage: result.usage,
        model,
        warnings: result.warnings || [],
      });
    }

    // Handle streaming response
    if (stream) {
      const result = await streamText({
        model: modelInstance,
        messages: messages as any,
        temperature,
        ...(maxTokens && { maxTokens }),
        ...(Object.keys(configuredTools).length > 0 && {
          tools: configuredTools,
          toolChoice,
        }),
        providerOptions: {
          openai: {
            textVerbosity: providerOptions?.openai?.textVerbosity || 'medium',
            reasoningSummary:
              providerOptions?.openai?.reasoningSummary || 'auto',
            serviceTier: providerOptions?.openai?.serviceTier || 'auto',
            ...(providerOptions?.openai?.user && {
              user: providerOptions.openai.user,
            }),
          },
        },
      });

      // Create a streaming response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            for await (const delta of result.textStream) {
              const chunk = `data: ${JSON.stringify({
                type: 'text-delta',
                delta,
                model,
              })}\n\n`;
              controller.enqueue(encoder.encode(chunk));
            }

            // Send sources if available (from web search)
            const sources = await result.sources;
            if (sources && sources.length > 0) {
              const sourcesChunk = `data: ${JSON.stringify({
                type: 'sources',
                sources,
                model,
              })}\n\n`;
              controller.enqueue(encoder.encode(sourcesChunk));
            }

            // Send final usage data
            const finishChunk = `data: ${JSON.stringify({
              type: 'finish',
              usage: result.usage,
              model,
            })}\n\n`;
            controller.enqueue(encoder.encode(finishChunk));

            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Handle regular text generation
    const result = await generateText({
      model: modelInstance,
      messages: messages as any,
      temperature,
      maxTokens,
      ...(Object.keys(configuredTools).length > 0 && {
        tools: configuredTools,
        toolChoice,
      }),
      providerOptions: {
        openai: {
          textVerbosity: providerOptions?.openai?.textVerbosity || 'medium',
          reasoningSummary: providerOptions?.openai?.reasoningSummary || 'auto',
          serviceTier: providerOptions?.openai?.serviceTier || 'auto',
          ...(providerOptions?.openai?.user && {
            user: providerOptions.openai.user,
          }),
        },
      },
    });

    return NextResponse.json({
      text: result.text,
      usage: result.usage,
      model,
      sources: (await result.sources) || [],
      reasoning: result.reasoning || null,
    });
  } catch (error) {
    console.error('GPT-5 Responses API error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          error: 'Invalid request format',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Handle OpenAI API errors
      if (error.message.includes('401')) {
        return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
      }

      if (error.message.includes('429')) {
        return NextResponse.json(
          { error: 'Rate limit exceeded' },
          { status: 429 }
        );
      }

      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET handler for API information
 */
export async function GET() {
  return NextResponse.json({
    name: 'GPT-5 Responses API',
    description: 'OpenAI GPT-5 models with Responses API integration',
    version: '1.0.0',
    models: GPT5_MODELS,
    features: {
      streaming: true,
      structured_outputs: true,
      web_search: true,
      file_search: true,
      code_interpreter: true,
      vision: true,
      audio: true,
      reasoning: true,
    },
    usage: {
      endpoint: '/api/responses',
      method: 'POST',
      authentication: 'Bearer token in Authorization header',
      example: {
        model: 'gpt-5-mini',
        messages: [{ role: 'user', content: 'Hello, world!' }],
        stream: false,
        providerOptions: {
          openai: {
            textVerbosity: 'medium',
            reasoningSummary: 'auto',
          },
        },
      },
    },
  });
}
