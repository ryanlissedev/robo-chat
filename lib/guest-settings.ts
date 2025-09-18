import { type UserPreferences, defaultPreferences } from '@/lib/user-preference-store/utils';
import { guestAuth } from './guest-auth';

const GUEST_SETTINGS_KEY = 'robo-chat-guest-settings';
const GUEST_API_KEYS_META_KEY = 'robo-chat-guest-api-keys-meta';

export interface GuestSettings extends UserPreferences {
  // Additional guest-specific settings
  rememberApiKeys: boolean;
  preferredStorage: 'session' | 'persistent';
  autoSaveChats: boolean;
}

export interface GuestApiKeyMeta {
  provider: string;
  masked: string;
  storage: 'tab' | 'session' | 'persistent';
  lastUsed?: string;
}

export const defaultGuestSettings: GuestSettings = {
  ...defaultPreferences,
  rememberApiKeys: true,
  preferredStorage: 'session',
  autoSaveChats: false, // Guest users don't save to server by default
};

export class GuestSettingsService {
  private static instance: GuestSettingsService;

  public static getInstance(): GuestSettingsService {
    if (!GuestSettingsService.instance) {
      GuestSettingsService.instance = new GuestSettingsService();
    }
    return GuestSettingsService.instance;
  }

  /**
   * Load guest settings from localStorage
   */
  loadSettings(): GuestSettings {
    if (typeof window === 'undefined') {
      return defaultGuestSettings;
    }

    try {
      const stored = localStorage.getItem(GUEST_SETTINGS_KEY);
      if (!stored) {
        return defaultGuestSettings;
      }

      const parsed = JSON.parse(stored) as Partial<GuestSettings>;

      // Merge with defaults to ensure all properties are present
      return {
        ...defaultGuestSettings,
        ...parsed,
      };
    } catch (error) {
      console.warn('Failed to load guest settings:', error);
      return defaultGuestSettings;
    }
  }

  /**
   * Save guest settings to localStorage
   */
  saveSettings(settings: Partial<GuestSettings>): void {
    if (typeof window === 'undefined') return;

    try {
      const currentSettings = this.loadSettings();
      const updatedSettings = { ...currentSettings, ...settings };

      localStorage.setItem(GUEST_SETTINGS_KEY, JSON.stringify(updatedSettings));

      // Also update in guest auth service for consistency
      guestAuth.saveGuestSettings(updatedSettings);

      // Dispatch custom event for components to listen
      window.dispatchEvent(new CustomEvent('guestSettingsChanged', {
        detail: updatedSettings
      }));
    } catch (error) {
      console.warn('Failed to save guest settings:', error);
    }
  }

  /**
   * Get a specific setting value
   */
  getSetting<K extends keyof GuestSettings>(key: K): GuestSettings[K] {
    const settings = this.loadSettings();
    return settings[key];
  }

  /**
   * Set a specific setting value
   */
  setSetting<K extends keyof GuestSettings>(key: K, value: GuestSettings[K]): void {
    this.saveSettings({ [key]: value } as Partial<GuestSettings>);
  }

  /**
   * Reset settings to defaults
   */
  resetSettings(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(GUEST_SETTINGS_KEY);

      // Dispatch reset event
      window.dispatchEvent(new CustomEvent('guestSettingsReset', {
        detail: defaultGuestSettings
      }));
    } catch (error) {
      console.warn('Failed to reset guest settings:', error);
    }
  }

  /**
   * Export settings as JSON for backup
   */
  exportSettings(): string {
    const settings = this.loadSettings();
    return JSON.stringify(settings, null, 2);
  }

  /**
   * Import settings from JSON
   */
  importSettings(settingsJson: string): boolean {
    try {
      const settings = JSON.parse(settingsJson) as Partial<GuestSettings>;

      // Validate required properties exist
      if (typeof settings === 'object' && settings !== null) {
        this.saveSettings(settings);
        return true;
      }

      return false;
    } catch (error) {
      console.warn('Failed to import guest settings:', error);
      return false;
    }
  }

  /**
   * Save API key metadata (for display purposes only)
   */
  saveApiKeyMeta(provider: string, meta: Omit<GuestApiKeyMeta, 'provider'>): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(GUEST_API_KEYS_META_KEY);
      const apiKeysMeta = stored ? JSON.parse(stored) : {};

      apiKeysMeta[provider] = {
        provider,
        ...meta,
        lastUsed: new Date().toISOString(),
      };

      localStorage.setItem(GUEST_API_KEYS_META_KEY, JSON.stringify(apiKeysMeta));
    } catch (error) {
      console.warn('Failed to save API key metadata:', error);
    }
  }

  /**
   * Load API keys metadata
   */
  loadApiKeysMeta(): Record<string, GuestApiKeyMeta> {
    if (typeof window === 'undefined') return {};

    try {
      const stored = localStorage.getItem(GUEST_API_KEYS_META_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.warn('Failed to load API keys metadata:', error);
      return {};
    }
  }

  /**
   * Remove API key metadata
   */
  removeApiKeyMeta(provider: string): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(GUEST_API_KEYS_META_KEY);
      if (!stored) return;

      const apiKeysMeta = JSON.parse(stored);
      delete apiKeysMeta[provider];

      localStorage.setItem(GUEST_API_KEYS_META_KEY, JSON.stringify(apiKeysMeta));
    } catch (error) {
      console.warn('Failed to remove API key metadata:', error);
    }
  }

  /**
   * Clear all guest settings and data
   */
  clearAllData(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem(GUEST_SETTINGS_KEY);
      localStorage.removeItem(GUEST_API_KEYS_META_KEY);

      // Also clear guest auth data
      guestAuth.clearGuestData();

      // Dispatch clear event
      window.dispatchEvent(new CustomEvent('guestDataCleared'));
    } catch (error) {
      console.warn('Failed to clear guest data:', error);
    }
  }

  /**
   * Get storage usage statistics
   */
  getStorageStats(): {
    settingsSize: number;
    apiKeysMetaSize: number;
    totalSize: number;
  } {
    if (typeof window === 'undefined') {
      return { settingsSize: 0, apiKeysMetaSize: 0, totalSize: 0 };
    }

    try {
      const settingsData = localStorage.getItem(GUEST_SETTINGS_KEY) || '';
      const apiKeysData = localStorage.getItem(GUEST_API_KEYS_META_KEY) || '';

      const settingsSize = new Blob([settingsData]).size;
      const apiKeysMetaSize = new Blob([apiKeysData]).size;

      return {
        settingsSize,
        apiKeysMetaSize,
        totalSize: settingsSize + apiKeysMetaSize,
      };
    } catch (error) {
      console.warn('Failed to calculate storage stats:', error);
      return { settingsSize: 0, apiKeysMetaSize: 0, totalSize: 0 };
    }
  }
}

// Export singleton instance
export const guestSettings = GuestSettingsService.getInstance();

// Utility functions for convenience
export function loadGuestSettings(): GuestSettings {
  return guestSettings.loadSettings();
}

export function saveGuestSettings(settings: Partial<GuestSettings>): void {
  guestSettings.saveSettings(settings);
}

export function getGuestSetting<K extends keyof GuestSettings>(key: K): GuestSettings[K] {
  return guestSettings.getSetting(key);
}

export function setGuestSetting<K extends keyof GuestSettings>(key: K, value: GuestSettings[K]): void {
  guestSettings.setSetting(key, value);
}