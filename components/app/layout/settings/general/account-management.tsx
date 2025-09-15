'use client';

import React from 'react';

import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';
import { useChats } from '@/lib/chat-store/chats/provider';
import { useMessages } from '@/lib/chat-store/messages/provider';
import { clearAllIndexedDBStores } from '@/lib/chat-store/persist';
import { useUser } from '@/lib/user-store/provider';

export function AccountManagement() {
  const { signOut } = useUser();
  const { resetChats } = useChats();
  const { resetMessages } = useMessages();
  const router = useRouter();

  const handleSignOut = async () => {
    try {
      await resetMessages();
      await resetChats();
      await signOut();
      await clearAllIndexedDBStores();
      router.push('/');
    } catch {
      toast({ title: 'Failed to sign out', status: 'error' });
    }
  };

  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-medium text-sm">Account</h3>
        <p className="text-muted-foreground text-xs">Log out on this device</p>
      </div>
      <Button
        className="flex items-center gap-2"
        onClick={handleSignOut}
        size="sm"
        variant="default"
      >
        <LogOut className="size-4" />
        <span>Sign out</span>
      </Button>
    </div>
  );
}
