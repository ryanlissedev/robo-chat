import { NextResponse } from 'next/server';
import { PROVIDERS } from '@/lib/providers';
import { createClient } from '@/lib/supabase/server';

const SUPPORTED_PROVIDERS = PROVIDERS.map((p) => p.id);

export async function GET() {
  try {
    const supabase = await createClient();
    if (!supabase) {
      const defaultStatus = Object.fromEntries(
        SUPPORTED_PROVIDERS.map((provider) => [provider, false])
      );
      return NextResponse.json(defaultStatus);
    }

    const { data: authData } = await supabase.auth.getUser();
    const defaultStatus = Object.fromEntries(
      SUPPORTED_PROVIDERS.map((provider) => [provider, false])
    );

    if (!authData?.user?.id) {
      return NextResponse.json(defaultStatus);
    }

    const { data, error } = await supabase
      .from('user_keys')
      .select('provider')
      .eq('user_id', authData.user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Create status object for all supported providers
    // Coerce data typing to avoid "never" inference issues
    const userProviders = (
      (data as unknown as Array<{ provider: string }>) || []
    ).map((k) => k.provider);
    const providerStatus = SUPPORTED_PROVIDERS.reduce(
      (acc, provider) => {
        acc[provider] = userProviders.includes(provider);
        return acc;
      },
      {} as Record<string, boolean>
    );

    return NextResponse.json(providerStatus);
  } catch {
    return NextResponse.json(
      Object.fromEntries(SUPPORTED_PROVIDERS.map((provider) => [provider, false]))
    );
  }
}
