// app/providers/user-provider.tsx
'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect } from 'react';
import { isSupabaseEnabled } from '@/lib/supabase/config';
import {
  fetchUserProfile,
  signOutUser,
  subscribeToUserUpdates,
  updateUserProfile,
} from '@/lib/user/api';
import type { UserProfile } from '@/lib/user/types';

type UserContextType = {
  user: UserProfile | null;
  isLoading: boolean;
  error: Error | null;
  updateUser: (updates: Partial<UserProfile>) => Promise<void>;
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({
  children,
  initialUser,
}: {
  children: React.ReactNode;
  initialUser: UserProfile | null;
}) {
  const queryClient = useQueryClient();

  const userId = initialUser?.id || null;

  const {
    data: user,
    isLoading,
    error,
  } = useQuery<UserProfile | null>({
    queryKey: ['user', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) {
        return null;
      }
      return await fetchUserProfile(userId);
    },
    initialData: initialUser,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (replaces cacheTime in v5)
    refetchOnWindowFocus: false,
  });

  const updateUserMutation = useMutation({
    mutationFn: async (updates: Partial<UserProfile>) => {
      if (!user?.id) {
        return false;
      }
      return await updateUserProfile(user.id, updates);
    },
    onSuccess: (_ok, updates) => {
      if (!user?.id) {
        return;
      }
      queryClient.setQueryData<UserProfile | null>(['user', user.id], (prev) =>
        prev ? { ...prev, ...updates } : prev
      );
    },
  });

  const updateUser = async (updates: Partial<UserProfile>) => {
    await updateUserMutation.mutateAsync(updates);
  };

  const signOutMutation = useMutation({
    mutationFn: async () => signOutUser(),
    onSuccess: (ok) => {
      if (!ok) {
        return;
      }
      // Clear user cache by setting null
      if (user?.id) {
        queryClient.setQueryData(['user', user.id], null);
      }
    },
  });

  const signOut = async () => {
    await signOutMutation.mutateAsync();
  };

  // Set up realtime subscription for user data changes (only if Supabase is enabled)
  useEffect(() => {
    if (!user?.id || !isSupabaseEnabled) {
      return;
    }
    const unsubscribe = subscribeToUserUpdates(user.id, (newData) => {
      queryClient.setQueryData<UserProfile | null>(['user', user.id], (prev) =>
        prev ? { ...prev, ...newData } : prev
      );
    });
    return () => unsubscribe();
  }, [user?.id, queryClient]);

  const refreshUser = async () => {
    if (!user?.id) {
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['user', user.id] });
  };

  return (
    <UserContext.Provider
      value={{ user, isLoading, error, updateUser, refreshUser, signOut }}
    >
      {children}
    </UserContext.Provider>
  );
}

// Custom hook to use the user context
export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
