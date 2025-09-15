import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  createErrorResponse,
  handleApiRoute,
  parseRequestBody,
} from '@/lib/utils/api-response-utils';

export async function GET() {
  return handleApiRoute(async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not set');
    }

    const openai = new OpenAI({ apiKey });
    const stores = await openai.vectorStores.list({ limit: 50 });
    return { stores: stores.data };
  });
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not set' },
      { status: 500 }
    );
  }

  // Parse JSON body (validate required fields below)
  const parsed = await parseRequestBody<{ name: string }>(req);
  if (!parsed.success) {
    return createErrorResponse('validation_error', parsed.error, 400);
  }

  const openai = new OpenAI({ apiKey });
  return handleApiRoute(async () => {
    const { name } = parsed.data as { name: string };
    if (!name || typeof name !== 'string') {
      throw new Error('name is required');
    }

    const store = await openai.vectorStores.create({
      name,
      metadata: { created_by: 'settings-ui' },
    });
    return { store };
  });
}
