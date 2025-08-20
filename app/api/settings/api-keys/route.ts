import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { 
  encryptApiKey, 
  decryptApiKey, 
  validateApiKeyFormat,
  maskApiKey 
} from '@/lib/security/encryption'

// GET: Retrieve user's API keys (masked)
export async function GET() {
  try {
    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get all API keys for the user (without decrypting)
    const { data: keys, error: keysError } = await supabase
      .from('user_keys')
      .select('provider, created_at, updated_at')
      .eq('user_id', user.id)
      .order('provider')

    if (keysError) {
      console.error('Failed to fetch API keys:', keysError)
      return NextResponse.json(
        { error: 'Failed to fetch API keys' },
        { status: 500 }
      )
    }

    return NextResponse.json({ keys: keys || [] })
  } catch (error) {
    console.error('Error in GET /api/settings/api-keys:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST: Add or update an API key
export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { provider, apiKey } = body

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Provider and API key are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Validate API key format
    if (!validateApiKeyFormat(apiKey, provider)) {
      return NextResponse.json(
        { error: `Invalid API key format for ${provider}` },
        { status: 400 }
      )
    }

    // Encrypt the API key
    const { encrypted, iv } = encryptApiKey(apiKey, user.id)

    // Check if key exists
    const { data: existingKey } = await supabase
      .from('user_keys')
      .select('id')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .single()

    const isUpdate = !!existingKey

    // Upsert the encrypted key
    const { error: upsertError } = await supabase
      .from('user_keys')
      .upsert({
        user_id: user.id,
        provider,
        encrypted_key: encrypted,
        iv,
        updated_at: new Date().toISOString()
      })

    if (upsertError) {
      console.error('Failed to save API key:', upsertError)
      return NextResponse.json(
        { error: 'Failed to save API key' },
        { status: 500 }
      )
    }

    // Log audit event
    // audit log disabled in this schema

    return NextResponse.json({ 
      success: true,
      message: isUpdate ? 'API key updated' : 'API key added'
    })
  } catch (error) {
    console.error('Error in POST /api/settings/api-keys:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// DELETE: Remove an API key
export async function DELETE(req: Request) {
  try {
    const body = await req.json()
    const { provider } = body

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Delete the key
    const { error: deleteError } = await supabase
      .from('user_keys')
      .delete()
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (deleteError) {
      console.error('Failed to delete API key:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete API key' },
        { status: 500 }
      )
    }

    // Log audit event
    // audit log disabled in this schema

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/settings/api-keys:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PATCH: Toggle API key active status
export async function PATCH(req: Request) {
  try {
    const body = await req.json()
    const { provider } = body

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Database connection failed' },
        { status: 500 }
      )
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Update active status
    const { error: updateError } = await supabase
      .from('user_keys')
      .update({ 
        updated_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('provider', provider)

    if (updateError) {
      console.error('Failed to update API key status:', updateError)
      return NextResponse.json(
        { error: 'Failed to update API key status' },
        { status: 500 }
      )
    }

    // Log audit event
    // audit log disabled in this schema

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in PATCH /api/settings/api-keys:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}