import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CredentialService } from '@/lib/services/CredentialService';

// Use vi.hoisted for proper mock initialization
const mockGetGatewayConfig = vi.hoisted(() => vi.fn());
const mockGetProviderForModel = vi.hoisted(() => vi.fn());
const mockTrackCredentialUsage = vi.hoisted(() => vi.fn());
const mockTrackCredentialError = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({ info: vi.fn() }));
const mockGetEffectiveApiKey = vi.hoisted(() => vi.fn());
const mockRedactSensitiveHeaders = vi.hoisted(() => vi.fn());
const mockSanitizeLogEntry = vi.hoisted(() =>
  vi.fn().mockImplementation((entry) => entry)
);

vi.mock('@/lib/openproviders/env', () => ({
  getGatewayConfig: mockGetGatewayConfig,
}));

vi.mock('@/lib/openproviders/provider-map', () => ({
  getProviderForModel: mockGetProviderForModel,
}));

vi.mock('@/lib/utils/metrics', () => ({
  trackCredentialUsage: mockTrackCredentialUsage,
  trackCredentialError: mockTrackCredentialError,
}));

vi.mock('@/lib/utils/logger', () => ({
  default: mockLogger,
}));

vi.mock('@/lib/utils/redaction', () => ({
  redactSensitiveHeaders: mockRedactSensitiveHeaders,
  sanitizeLogEntry: mockSanitizeLogEntry,
}));

vi.mock('@/lib/user-keys', () => ({
  getEffectiveApiKey: mockGetEffectiveApiKey,
}));

