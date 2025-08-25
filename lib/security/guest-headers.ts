// Client-only helper to build Guest BYOK headers from session storage
// Keys never persist server-side; this only attaches per-request headers.

'use client';

import { getSessionCredential, getMemoryCredentialPlaintext } from '@/lib/security/web-crypto';
import { getProviderForModel } from '@/lib/openproviders/provider-map';
import type { SupportedModel } from '@/lib/openproviders/types';

export async function headersForModel(modelId: string): Promise<Record<string, string> | undefined> {
  try {
    // Safely resolve provider; cast to SupportedModel for type compatibility
    const provider = getProviderForModel(modelId as unknown as SupportedModel);

    // Try in-memory (tab) first
    const memPlain = await getMemoryCredentialPlaintext(provider);
    if (memPlain) {
      return {
        'X-Model-Provider': provider,
        'X-Provider-Api-Key': memPlain,
        'X-Credential-Source': 'guest-byok',
      };
    }

    // Try session encrypted (requires same-tab ephemeral key)
    const session = await getSessionCredential(provider);
    if (session?.plaintext) {
      return {
        'X-Model-Provider': provider,
        'X-Provider-Api-Key': session.plaintext,
        'X-Credential-Source': 'guest-byok',
      };
    }

    // Persistent requires user-supplied passphrase; not auto-attached for safety
    return undefined;
  } catch {
    return undefined;
  }
}

