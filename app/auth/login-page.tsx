'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signInWithGoogle } from '@/lib/api';
import { createClient } from '@/lib/supabase/client';
import { HeaderGoBack } from '../components/header-go-back';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignInWithGoogle() {
    const supabase = createClient();

    if (!supabase) {
      throw new Error('Supabase is not configured');
    }

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
  }

  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <HeaderGoBack href="/" />

      <main className="flex flex-1 flex-col items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="font-medium text-3xl text-foreground tracking-tight sm:text-4xl">
              Welcome to Zola
            </h1>
            <p className="mt-3 text-muted-foreground">
              Sign in below to increase your message limits.
            </p>
          </div>
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
              {error}
            </div>
          )}
          <div className="mt-8">
            <Button
              className="w-full text-base sm:text-base"
              disabled={isLoading}
              onClick={handleSignInWithGoogle}
              size="lg"
              variant="secondary"
            >
              <Image
                alt="Google logo"
                className="mr-2 size-4"
                height={20}
                src="https://www.google.com/favicon.ico"
                width={20}
              />
              <span>
                {isLoading ? 'Connecting...' : 'Continue with Google'}
              </span>
            </Button>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-muted-foreground text-sm">
        {/* @todo */}
        <p>
          By continuing, you agree to our{' '}
          <Link className="text-foreground hover:underline" href="/">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link className="text-foreground hover:underline" href="/">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  );
}
