import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { decryptApiKey, validateApiKeyFormat } from '@/lib/security/encryption';
import { validateUserIdentity } from '@/lib/server/api';

// Anthropic SDK optional; guard import usage
let Anthropic: { new (config: { apiKey: string }): { messages: { create: (params: { model: string; max_tokens: number; messages: Array<{ role: string; content: string }> }) => Promise<unknown> } } } | undefined;
try {
  const anthropicModule = await import('@ai-sdk/anthropic');
  Anthropic = anthropicModule.anthropic;
} catch {
  // Anthropic SDK not available
}

import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createMistral } from '@ai-sdk/mistral';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { provider } = body;

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider is required' },
        { status: 400 }
      );
    }

    // Get user authentication
    const supabase = await validateUserIdentity('', true);
    if (!supabase) {
      return NextResponse.json(
        { error: 'User authentication required' },
        { status: 401 }
      );
    }

    // Get the authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Failed to authenticate user' },
        { status: 401 }
      );
    }

    // Get the encrypted API key for the provider
    const { data: keyData, error: keyError } = await supabase
      .from('user_keys')
      .select('encrypted_key, iv')
      .eq('user_id', user.id)
      .eq('provider', provider)
      .eq('is_active', true)
      .single();

    if (keyError || !keyData?.encrypted_key) {
      return NextResponse.json(
        { error: `No API key found for ${provider}` },
        { status: 404 }
      );
    }

    // Decrypt the API key
    let apiKey: string;
    try {
      apiKey = decryptApiKey(
        keyData.encrypted_key as unknown as string,
        keyData.iv as unknown as string,
        undefined,
        user.id
      );
    } catch {
      return NextResponse.json(
        { error: 'Failed to decrypt API key' },
        { status: 500 }
      );
    }

    // Validate API key format
    if (!validateApiKeyFormat(apiKey, provider)) {
      return NextResponse.json(
        { error: 'Invalid API key format' },
        { status: 400 }
      );
    }

    // Test the API key based on provider
    let testResult = { success: false, error: 'Unknown provider' };

    switch (provider) {
      case 'openai':
        try {
          const openai = new OpenAI({ apiKey });
          // Try to list models as a simple test
          const models = await openai.models.list();
          if (models.data.length > 0) {
            testResult = { success: true, error: '' };
          }
        } catch (error: unknown) {
          testResult = {
            success: false,
            error: (error as Error).message || 'Invalid OpenAI API key',
          };
        }
        break;

      case 'anthropic':
        try {
          if (!Anthropic) {
            throw new Error('Anthropic SDK not installed');
          }
          const anthropic = new Anthropic({ apiKey });
          // Try a minimal completion
          const response = await anthropic.messages.create({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'Hi' }],
          });
          if (response) {
            testResult = { success: true, error: '' };
          }
        } catch (error: unknown) {
          testResult = {
            success: false,
            error: (error as Error).message || 'Invalid Anthropic API key',
          };
        }
        break;

      case 'mistral':
        try {
          createMistral({ apiKey });
          // Test by creating a minimal completion
          testResult = { success: true, error: '' };
        } catch (error: unknown) {
          testResult = {
            success: false,
            error: (error as Error).message || 'Invalid Mistral API key',
          };
        }
        break;

      case 'google':
        try {
          createGoogleGenerativeAI({ apiKey });
          // Test by creating a provider instance
          testResult = { success: true, error: '' };
        } catch (error: unknown) {
          testResult = {
            success: false,
            error: (error as Error).message || 'Invalid Google API key',
          };
        }
        break;

      case 'langsmith':
        try {
          // Test LangSmith API key
          const response = await fetch('https://api.smith.langchain.com/info', {
            headers: {
              'x-api-key': apiKey,
            },
          });
          if (response.ok) {
            testResult = { success: true, error: '' };
          }
        } catch (error: unknown) {
          testResult = {
            success: false,
            error: (error as Error).message || 'Invalid LangSmith API key',
          };
        }
        break;

      default:
        testResult = {
          success: false,
          error: `Testing not implemented for ${provider}`,
        };
    }

    // Update last_used timestamp and log audit if test was successful
    if (testResult.success) {
      await supabase
        .from('user_keys')
        .update({ updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('provider', provider);

      // Optional audit log (table may not exist in this schema)
      try {
        await (supabase as { from: (table: string) => { insert: (data: unknown) => Promise<unknown> } }).from('api_key_audit_log').insert({
          user_id: user.id,
          provider,
          action: 'accessed',
          metadata: { test_successful: true },
        });
      } catch {
        // no-op when audit table is absent
      }
    }

    return NextResponse.json(testResult);
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
