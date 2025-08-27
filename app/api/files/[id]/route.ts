import type { NextRequest } from 'next/server';
import OpenAI from 'openai';

// Proxy endpoint to serve files stored in OpenAI from their file API
// Usage: /api/files/:id -> streams the file content to the client
export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  if (!id) {
    return new Response(JSON.stringify({ error: 'Missing file id' }), { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server is missing OPENAI_API_KEY' }), { status: 500 });
  }

  try {
    const openai = new OpenAI({ apiKey });

    // Retrieve file metadata to set filename headers
    let fileName: string | undefined;
    try {
      const meta = await openai.files.retrieve(id);
      // meta.filename in newer SDKs; fallback keys for safety
      fileName = (meta as unknown as { filename?: string; name?: string }).filename ||
                 (meta as unknown as { name?: string }).name ||
                 `file-${id}`;
    } catch {
      // If metadata fails, still attempt to stream the content
      fileName = `file-${id}`;
    }

    // Use direct HTTP fetch to the OpenAI files content endpoint for robust streaming
    const resp = await fetch(`https://api.openai.com/v1/files/${id}/content`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => '');
      return new Response(
        JSON.stringify({ error: 'Failed to fetch file content', status: resp.status, detail: text }),
        { status: 502 }
      );
    }

    // Stream the response through, setting a safe content-type and filename
    const headers = new Headers();
    headers.set('Content-Type', resp.headers.get('content-type') || 'application/octet-stream');
    headers.set('Content-Disposition', `inline; filename="${fileName}"`);
    // Allow embedding in the app
    headers.set('Cache-Control', 'private, max-age=60');

    return new Response(resp.body, { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error retrieving file';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  }
}
