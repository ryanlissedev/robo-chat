'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  guestAuth,
  type GuestUser,
  type GuestSession,
  isGuestMode,
  getGuestUser,
  getGuestSession,
} from '@/lib/guest-auth';

interface GuestAuthContextType {
  user: GuestUser | null;
  session: GuestSession | null;
  isLoading: boolean;
  isGuestMode: boolean;
  initializeGuestMode: () => Promise<GuestSession>;
  clearGuestData: () => void;
  saveSettings: (settings: Record<string, unknown>) => void;
  loadSettings: () => Record<string, unknown> | null;
  getAuthHeaders: () => Record<string, string>;
}

const GuestAuthContext = createContext<GuestAuthContextType | undefined>(undefined);

interface GuestAuthProviderProps {
  children: ReactNode;
}

export function GuestAuthProvider({ children }: GuestAuthProviderProps) {
  const [user, setUser] = useState<GuestUser | null>(null);
  const [session, setSession] = useState<GuestSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize guest auth state
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const guestUser = getGuestUser();
        const guestSession = getGuestSession();

        setUser(guestUser);
        setSession(guestSession);
      } catch (error) {
        console.warn('Failed to initialize guest auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Listen for storage changes (when user data is updated in another tab)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'robo-chat-guest-user') {
        const updatedUser = getGuestUser();
        setUser(updatedUser);
      }
    };

    const handleSessionStorageChange = () => {
      const updatedSession = getGuestSession();
      setSession(updatedSession);
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleSessionStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleSessionStorageChange);
    };
  }, []);

  const initializeGuestMode = async (): Promise<GuestSession> => {
    setIsLoading(true);
    try {
      const newSession = await guestAuth.initializeGuestMode();
      setUser(newSession.user);
      setSession(newSession);
      return newSession;
    } finally {
      setIsLoading(false);
    }
  };

  const clearGuestData = () => {
    guestAuth.clearGuestData();
    setUser(null);
    setSession(null);
  };

  const saveSettings = (settings: Record<string, unknown>) => {
    guestAuth.saveGuestSettings(settings);

    // Update user object with new settings
    if (user) {
      const updatedUser = { ...user, settings };
      setUser(updatedUser);
    }
  };

  const loadSettings = (): Record<string, unknown> | null => {
    return guestAuth.loadGuestSettings();
  };

  const getAuthHeaders = (): Record<string, string> => {
    return guestAuth.getGuestHeaders();
  };

  const value: GuestAuthContextType = {
    user,
    session,
    isLoading,
    isGuestMode: isGuestMode(),
    initializeGuestMode,
    clearGuestData,
    saveSettings,
    loadSettings,
    getAuthHeaders,
  };

  return (
    <GuestAuthContext.Provider value={value}>
      {children}
    </GuestAuthContext.Provider>
  );
}

export function useGuestAuth(): GuestAuthContextType {
  const context = useContext(GuestAuthContext);
  if (context === undefined) {
    throw new Error('useGuestAuth must be used within a GuestAuthProvider');
  }
  return context;
}

// Convenience hooks for common operations
export function useGuestUser(): GuestUser | null {
  const { user } = useGuestAuth();
  return user;
}

export function useGuestSession(): GuestSession | null {
  const { session } = useGuestAuth();
  return session;
}

export function useIsGuestMode(): boolean {
  const { isGuestMode } = useGuestAuth();
  return isGuestMode;
}

export function useGuestAuthHeaders(): Record<string, string> {
  const { getAuthHeaders } = useGuestAuth();
  return getAuthHeaders();
}