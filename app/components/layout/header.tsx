'use client';

import { Info } from '@phosphor-icons/react';
import Image from 'next/image';
import Link from 'next/link';
import { HistoryTrigger } from '@/app/components/history/history-trigger';
import { AppInfoTrigger } from '@/app/components/layout/app-info/app-info-trigger';
import { ButtonNewChat } from '@/app/components/layout/button-new-chat';
import { ButtonClearChat } from '@/app/components/layout/button-clear-chat';
import { UserMenu } from '@/app/components/layout/user-menu';
import { useBreakpoint } from '@/app/hooks/use-breakpoint';
import { RoboRailIcon } from '@/components/icons/roborail';
import { Button } from '@/components/ui/button';
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
                <div className="mr-2 flex items-center">
                  <Image
                    src="/hgg-logo.png"
                    alt="HGG"
                    width={32}
                    height={32}
                    className="rounded-md"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-semibold">{APP_NAME}</span>
                  <span className="text-xs text-muted-foreground font-normal">by HGG</span>
                </div>
              </Link>
              {hasSidebar && isMobile && <HeaderSidebarTrigger />}
            </div>
          </div>
          <div />
          {isLoggedIn ? (
            <div className="pointer-events-auto flex flex-1 items-center justify-end gap-2">
              {!isMultiModelEnabled && <DialogPublish />}
              <ButtonClearChat />
              <ButtonNewChat />
              {!hasSidebar && <HistoryTrigger hasSidebar={hasSidebar} />}
              <UserMenu />
            </div>
          ) : (
            <div className="pointer-events-auto flex flex-1 items-center justify-end gap-4">
              <AppInfoTrigger
                trigger={
                  <Button
                    aria-label={`About ${APP_NAME}`}
                    className="h-8 w-8 rounded-full bg-background text-muted-foreground hover:bg-muted"
                    size="icon"
                    variant="ghost"
                  >
                    <Info className="size-4" />
                  </Button>
                }
              />
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
