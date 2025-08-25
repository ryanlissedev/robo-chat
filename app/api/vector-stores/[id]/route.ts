import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
  }
  const openai = new OpenAI({ apiKey });
  try {
    await openai.vectorStores.del(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete vector store';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
