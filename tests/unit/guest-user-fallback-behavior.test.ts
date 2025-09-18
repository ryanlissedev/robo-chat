import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetch for API calls
global.fetch = vi.fn();

// Mock browser environment
global.window = {
  navigator: {
    onLine: true,
  },
  localStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  sessionStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
} as any;

describe('Guest User Fallback Behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(window.navigator.onLine) = true;
  });

  describe('Authentication Failure Fallbacks', () => {
    it('should handle 401 Unauthorized responses gracefully', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: vi.fn().mockResolvedValue({ error: 'Invalid API key' }),
      } as any);

      const authHandler = {
        async handleAuthFailure(response: Response) {
          if (response.status === 401) {
            return {
              shouldRetry: false,
              shouldFallback: true,
              fallbackMode: 'offline',
              message: 'Authentication failed. Please check your API key.',
            };
          }
          return { shouldRetry: false, shouldFallback: false };
        },
      };

      const response = await fetch('/api/chat');
      const result = await authHandler.handleAuthFailure(response);

      expect(result.shouldFallback).toBe(true);
      expect(result.fallbackMode).toBe('offline');
      expect(result.message).toContain('Authentication failed');
    });

    it('should handle API key validation failures', async () => {
      const apiKeyValidator = {
        validateKey(key: string): { valid: boolean; error?: string } {
          if (!key) {
            return { valid: false, error: 'API key is required' };
          }
          if (!key.startsWith('sk-')) {
            return { valid: false, error: 'Invalid API key format' };
          }
          if (key.length < 20) {
            return { valid: false, error: 'API key too short' };
          }
          return { valid: true };
        },

        handleValidationFailure(error: string): {
          fallbackAction: string;
          userMessage: string;
          allowRetry: boolean;
        } {
          const fallbackMap = {
            'API key is required': {
              fallbackAction: 'prompt-for-key',
              userMessage: 'Please provide an API key to continue.',
              allowRetry: true,
            },
            'Invalid API key format': {
              fallbackAction: 'show-format-help',
              userMessage: 'API key format is invalid. It should start with "sk-".',
              allowRetry: true,
            },
            'API key too short': {
              fallbackAction: 'show-format-help',
              userMessage: 'API key appears to be incomplete.',
              allowRetry: true,
            },
          };

          return fallbackMap[error as keyof typeof fallbackMap] || {
            fallbackAction: 'generic-error',
            userMessage: 'There was an issue with your API key.',
            allowRetry: true,
          };
        },
      };

      // Test missing API key
      const missingKeyResult = apiKeyValidator.validateKey('');
      expect(missingKeyResult.valid).toBe(false);

      const missingKeyFallback = apiKeyValidator.handleValidationFailure(missingKeyResult.error!);
      expect(missingKeyFallback.fallbackAction).toBe('prompt-for-key');
      expect(missingKeyFallback.allowRetry).toBe(true);

      // Test invalid format
      const invalidFormatResult = apiKeyValidator.validateKey('invalid-key');
      expect(invalidFormatResult.valid).toBe(false);

      const invalidFormatFallback = apiKeyValidator.handleValidationFailure(invalidFormatResult.error!);
      expect(invalidFormatFallback.fallbackAction).toBe('show-format-help');

      // Test valid key
      const validResult = apiKeyValidator.validateKey('sk-valid-key-12345678901234567890');
      expect(validResult.valid).toBe(true);
    });

    it('should handle Supabase connection failures', async () => {
      const supabaseHandler = {
        async handleConnectionFailure(error: Error): Promise<{
          fallbackMode: string;
          capabilities: Record<string, boolean>;
          message: string;
        }> {
          if (error.message.includes('Network error') || error.message.includes('fetch')) {
            return {
              fallbackMode: 'local-only',
              capabilities: {
                canChat: true,
                canSaveSettings: true,
                canSaveConversations: false,
                canAccessHistory: false,
                canSync: false,
              },
              message: 'Connection failed. Running in offline mode.',
            };
          }

          if (error.message.includes('Database')) {
            return {
              fallbackMode: 'read-only',
              capabilities: {
                canChat: true,
                canSaveSettings: false,
                canSaveConversations: false,
                canAccessHistory: true,
                canSync: false,
              },
              message: 'Database unavailable. Limited functionality.',
            };
          }

          return {
            fallbackMode: 'degraded',
            capabilities: {
              canChat: true,
              canSaveSettings: true,
              canSaveConversations: false,
              canAccessHistory: false,
              canSync: false,
            },
            message: 'Service partially unavailable.',
          };
        },
      };

      // Test network error
      const networkError = new Error('Network error: fetch failed');
      const networkFallback = await supabaseHandler.handleConnectionFailure(networkError);

      expect(networkFallback.fallbackMode).toBe('local-only');
      expect(networkFallback.capabilities.canChat).toBe(true);
      expect(networkFallback.capabilities.canSaveConversations).toBe(false);

      // Test database error
      const dbError = new Error('Database connection failed');
      const dbFallback = await supabaseHandler.handleConnectionFailure(dbError);

      expect(dbFallback.fallbackMode).toBe('read-only');
      expect(dbFallback.capabilities.canSaveSettings).toBe(false);
    });

    it('should implement retry logic with exponential backoff', async () => {
      const retryHandler = {
        maxRetries: 3,
        baseDelay: 1000,

        async withRetry<T>(
          operation: () => Promise<T>,
          shouldRetry: (error: any) => boolean = () => true
        ): Promise<T> {
          let lastError: any;

          for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
              return await operation();
            } catch (error) {
              lastError = error;

              if (attempt === this.maxRetries || !shouldRetry(error)) {
                throw error;
              }

              const delay = this.baseDelay * Math.pow(2, attempt);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }

          throw lastError;
        },

        shouldRetryError(error: any): boolean {
          // Retry on network errors, timeouts, and 5xx server errors
          if (error.name === 'NetworkError') return true;
          if (error.name === 'TimeoutError') return true;
          if (error.status && error.status >= 500) return true;
          if (error.status === 429) return true; // Rate limited

          // Don't retry on authentication errors or client errors
          if (error.status && error.status >= 400 && error.status < 500) return false;

          return false;
        },
      };

      let attemptCount = 0;
      const flakeyOperation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          const error = new Error('Network error') as any;
          error.name = 'NetworkError';
          throw error;
        }
        return 'success';
      };

      const result = await retryHandler.withRetry(flakeyOperation, retryHandler.shouldRetryError);

      expect(result).toBe('success');
      expect(attemptCount).toBe(3);

      // Test non-retryable error
      const authOperation = async () => {
        const error = new Error('Unauthorized') as any;
        error.status = 401;
        throw error;
      };

      await expect(
        retryHandler.withRetry(authOperation, retryHandler.shouldRetryError)
      ).rejects.toThrow('Unauthorized');
    });
  });

  describe('Network Failure Fallbacks', () => {
    it('should detect offline status', () => {
      const networkMonitor = {
        isOnline(): boolean {
          return navigator.onLine;
        },

        getNetworkStatus(): {
          online: boolean;
          connectionType: string;
          effectiveType?: string;
        } {
          const connection = (navigator as any).connection;
          return {
            online: this.isOnline(),
            connectionType: connection?.type || 'unknown',
            effectiveType: connection?.effectiveType || 'unknown',
          };
        },

        async testConnectivity(): Promise<boolean> {
          try {
            const response = await fetch('/health', {
              method: 'HEAD',
              timeout: 5000,
            } as any);
            return response.ok;
          } catch {
            return false;
          }
        },
      };

      // Test online status
      expect(networkMonitor.isOnline()).toBe(true);

      // Test offline simulation
      vi.mocked(window.navigator.onLine) = false;
      expect(networkMonitor.isOnline()).toBe(false);

      // Test network status
      const status = networkMonitor.getNetworkStatus();
      expect(status.online).toBe(false);
      expect(status.connectionType).toBe('unknown');
    });

    it('should enable offline mode when network fails', async () => {
      const offlineManager = {
        isOfflineMode: false,
        offlineCapabilities: {
          canViewCachedConversations: true,
          canEditLocalSettings: true,
          canUseLocalModels: false,
          canSyncWhenOnline: true,
        },

        enableOfflineMode(): void {
          this.isOfflineMode = true;
          this.showOfflineNotification();
          this.enableOfflineFeatures();
        },

        disableOfflineMode(): void {
          this.isOfflineMode = false;
          this.showOnlineNotification();
          this.syncPendingChanges();
        },

        showOfflineNotification(): void {
          // Mock notification system
        },

        showOnlineNotification(): void {
          // Mock notification system
        },

        enableOfflineFeatures(): void {
          // Enable localStorage-based features
        },

        async syncPendingChanges(): Promise<void> {
          // Sync cached changes when back online
        },

        getOfflineCapabilities() {
          return this.offlineCapabilities;
        },
      };

      // Test offline mode activation
      offlineManager.enableOfflineMode();
      expect(offlineManager.isOfflineMode).toBe(true);

      const capabilities = offlineManager.getOfflineCapabilities();
      expect(capabilities.canViewCachedConversations).toBe(true);
      expect(capabilities.canEditLocalSettings).toBe(true);
      expect(capabilities.canUseLocalModels).toBe(false);

      // Test online mode restoration
      offlineManager.disableOfflineMode();
      expect(offlineManager.isOfflineMode).toBe(false);
    });

    it('should cache responses for offline access', () => {
      const responseCache = {
        cache: new Map<string, { data: any; timestamp: number; ttl: number }>(),

        set(key: string, data: any, ttlMs: number = 300000): void {
          this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttlMs,
          });
        },

        get(key: string): any | null {
          const entry = this.cache.get(key);
          if (!entry) return null;

          if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
          }

          return entry.data;
        },

        has(key: string): boolean {
          return this.get(key) !== null;
        },

        clear(): void {
          this.cache.clear();
        },

        size(): number {
          return this.cache.size;
        },

        getStats() {
          const now = Date.now();
          let expired = 0;
          let valid = 0;

          this.cache.forEach(entry => {
            if (now - entry.timestamp > entry.ttl) {
              expired++;
            } else {
              valid++;
            }
          });

          return { total: this.cache.size, valid, expired };
        },
      };

      // Test caching
      const testData = { message: 'Hello World', timestamp: Date.now() };
      responseCache.set('test-key', testData, 60000); // 1 minute TTL

      expect(responseCache.has('test-key')).toBe(true);
      expect(responseCache.get('test-key')).toEqual(testData);

      // Test expiration
      const expiredData = { message: 'Expired' };
      responseCache.set('expired-key', expiredData, -1000); // Already expired

      expect(responseCache.has('expired-key')).toBe(false);
      expect(responseCache.get('expired-key')).toBeNull();

      // Test cache stats
      const stats = responseCache.getStats();
      expect(stats.valid).toBe(1);
      expect(stats.expired).toBe(0); // Expired entries are cleaned up on access
    });

    it('should queue operations for when network returns', () => {
      const operationQueue = {
        queue: [] as Array<{ id: string; operation: () => Promise<any>; retries: number }>,
        maxRetries: 3,
        isProcessing: false,

        add(id: string, operation: () => Promise<any>): void {
          this.queue.push({ id, operation, retries: 0 });
        },

        async process(): Promise<void> {
          if (this.isProcessing) return;
          this.isProcessing = true;

          while (this.queue.length > 0) {
            const item = this.queue.shift()!;

            try {
              await item.operation();
            } catch (error) {
              item.retries++;
              if (item.retries < this.maxRetries) {
                this.queue.push(item); // Re-queue for retry
              }
            }
          }

          this.isProcessing = false;
        },

        clear(): void {
          this.queue = [];
        },

        size(): number {
          return this.queue.length;
        },

        getQueuedOperations(): string[] {
          return this.queue.map(item => item.id);
        },
      };

      // Test queueing operations
      const mockOp1 = vi.fn().mockResolvedValue('result1');
      const mockOp2 = vi.fn().mockRejectedValue(new Error('failed'));

      operationQueue.add('op1', mockOp1);
      operationQueue.add('op2', mockOp2);

      expect(operationQueue.size()).toBe(2);
      expect(operationQueue.getQueuedOperations()).toEqual(['op1', 'op2']);

      // Test processing queue
      operationQueue.process();

      expect(mockOp1).toHaveBeenCalled();
      expect(mockOp2).toHaveBeenCalled();
    });
  });

  describe('Service Degradation Handling', () => {
    it('should handle rate limiting gracefully', async () => {
      const rateLimitHandler = {
        async handleRateLimit(response: Response): Promise<{
          shouldWait: boolean;
          waitTime: number;
          fallbackAction: string;
        }> {
          const retryAfter = response.headers.get('Retry-After');
          const resetTime = response.headers.get('X-RateLimit-Reset');

          if (retryAfter) {
            const waitTime = parseInt(retryAfter) * 1000;
            return {
              shouldWait: waitTime < 60000, // Wait up to 1 minute
              waitTime,
              fallbackAction: waitTime > 60000 ? 'show-error' : 'retry-after-delay',
            };
          }

          if (resetTime) {
            const waitTime = parseInt(resetTime) * 1000 - Date.now();
            return {
              shouldWait: waitTime < 300000, // Wait up to 5 minutes
              waitTime: Math.max(0, waitTime),
              fallbackAction: waitTime > 300000 ? 'show-error' : 'retry-after-delay',
            };
          }

          return {
            shouldWait: false,
            waitTime: 0,
            fallbackAction: 'show-error',
          };
        },
      };

      // Test with Retry-After header
      const rateLimitResponse = {
        status: 429,
        headers: {
          get: vi.fn().mockImplementation((header: string) => {
            if (header === 'Retry-After') return '30';
            return null;
          }),
        },
      } as any;

      const result = await rateLimitHandler.handleRateLimit(rateLimitResponse);

      expect(result.shouldWait).toBe(true);
      expect(result.waitTime).toBe(30000);
      expect(result.fallbackAction).toBe('retry-after-delay');

      // Test with long wait time
      const longWaitResponse = {
        status: 429,
        headers: {
          get: vi.fn().mockImplementation((header: string) => {
            if (header === 'Retry-After') return '3600'; // 1 hour
            return null;
          }),
        },
      } as any;

      const longResult = await rateLimitHandler.handleRateLimit(longWaitResponse);

      expect(longResult.shouldWait).toBe(false);
      expect(longResult.fallbackAction).toBe('show-error');
    });

    it('should handle partial service failures', () => {
      const serviceManager = {
        services: {
          chat: { status: 'operational', lastCheck: Date.now() },
          storage: { status: 'degraded', lastCheck: Date.now() },
          analytics: { status: 'down', lastCheck: Date.now() },
        },

        getAvailableFeatures(): Record<string, boolean> {
          return {
            canChat: this.services.chat.status !== 'down',
            canSaveConversations: this.services.storage.status === 'operational',
            canViewAnalytics: this.services.analytics.status === 'operational',
            canEditSettings: true, // Always available locally
          };
        },

        getServiceStatus(service: string): string {
          return this.services[service as keyof typeof this.services]?.status || 'unknown';
        },

        updateServiceStatus(service: string, status: string): void {
          if (this.services[service as keyof typeof this.services]) {
            this.services[service as keyof typeof this.services] = {
              status,
              lastCheck: Date.now(),
            };
          }
        },

        getHealthSummary(): {
          overall: string;
          details: Record<string, string>;
          available: Record<string, boolean>;
        } {
          const statuses = Object.values(this.services).map(s => s.status);
          const hasDown = statuses.includes('down');
          const hasDegraded = statuses.includes('degraded');

          let overall = 'operational';
          if (hasDown) overall = 'partial';
          else if (hasDegraded) overall = 'degraded';

          return {
            overall,
            details: Object.fromEntries(
              Object.entries(this.services).map(([k, v]) => [k, v.status])
            ),
            available: this.getAvailableFeatures(),
          };
        },
      };

      // Test initial state
      const features = serviceManager.getAvailableFeatures();
      expect(features.canChat).toBe(true);
      expect(features.canSaveConversations).toBe(false); // Storage is degraded
      expect(features.canViewAnalytics).toBe(false); // Analytics is down

      // Test health summary
      const health = serviceManager.getHealthSummary();
      expect(health.overall).toBe('partial'); // Some services are down
      expect(health.details.chat).toBe('operational');
      expect(health.details.storage).toBe('degraded');
      expect(health.details.analytics).toBe('down');

      // Test service status update
      serviceManager.updateServiceStatus('storage', 'operational');
      const updatedFeatures = serviceManager.getAvailableFeatures();
      expect(updatedFeatures.canSaveConversations).toBe(true);
    });

    it('should provide graceful error messages', () => {
      const errorMessageGenerator = {
        generateUserFriendlyMessage(error: {
          type: string;
          code?: string;
          message?: string;
          provider?: string;
        }): {
          title: string;
          message: string;
          action?: string;
          severity: 'info' | 'warning' | 'error';
        } {
          const templates = {
            'network-error': {
              title: 'Connection Issue',
              message: 'Unable to connect to the service. Please check your internet connection.',
              action: 'Try again',
              severity: 'warning' as const,
            },
            'auth-error': {
              title: 'Authentication Failed',
              message: 'Your API key appears to be invalid or expired.',
              action: 'Update API key',
              severity: 'error' as const,
            },
            'rate-limit': {
              title: 'Rate Limit Reached',
              message: 'You have exceeded the rate limit. Please wait before trying again.',
              action: 'Wait and retry',
              severity: 'warning' as const,
            },
            'service-unavailable': {
              title: 'Service Temporarily Unavailable',
              message: 'The service is currently experiencing issues. Please try again later.',
              action: 'Retry later',
              severity: 'error' as const,
            },
            'quota-exceeded': {
              title: 'Usage Limit Reached',
              message: 'You have reached your usage limit for this provider.',
              action: 'Check billing',
              severity: 'warning' as const,
            },
          };

          const template = templates[error.type as keyof typeof templates];
          if (!template) {
            return {
              title: 'Something went wrong',
              message: error.message || 'An unexpected error occurred.',
              severity: 'error',
            };
          }

          return {
            ...template,
            message: error.provider
              ? `${template.message} (Provider: ${error.provider})`
              : template.message,
          };
        },
      };

      // Test different error types
      const networkError = errorMessageGenerator.generateUserFriendlyMessage({
        type: 'network-error',
      });
      expect(networkError.title).toBe('Connection Issue');
      expect(networkError.severity).toBe('warning');
      expect(networkError.action).toBe('Try again');

      const authError = errorMessageGenerator.generateUserFriendlyMessage({
        type: 'auth-error',
        provider: 'OpenAI',
      });
      expect(authError.title).toBe('Authentication Failed');
      expect(authError.message).toContain('Provider: OpenAI');
      expect(authError.severity).toBe('error');

      const unknownError = errorMessageGenerator.generateUserFriendlyMessage({
        type: 'unknown-error',
        message: 'Custom error message',
      });
      expect(unknownError.title).toBe('Something went wrong');
      expect(unknownError.message).toBe('Custom error message');
    });
  });
});