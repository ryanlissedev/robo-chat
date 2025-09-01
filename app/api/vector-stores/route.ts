import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import {
  createApiResponse,
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

  // Parse and validate body
  const validation = await parseRequestBody<{ name: string }>(req, ['name']);
  if (!validation.isValid) {
    return createApiResponse(validation);
  }

  const openai = new OpenAI({ apiKey });
  return handleApiRoute(async () => {
    if (!validation.data) {
      throw new Error('Invalid request');
    }
    const { name } = validation.data as { name: string };

    const store = await openai.vectorStores.create({
      name,
      metadata: { created_by: 'settings-ui' },
    });
    return { store };
  });
}
