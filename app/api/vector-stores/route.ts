import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not set' },
      { status: 500 }
    );
  }
  const openai = new OpenAI({ apiKey });
  try {
    const stores = await openai.vectorStores.list({ limit: 50 });
    return NextResponse.json({ stores: stores.data });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Failed to list vector stores';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not set' },
      { status: 500 }
    );
  }
  const openai = new OpenAI({ apiKey });
  try {
    const body = await req.json();
    const name = body?.name as string | undefined;
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    const store = await openai.vectorStores.create({
      name,
      metadata: { created_by: 'settings-ui' },
    });
    return NextResponse.json({ store });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Failed to create vector store';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
