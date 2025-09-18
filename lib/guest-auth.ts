import { generateGuestUserId, isValidUUID } from './utils';

export interface GuestUser {
  id: string;
  email: string;
  anonymous: true;
  created_at: string;
  settings?: Record<string, unknown>;
  apiKeys?: Record<string, string>;
}

export interface GuestSession {
  user: GuestUser;
  isGuest: true;
  sessionId: string;
}

const GUEST_USER_KEY = 'robo-chat-guest-user';
const GUEST_SESSION_KEY = 'robo-chat-guest-session';
const GUEST_SETTINGS_KEY = 'robo-chat-guest-settings';
const GUEST_API_KEYS_KEY = 'robo-chat-guest-api-keys';

export class GuestAuthService {
  private static instance: GuestAuthService;

  public static getInstance(): GuestAuthService {
    if (!GuestAuthService.instance) {
      GuestAuthService.instance = new GuestAuthService();
    }
    return GuestAuthService.instance;
  }

  /**
   * Generate a new guest user ID and store it locally
   */
  generateGuestUser(): GuestUser {
    const guestId = generateGuestUserId();
    const guestUser: GuestUser = {
      id: guestId,
      email: `${guestId}@anonymous.example`,
      anonymous: true,
      created_at: new Date().toISOString(),
    };

    this.setGuestUser(guestUser);
    return guestUser;
  }

  /**
   * Get the current guest user from localStorage
   */
  getGuestUser(): GuestUser | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(GUEST_USER_KEY);
      if (!stored) return null;

      const user = JSON.parse(stored) as GuestUser;

      // Validate the stored user has required fields
      if (!user.id || !isValidUUID(user.id) || !user.anonymous) {
        localStorage.removeItem(GUEST_USER_KEY);
        return null;
      }

