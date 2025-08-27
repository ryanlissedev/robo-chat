import { type NextRequest, NextResponse } from 'next/server';
import { encryptApiKey, validateApiKeyFormat } from '@/lib/security/encryption';
import { createClient } from '@/lib/supabase/server';

// POST: Rotate an API key (simplified to match actual schema)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, newApiKey } = body;

    if (!(provider && newApiKey)) {
      return NextResponse.json(
        { error: 'Provider and new API key are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Validate new API key format
    if (!validateApiKeyFormat(newApiKey, provider)) {
      return NextResponse.json(
        { error: `Invalid API key format for ${provider}` },
        { status: 400 }
      );
    }

    // Encrypt the new API key
    const { encrypted, iv } = encryptApiKey(newApiKey, user.id);

    // Update the existing key with new encrypted value
    const { error: updateError } = await supabase
      .from('user_keys')
      .update({
        encrypted_key: encrypted,
        iv,
        updated_at: new Date().toISOString(),
      } as never)
      .eq('user_id', user.id)
      .eq('provider', provider);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to rotate API key' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'API key rotated successfully',
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
