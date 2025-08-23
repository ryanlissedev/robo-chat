'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { signInWithGoogle } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { isSupabaseEnabled } from '@/lib/supabase/config';

type DialogAuthProps = {
  open: boolean;
  setOpen: (open: boolean) => void;
};

export function DialogAuth({ open, setOpen }: DialogAuthProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isSupabaseEnabled) {
    return null;
  }

  const supabase = createClient();

  if (!supabase) {
    return null;
  }

  const handleSignInWithGoogle = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const data = await signInWithGoogle(supabase);

      // Redirect to the provider URL
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      setError(
        (err as Error).message ||
          'An unexpected error occurred. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={setOpen} open={open}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">
            You&apos;ve reached the limit for today
          </DialogTitle>
          <DialogDescription className="pt-2 text-base">
            Sign in below to increase your message limits.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
            {error}
          </div>
        )}
        <DialogFooter className="mt-6 sm:justify-center">
          <Button
            className="w-full text-base"
            disabled={isLoading}
            onClick={handleSignInWithGoogle}
            size="lg"
            variant="secondary"
          >
            <img
              alt="Google logo"
              className="mr-2 size-4"
              height={20}
              src="https://www.google.com/favicon.ico"
              width={20}
            />
            <span>{isLoading ? 'Connecting...' : 'Continue with Google'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
