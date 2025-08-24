'use client';

import Image from 'next/image';
import Link from 'next/link';
import { HistoryTrigger } from '@/app/components/history/history-trigger';
import { ButtonNewChat } from '@/app/components/layout/button-new-chat';
import { UserMenu } from '@/app/components/layout/user-menu';
import { useBreakpoint } from '@/app/hooks/use-breakpoint';
import { APP_NAME } from '@/lib/config';
import { useUserPreferences } from '@/lib/user-preference-store/provider';
import { useUser } from '@/lib/user-store/provider';
import { DialogPublish } from './dialog-publish';
import { HeaderSidebarTrigger } from './header-sidebar-trigger';

export function Header({ hasSidebar }: { hasSidebar: boolean }) {
  const isMobile = useBreakpoint(768);
  const { user } = useUser();
  const { preferences } = useUserPreferences();
  const isMultiModelEnabled = preferences.multiModelEnabled;

  const isLoggedIn = !!user;

  return (
    <header className="pointer-events-none fixed top-0 right-0 left-0 z-50 h-app-header">
      <div className="relative mx-auto flex h-full max-w-full items-center justify-between bg-transparent px-4 sm:px-6 lg:bg-transparent lg:px-8">
        <div className="flex flex-1 items-center justify-between">
          <div className="-ml-0.5 lg:-ml-2.5 flex flex-1 items-center gap-2">
            <div className="flex flex-1 items-center gap-2">
              <Link
                className="pointer-events-auto inline-flex items-center font-medium text-xl tracking-tight"
                href="/"
              >
                <Image
                  alt="HGG Logo"
                  className="mr-2 h-8 w-8 rounded-sm"
                  height={32}
                  src="/hgg-logo.png"
                  width={32}
                />
                {APP_NAME}
              </Link>
              {hasSidebar && isMobile && <HeaderSidebarTrigger />}
            </div>
          </div>
          <div />
          {isLoggedIn ? (
            <div className="pointer-events-auto flex flex-1 items-center justify-end gap-2">
              {!isMultiModelEnabled && <DialogPublish />}
              <ButtonNewChat />
              {!hasSidebar && <HistoryTrigger hasSidebar={hasSidebar} />}
              <UserMenu />
            </div>
          ) : (
            <div className="pointer-events-auto flex flex-1 items-center justify-end gap-4">
              <Link
                className="font-base text-base text-muted-foreground transition-colors hover:text-foreground"
                href="/auth"
              >
                Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
