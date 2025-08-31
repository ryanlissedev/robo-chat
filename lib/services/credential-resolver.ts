import { ApiKeyService } from './api-key-service';
import { GuestCredentialService } from './guest-credential-service';
import type {
  IApiKeyService,
  ICredentialResolver,
  IGuestCredentialService,
} from './types';

export class CredentialResolver implements ICredentialResolver {
  constructor(private readonly userId?: string) {}

  isGuestMode(): boolean {
    return !this.userId;
  }

  getApiKeyService(): IApiKeyService | IGuestCredentialService {
    if (this.isGuestMode()) {
      return new GuestCredentialService();
    }
    return new ApiKeyService(this.userId!);
  }
}
