import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not set' },
      { status: 500 }
    );
  }
  const openai = new OpenAI({ apiKey });
  const { id } = await params;
  try {
    const files = await openai.beta.vectorStores.files.list(id, { limit: 100 });
    return NextResponse.json({ files: files.data });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Failed to list vector store files';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPENAI_API_KEY not set' },
      { status: 500 }
    );
  }
  const openai = new OpenAI({ apiKey });
  const { id } = await params;
  try {
    // Expect multipart/form-data with field 'file'
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const uploaded = await openai.files.create({ file, purpose: 'assistants' });
    const attached = await openai.beta.vectorStores.files.create(id, {
      file_id: uploaded.id,
    });

    return NextResponse.json({ file: attached });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Failed to upload file to vector store';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
