import { ApiKeyService } from './api-key-service';
import { GuestCredentialService } from './guest-credential-service';
import { isGuestMode, getGuestUser } from '@/lib/guest-auth';
import { guestSettings } from '@/lib/guest-settings';
import type {
  IApiKeyService,
  ICredentialResolver,
  IGuestCredentialService,
} from './types';

export class CredentialResolver implements ICredentialResolver {
  constructor(private readonly userId?: string) {}

  isGuestMode(): boolean {
    // Check if explicitly guest mode via our new auth system
    if (isGuestMode()) {
      return true;
    }

    // Fallback to checking if no userId provided
    return !this.userId;
  }

  getGuestUserId(): string | null {
    const guestUser = getGuestUser();
    return guestUser?.id || null;
  }

  getEffectiveUserId(): string | null {
    if (this.isGuestMode()) {
      return this.getGuestUserId();
    }
    return this.userId || null;
  }

  getApiKeyService(): IApiKeyService | IGuestCredentialService {
    if (this.isGuestMode()) {
      return new GuestCredentialService();
    }
    return new ApiKeyService(this.userId!);
  }

  getStoragePreference(): 'session' | 'persistent' {
    if (this.isGuestMode()) {
      return guestSettings.getSetting('preferredStorage');
    }
    return 'persistent'; // Authenticated users default to persistent
  }
}
