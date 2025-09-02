import { NextResponse } from 'next/server';
import {
  getAllModels,
  getModelsForUserProviders,
  getModelsWithAccessFlags,
  refreshModelsCache,
} from '@/lib/models';
import type { ModelConfig } from '@/lib/models/types';
import { createClient } from '@/lib/supabase/server';

// Provider environment variable mappings
const PROVIDER_ENV_MAPPING = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: ['GOOGLE_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'],
  mistral: 'MISTRAL_API_KEY',
  perplexity: 'PERPLEXITY_API_KEY',
  xai: 'XAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
} as const;

// Helper function to check if environment variables are available for a provider
function checkEnvAvailable(providerId: string): boolean {
  const envKeys =
    PROVIDER_ENV_MAPPING[providerId as keyof typeof PROVIDER_ENV_MAPPING];
  if (!envKeys) return false;

  if (Array.isArray(envKeys)) {
    return envKeys.some((key) => Boolean(process.env[key]));
  }

  return Boolean(process.env[envKeys as string]);
}

// Helper function to add credentialInfo to models
function addCredentialInfo(
  models: ModelConfig[],
  userProviders: string[] = []
): ModelConfig[] {
  // Check if AI Gateway is configured - if so, all models are available
  const hasAIGateway = Boolean(process.env.AI_GATEWAY_API_KEY);
  
  return models.map((model) => ({
    ...model,
    credentialInfo: {
      envAvailable: hasAIGateway || checkEnvAvailable(model.providerId),
      guestByokAvailable: true,
      userByokAvailable: hasAIGateway || userProviders.includes(model.providerId),
    },
  }));
}

export async function GET() {
  try {
    const supabase = await createClient();

    if (!supabase) {
      const allModels = await getAllModels();
      const models = addCredentialInfo(
        allModels.map((model) => ({ ...model, accessible: true }))
      );
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const { data: authData } = await supabase.auth.getUser();

    if (!authData?.user?.id) {
      const base = await getModelsWithAccessFlags();
      const models = addCredentialInfo(base);
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const { data, error } = await supabase
      .from('user_keys')
      .select('provider')
      .eq('user_id', authData.user.id);

    if (error) {
      const models = addCredentialInfo(await getModelsWithAccessFlags());
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const userProviders =
      (data as unknown as Array<{ provider: string }>)?.map(
        (k) => k.provider
      ) || [];

    if (userProviders.length === 0) {
      const models = addCredentialInfo(await getModelsWithAccessFlags());
      return new Response(JSON.stringify({ models }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const baseModels = await getModelsForUserProviders(userProviders);
    const models = addCredentialInfo(baseModels, userProviders);

    return new Response(JSON.stringify({ models }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to fetch models' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
}

export async function POST() {
  try {
    refreshModelsCache();
    const models = await getAllModels();

    return NextResponse.json({
      message: 'Models cache refreshed',
      models,
      timestamp: new Date().toISOString(),
      count: models.length,
    });
  } catch {
    return NextResponse.json(
      { error: 'Failed to refresh models' },
      { status: 500 }
    );
  }
}
