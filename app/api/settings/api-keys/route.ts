import { NextResponse } from 'next/server';
import { encryptApiKey, validateApiKeyFormat } from '@/lib/security/encryption';
import { createClient } from '@/lib/supabase/server';

// GET: Retrieve user's API keys (masked)
export async function GET() {
  try {
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

    // Get all API keys for the user (without decrypting)
    const { data: keys, error: keysError } = await supabase
      .from('user_keys')
      .select('provider, created_at, updated_at')
      .eq('user_id', user.id)
      .order('provider');

    if (keysError) {
      return NextResponse.json(
        { error: 'Failed to fetch API keys' },
        { status: 500 }
      );
    }

    return NextResponse.json({ keys: keys || [] });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Add or update an API key
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider, apiKey } = body;

    if (!(provider && apiKey)) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
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

    // Validate API key format
    if (!validateApiKeyFormat(apiKey, provider)) {
      return NextResponse.json(
        { error: `Invalid API key format for ${provider}` },
        { status: 400 }
      );
    }

    // Encrypt the API key
    const { encrypted, iv } = encryptApiKey(apiKey, user.id);

    // Check if key exists
    const { data: existingKey } = await supabase
      .from('user_keys')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single();

    const isUpdate = !!existingKey;

    // Upsert the encrypted key
    const { error: upsertError } = await supabase.from('user_keys').upsert({
      user_id: user.id,
      provider,
      encrypted_key: encrypted,
      iv,
      updated_at: new Date().toISOString(),
    });

    if (upsertError) {
      return NextResponse.json(
        { error: 'Failed to save API key' },
        { status: 500 }
      );
    }

    // Note: Audit log table doesn't exist in schema, removing audit logging

    return NextResponse.json({
      success: true,
      message: isUpdate ? 'API key updated' : 'API key added',
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Remove an API key
export async function DELETE(req: Request) {
  try {
    const body = await req.json();
    const { provider } = body;

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
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

    // Delete the key
    const { error: deleteError } = await supabase
      .from('user_keys')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to delete API key' },
        { status: 500 }
      );
    }

    // Note: Audit log table doesn't exist in schema, removing audit logging

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH: Toggle API key active status
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { provider, isActive } = body;

    if (!provider || typeof isActive !== 'boolean') {
      return NextResponse.json(
        { error: 'Provider and isActive are required' },
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

    // Update timestamp (is_active field doesn't exist in schema)
    const { error: updateError } = await supabase
      .from('user_keys')
      .update({
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id)
      .eq('provider', provider);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update API key status' },
        { status: 500 }
      );
    }

    // Note: Audit log table doesn't exist in schema, removing audit logging

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
