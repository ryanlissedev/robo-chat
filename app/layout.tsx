import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Script from 'next/script';
import { ThemeProvider } from 'next-themes';
import { SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ChatsProvider } from '@/lib/chat-store/chats/provider';
import { ChatSessionProvider } from '@/lib/chat-store/session/provider';
import { ModelProvider } from '@/lib/model-store/provider';
import { TanstackQueryProvider } from '@/lib/tanstack-query/tanstack-query-provider';
import { getUserProfile } from '@/lib/user/api';
import { UserPreferencesProvider } from '@/lib/user-preference-store/provider';
import { UserProvider } from '@/lib/user-store/provider';
import { LayoutClient } from './layout-client';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || 
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 
    'http://localhost:3000'
  ),
  title: 'RoboRail Assistant Chat - AI Chat Platform',
  description:
    'RoboRail Assistant Chat is a powerful AI chat platform. Built with GPT-5 support, optional file search, and observability hooks. Your intelligent assistant for productive conversations.',
  keywords: 'AI chat, GPT-5, chatbot starter, scaffold, Next.js, Vercel AI SDK',
  authors: [{ name: 'RoboRail' }],
  openGraph: {
    title: 'RoboRail Assistant Chat - AI Chat Platform',
    description: 'Your intelligent assistant for productive conversations',
    type: 'website',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';
  const isOfficialDeployment = process.env.ZOLA_OFFICIAL === 'true';
  const userProfile = await getUserProfile();

  return (
    <html lang="en" suppressHydrationWarning>
      {isOfficialDeployment ? (
        <Script
          defer
          src="https://assets.onedollarstats.com/stonks.js"
          {...(isDev ? { 'data-debug': 'zola.chat' } : {})}
        />
      ) : null}
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <TanstackQueryProvider>
          <LayoutClient />
          <UserProvider initialUser={userProfile}>
            <ModelProvider>
              <ChatsProvider userId={userProfile?.id}>
                <ChatSessionProvider>
                  <UserPreferencesProvider
                    initialPreferences={userProfile?.preferences}
                    userId={userProfile?.id}
                  >
                    <TooltipProvider
                      delayDuration={200}
                      skipDelayDuration={500}
                    >
                      <ThemeProvider
                        attribute="class"
                        defaultTheme="light"
                        disableTransitionOnChange
                        enableSystem
                      >
                        <SidebarProvider defaultOpen>
                          <Toaster position="top-center" />
                          <div id="guest-byok-modal-root" />
                          {children}
                        </SidebarProvider>
                      </ThemeProvider>
                    </TooltipProvider>
                  </UserPreferencesProvider>
                </ChatSessionProvider>
              </ChatsProvider>
            </ModelProvider>
          </UserProvider>
        </TanstackQueryProvider>
      </body>
    </html>
  );
}