      return user;
    } catch {
      localStorage.removeItem(GUEST_USER_KEY);
      return null;
    }
  }

  /**
   * Set guest user in localStorage
   */
  setGuestUser(user: GuestUser): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(GUEST_USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.warn('Failed to store guest user:', error);
    }
  }

  /**
   * Get or create a guest user
   */
  getOrCreateGuestUser(): GuestUser {
    const existing = this.getGuestUser();
    if (existing) return existing;

    return this.generateGuestUser();
  }

  /**
   * Create a guest session
   */
  createGuestSession(): GuestSession {
    const user = this.getOrCreateGuestUser();
    const sessionId = generateGuestUserId();

    const session: GuestSession = {
      user,
      isGuest: true,
      sessionId,
    };

    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(GUEST_SESSION_KEY, JSON.stringify(session));
      } catch (error) {
        console.warn('Failed to store guest session:', error);
      }
    }

    return session;
  }

  /**
   * Get the current guest session
   */
  getGuestSession(): GuestSession | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = sessionStorage.getItem(GUEST_SESSION_KEY);
      if (!stored) return null;

      const session = JSON.parse(stored) as GuestSession;

      // Validate session
      if (!session.user?.id || !session.isGuest || !session.sessionId) {
        sessionStorage.removeItem(GUEST_SESSION_KEY);
        return null;
      }

      return session;
    } catch {
      sessionStorage.removeItem(GUEST_SESSION_KEY);
      return null;
    }
  }

  /**
   * Check if user is in guest mode
   */
  isGuestMode(): boolean {
    return this.getGuestUser() !== null;
  }

  /**
   * Clear guest user and all associated data
   */
  clearGuestData(): void {
    if (typeof window === 'undefined') return;

    localStorage.removeItem(GUEST_USER_KEY);
    localStorage.removeItem(GUEST_SETTINGS_KEY);
    localStorage.removeItem(GUEST_API_KEYS_KEY);
    sessionStorage.removeItem(GUEST_SESSION_KEY);
  }

  /**
   * Store guest settings locally
   */
  saveGuestSettings(settings: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(GUEST_SETTINGS_KEY, JSON.stringify(settings));

      // Also update the user object
      const user = this.getGuestUser();
      if (user) {
        user.settings = settings;
        this.setGuestUser(user);
      }
    } catch (error) {
      console.warn('Failed to save guest settings:', error);
    }
  }

  /**
   * Load guest settings from localStorage
   */
  loadGuestSettings(): Record<string, unknown> | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(GUEST_SETTINGS_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem(GUEST_SETTINGS_KEY);
      return null;
    }
  }

  /**
   * Store API keys for guest user (encrypted in memory/session storage via existing service)
   */
  saveGuestApiKey(provider: string, key: string, scope: 'tab' | 'session' | 'persistent' = 'session'): void {
    // This will use the existing GuestCredentialService
    // We don't store API keys in plain text in localStorage
    if (typeof window === 'undefined') return;

    try {
      const apiKeys = this.loadGuestApiKeys() || {};
      apiKeys[provider] = `***${key.slice(-4)}`; // Store only masked version
      localStorage.setItem(GUEST_API_KEYS_KEY, JSON.stringify(apiKeys));
    } catch (error) {
      console.warn('Failed to save guest API key info:', error);
    }
  }

  /**
   * Load masked API key info for guest user
   */
  loadGuestApiKeys(): Record<string, string> | null {
    if (typeof window === 'undefined') return null;

    try {
      const stored = localStorage.getItem(GUEST_API_KEYS_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem(GUEST_API_KEYS_KEY);
      return null;
    }
  }

  /**
   * Get guest user ID for API requests
   */
  getGuestUserId(): string | null {
    const user = this.getGuestUser();
    return user?.id || null;
  }

  /**
   * Create headers for guest API requests
   */
  getGuestHeaders(): Record<string, string> {
    const userId = this.getGuestUserId();
    const session = this.getGuestSession();

    const headers: Record<string, string> = {};

    if (userId) {
      headers['X-Guest-User-ID'] = userId;
    }

    if (session?.sessionId) {
      headers['X-Guest-Session-ID'] = session.sessionId;
    }

    headers['X-Guest-Mode'] = 'true';

    return headers;
  }

  /**
   * Validate guest user from request headers (server-side)
   */
  static validateGuestFromHeaders(headers: Headers): { userId: string; sessionId?: string } | null {
    const isGuestMode = headers.get('X-Guest-Mode') === 'true';
    const userId = headers.get('X-Guest-User-ID');
    const sessionId = headers.get('X-Guest-Session-ID');

    if (!isGuestMode || !userId || !isValidUUID(userId)) {
      return null;
    }

    return { userId, sessionId: sessionId || undefined };
  }

  /**
   * Create a guest user on the server (for database consistency)
   */
  async createGuestUserOnServer(): Promise<void> {
    const user = this.getGuestUser();
    if (!user) return;

    try {
      const response = await fetch('/api/create-guest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getGuestHeaders(),
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        console.warn('Failed to create guest user on server');
      }
    } catch (error) {
      console.warn('Error creating guest user on server:', error);
    }
  }

  /**
   * Initialize guest mode
   */
  async initializeGuestMode(): Promise<GuestSession> {
    const session = this.createGuestSession();

    // Try to create user on server for database consistency (non-blocking)
    this.createGuestUserOnServer().catch(() => {
      // Ignore server errors in guest mode
    });

    return session;
  }
}

// Export singleton instance
export const guestAuth = GuestAuthService.getInstance();

// Utility functions for convenience
export function isGuestMode(): boolean {
  return guestAuth.isGuestMode();
}

export function getGuestUser(): GuestUser | null {
  return guestAuth.getGuestUser();
}

export function getGuestSession(): GuestSession | null {
  return guestAuth.getGuestSession();
}

export function createGuestSession(): GuestSession {
  return guestAuth.createGuestSession();
}

export function getGuestHeaders(): Record<string, string> {
  return guestAuth.getGuestHeaders();
}