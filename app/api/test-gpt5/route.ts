/**
 * Mock endpoint to demonstrate GPT-5 model integration
 * This simulates how GPT-5 models would work once available
 */

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { model, messages } = await request.json();
    
    // Validate GPT-5 model
    const gpt5Models = ['gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-pro'];
    if (!gpt5Models.includes(model)) {
      return NextResponse.json(
        { error: `Invalid model. Use one of: ${gpt5Models.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Get the last user message
    const userMessage = messages?.find((m: any) => m.role === 'user')?.content || '';
    
    // Create mock response based on model
    const mockResponses: Record<string, any> = {
      'gpt-5-mini': {
        model: 'gpt-5-mini',
        message: 'Response from GPT-5 Mini (Fast & Efficient)',
        content: `Hello! I'm GPT-5 Mini responding to: "${userMessage}". I'm optimized for speed and efficiency with great performance.`,
        features: {
          reasoning: true,
          vision: true,
          tools: true,
          fileSearch: true,
          audio: true,
        },
        pricing: { input: 0.25, output: 2.0, unit: 'per 1M tokens' },
        stats: {
          speed: 'Fast',
          contextWindow: 128000,
          responseTime: '~500ms',
        }
      },
      'gpt-5-nano': {
        model: 'gpt-5-nano',
        message: 'Response from GPT-5 Nano (Ultra-fast & Lightweight)',
        content: `Hi! GPT-5 Nano here. Your message: "${userMessage}". I'm the fastest and most cost-effective option!`,
        features: {
          reasoning: true,
          vision: true,
          tools: true,
          fileSearch: true,
          audio: false,
        },
        pricing: { input: 0.05, output: 0.40, unit: 'per 1M tokens' },
        stats: {
          speed: 'Very Fast',
          contextWindow: 128000,
          responseTime: '~200ms',
        }
      },
      'gpt-5': {
        model: 'gpt-5',
        message: 'Response from GPT-5 (Flagship)',
        content: `Greetings! This is GPT-5, the flagship model. In response to "${userMessage}": I provide the best balance of capabilities with 94.6% on AIME 2025 and 74.9% on SWE-bench.`,
        features: {
          reasoning: true,
          vision: true,
          tools: true,
          fileSearch: true,
          audio: true,
        },
        pricing: { input: 1.25, output: 10.0, unit: 'per 1M tokens' },
        stats: {
          speed: 'Fast',
          contextWindow: 128000,
          responseTime: '~800ms',
        }
      },
      'gpt-5-pro': {
        model: 'gpt-5-pro',
        message: 'Response from GPT-5 Pro (Most Capable)',
        content: `This is GPT-5 Pro responding to "${userMessage}". I'm the most capable model for challenging tasks with advanced reasoning.`,
        features: {
          reasoning: true,
          vision: true,
          tools: true,
          fileSearch: true,
          audio: true,
        },
        pricing: { input: 15, output: 60, unit: 'per 1M tokens' },
        stats: {
          speed: 'Medium',
          contextWindow: 128000,
          responseTime: '~1500ms',
        }
      }
    };
    
    const response = mockResponses[model];
    
    // Simulate streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        // Send initial event
        controller.enqueue(encoder.encode('data: {"type":"start"}\n\n'));
        
        // Simulate reasoning tokens for GPT-5
        if (model.startsWith('gpt-5')) {
          controller.enqueue(encoder.encode(`data: {"type":"reasoning-delta","reasoningDelta":"Analyzing request..."}\n\n`));
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Send content in chunks
        const words = response.content.split(' ');
        for (let i = 0; i < words.length; i++) {
          const chunk = words[i] + (i < words.length - 1 ? ' ' : '');
          controller.enqueue(
            encoder.encode(`data: {"type":"text-delta","textDelta":"${chunk}"}\n\n`)
          );
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Send model info
        controller.enqueue(
          encoder.encode(`data: {"type":"model-info","data":${JSON.stringify(response)}}\n\n`)
        );
        
        // Send finish event
        controller.enqueue(encoder.encode('data: {"type":"finish"}\n\n'));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return information about available GPT-5 models
  return NextResponse.json({
    message: 'GPT-5 Model Test Endpoint',
    description: 'This endpoint simulates GPT-5 model responses for testing',
    models: [
      {
        id: 'gpt-5-mini',
        name: 'GPT-5 Mini',
        description: 'Fast, cost-effective, default model',
        pricing: { input: '$0.25/1M', output: '$2/1M' },
      },
      {
        id: 'gpt-5-nano',
        name: 'GPT-5 Nano',
        description: 'Ultra-fast, lightweight for simple tasks',
        pricing: { input: '$0.05/1M', output: '$0.40/1M' },
      },
      {
        id: 'gpt-5',
        name: 'GPT-5',
        description: 'Flagship model with best balance',
        pricing: { input: '$1.25/1M', output: '$10/1M' },
      },
      {
        id: 'gpt-5-pro',
        name: 'GPT-5 Pro',
        description: 'Most capable for challenging tasks',
        pricing: { input: '$15/1M', output: '$60/1M' },
      },
    ],
    usage: 'POST /api/test-gpt5 with { model: "gpt-5-mini", messages: [...] }',
  });
}