describe('CredentialService', () => {
  beforeEach(() => {
    // Clear all mocks to prevent cross-test contamination
    vi.clearAllMocks();
    vi.resetAllMocks();

    // Set up default mock implementations
    mockGetProviderForModel.mockReturnValue('openai');
    mockRedactSensitiveHeaders.mockReturnValue({});
  });

  describe('extractGuestCredentials', () => {
    it('should extract credentials from standard headers', () => {
      const headers = new Headers({
        'x-model-provider': 'openai',
        'x-provider-api-key': 'sk-test123',
        'x-credential-source': 'guest-override',
      });

      const result = CredentialService.extractGuestCredentials(headers);

      expect(result).toEqual({
        provider: 'openai',
        apiKey: 'sk-test123',
        source: 'guest-override',
      });
    });

    it('should extract credentials from capital case headers', () => {
      const headers = new Headers({
        'X-Model-Provider': 'anthropic',
        'X-Provider-Api-Key': 'sk-ant-test123',
        'X-Credential-Source': 'guest',
      });

      const result = CredentialService.extractGuestCredentials(headers);

      expect(result).toEqual({
        provider: 'anthropic',
        apiKey: 'sk-ant-test123',
        source: 'guest',
      });
    });

    it('should handle missing headers gracefully', () => {
      const headers = new Headers({});

      const result = CredentialService.extractGuestCredentials(headers);

      expect(result).toEqual({});
    });

    it('should handle partial headers', () => {
      const headers = new Headers({
        'x-model-provider': 'openai',
      });

      const result = CredentialService.extractGuestCredentials(headers);

      expect(result).toEqual({
        provider: 'openai',
      });
    });
  });

  describe('resolveCredentials', () => {
    beforeEach(async () => {
      // Set up default implementations for this test suite
      mockGetProviderForModel.mockImplementation(() => 'openai');
      mockGetGatewayConfig.mockImplementation(() => ({ enabled: false }));
      mockGetEffectiveApiKey.mockImplementation(() => Promise.resolve(null));
      mockTrackCredentialUsage.mockImplementation(() => {});
      mockTrackCredentialError.mockImplementation(() => {});
      mockRedactSensitiveHeaders.mockImplementation(() => ({}));
      mockSanitizeLogEntry.mockImplementation((entry) => entry);
      mockLogger.info.mockImplementation(() => {});
    });

    it('should use gateway credentials when gateway is enabled', async () => {
      mockGetGatewayConfig.mockReturnValue({ enabled: true });

      const mockUser = {
        isAuthenticated: true,
        userId: 'user-123',
      };

      const testModel = 'gpt-4';
      const testHeaders = new Headers();

      const result = await CredentialService.resolveCredentials(
        mockUser,
        testModel,
        testHeaders
      );

      expect(mockGetGatewayConfig).toHaveBeenCalledWith();
      expect(mockTrackCredentialUsage).toHaveBeenCalledWith(
        'gateway',
        'openai',
        testModel,
        { success: true }
      );
      expect(result).toEqual({ source: 'gateway' });
    });

    it('should use user BYOK when gateway disabled and user authenticated', async () => {
      mockGetGatewayConfig.mockReturnValue({ enabled: false });
      mockGetEffectiveApiKey.mockResolvedValue('user-api-key-123');

      const mockUser = {
        isAuthenticated: true,
        userId: 'user-123',
      };

      const testModel = 'gpt-4';
      const testHeaders = new Headers();

      const result = await CredentialService.resolveCredentials(
        mockUser,
        testModel,
        testHeaders
      );

      expect(mockGetEffectiveApiKey).toHaveBeenCalledWith('user-123', 'openai');
      expect(mockTrackCredentialUsage).toHaveBeenCalledWith(
        'user-byok',
        'openai',
        testModel,
        {
          userId: 'user-123',
          success: true,
        }
      );
      expect(result).toEqual({
        apiKey: 'user-api-key-123',
        source: 'user-byok',
      });
    });

    it('should track errors when user BYOK fails', async () => {
      mockGetGatewayConfig.mockReturnValue({ enabled: false });
      const error = new Error('API key fetch failed');
      mockGetEffectiveApiKey.mockRejectedValue(error);

      const mockUser = {
        isAuthenticated: true,
        userId: 'user-123',
      };

      const testModel = 'gpt-4';
      const headersWithGuest = new Headers({
        'x-model-provider': 'openai',
        'x-provider-api-key': 'guest-key-123',
      });

      const result = await CredentialService.resolveCredentials(
        mockUser,
        testModel,
        headersWithGuest
      );

      expect(mockTrackCredentialError).toHaveBeenCalledWith(error, 'openai', {
        source: 'user-byok',
        userId: 'user-123',
        model: testModel,
      });

      // Should fallback to guest credentials
      expect(result).toEqual({
        apiKey: 'guest-key-123',
        source: 'guest-header',
      });
    });

    it('should use guest credentials when no user BYOK available', async () => {
      mockGetGatewayConfig.mockReturnValue({ enabled: false });
      mockGetEffectiveApiKey.mockResolvedValue(null);

      const mockUser = {
        isAuthenticated: true,
        userId: 'user-123',
      };

      const testModel = 'gpt-4';
      const headersWithGuest = new Headers({
        'x-model-provider': 'openai',
        'x-provider-api-key': 'guest-key-456',
      });

      const result = await CredentialService.resolveCredentials(
        mockUser,
        testModel,
        headersWithGuest
      );

      expect(mockTrackCredentialUsage).toHaveBeenCalledWith(
        'guest-header',
        'openai',
        testModel,
        { success: true }
      );
      expect(result).toEqual({
        apiKey: 'guest-key-456',
        source: 'guest-header',
      });
    });

    it('should fallback to environment when no credentials found', async () => {
      mockGetGatewayConfig.mockReturnValue({ enabled: false });
      mockGetEffectiveApiKey.mockResolvedValue(null);

      const testModel = 'gpt-4';
      const testHeaders = new Headers();

      const result = await CredentialService.resolveCredentials(
        null,
        testModel,
        testHeaders
      );

      expect(mockTrackCredentialUsage).toHaveBeenCalledWith(
        'environment',
        'openai',
        testModel,
        { success: true }
      );
      expect(result).toEqual({
        source: 'environment',
      });
    });

    it('should skip guest credentials with wrong provider', async () => {
      mockGetGatewayConfig.mockReturnValue({ enabled: false });
      mockGetEffectiveApiKey.mockResolvedValue(null);

      const testModel = 'gpt-4';
      const headersWrongProvider = new Headers({
        'x-model-provider': 'anthropic',
        'x-provider-api-key': 'sk-ant-123',
      });

      const result = await CredentialService.resolveCredentials(
        null,
        testModel,
        headersWrongProvider
      );

      // Should fallback to environment since provider mismatch
      expect(result).toEqual({
        source: 'environment',
      });
    });

    it('should handle unauthenticated user gracefully', async () => {
      // Clear all mocks and reset to clean state
      vi.clearAllMocks();
      vi.resetAllMocks();

      // Set up fresh mock implementations
      mockGetProviderForModel.mockReturnValue('openai');
      mockGetGatewayConfig.mockReturnValue({ enabled: false });
      mockGetEffectiveApiKey.mockResolvedValue(null);
      mockTrackCredentialUsage.mockImplementation(() => {});
      mockRedactSensitiveHeaders.mockReturnValue({});
      mockSanitizeLogEntry.mockImplementation((entry) => entry);
      mockLogger.info.mockImplementation(() => {});

      const unauthenticatedUser = {
        isAuthenticated: false,
        userId: '',
      };

      const testModel = 'gpt-4';
      const testHeaders = new Headers();

      const result = await CredentialService.resolveCredentials(
        unauthenticatedUser,
        testModel,
        testHeaders
      );

      expect(mockGetEffectiveApiKey).not.toHaveBeenCalled();
      expect(result).toEqual({
        source: 'environment',
      });
    });

    it('should handle gateway config errors silently', async () => {
      mockGetGatewayConfig.mockImplementation(() => {
        throw new Error('Gateway config error');
      });
      mockGetEffectiveApiKey.mockResolvedValue(null);

      const mockUser = {
        isAuthenticated: true,
        userId: 'user-123',
      };

      const testModel = 'gpt-4';
      const testHeaders = new Headers();

      const result = await CredentialService.resolveCredentials(
        mockUser,
        testModel,
        testHeaders
      );

      // Should continue to user BYOK after gateway error
      expect(mockGetEffectiveApiKey).toHaveBeenCalled();
      expect(result).toEqual({
        source: 'environment',
      });
    });
  });

  describe('trackCredentialError', () => {
    it('should track credential error with correct parameters', () => {
      const error = new Error('Test error');
      const model = 'gpt-4';
      const userId = 'user-123';

      CredentialService.trackCredentialError(error, model, userId);

      expect(mockTrackCredentialError).toHaveBeenCalledWith(error, 'openai', {
        source: 'user-byok',
        userId: 'user-123',
        model: 'gpt-4',
      });
    });

    it('should handle error tracking without userId', () => {
      const error = new Error('Test error');
      const model = 'claude-3';

      mockGetProviderForModel.mockReturnValue('anthropic');

      CredentialService.trackCredentialError(error, model);

      expect(mockTrackCredentialError).toHaveBeenCalledWith(
        error,
        'anthropic',
        {
          source: 'user-byok',
          userId: undefined,
          model: 'claude-3',
        }
      );
    });
  });
});
