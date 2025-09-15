'use client';

import React from 'react';

import { Github } from 'lucide-react';
import { useState } from 'react';
import XIcon from '@/components/icons/x';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useUser } from '@/lib/user-store/provider';
import { AppInfoTrigger } from './app-info/app-info-trigger';
import { FeedbackTrigger } from './feedback/feedback-trigger';
import { SettingsTrigger } from './settings/settings-trigger';

export function UserMenu() {
  const { user } = useUser();
  const [isMenuOpen, setMenuOpen] = useState(false);
  const [isSettingsOpen, setSettingsOpen] = useState(false);

  if (!user) {
    return null;
  }

  const handleSettingsOpenChange = (isOpen: boolean) => {
    setSettingsOpen(isOpen);
    if (!isOpen) {
      setMenuOpen(false);
    }
  };

  return (
    // fix shadcn/ui / radix bug when dialog into dropdown menu
    <DropdownMenu modal={false} onOpenChange={setMenuOpen} open={isMenuOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger>
            <Avatar className="bg-background hover:bg-muted">
              <AvatarImage src={user?.profile_image ?? undefined} />
              <AvatarFallback>{user?.display_name?.charAt(0)}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Profile</TooltipContent>
      </Tooltip>
      <DropdownMenuContent
        align="end"
        className="w-56"
        forceMount
        onCloseAutoFocus={(e: Event) => e.preventDefault()}
        onInteractOutside={(e: Event) => {
          if (isSettingsOpen) {
            e.preventDefault();
            return;
          }
          setMenuOpen(false);
        }}
      >
        <DropdownMenuItem className="flex flex-col items-start gap-0 no-underline hover:bg-transparent focus:bg-transparent">
          <span>{user?.display_name}</span>
          <span className="max-w-full truncate text-muted-foreground">
            {user?.email}
          </span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <SettingsTrigger onOpenChange={handleSettingsOpenChange} />
        <FeedbackTrigger />
        <AppInfoTrigger />
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a
            className="flex items-center gap-2"
            href="https://x.com/zoladotchat"
            rel="noopener noreferrer"
            target="_blank"
          >
            <XIcon className="size-4 p-0.5" />
            <span>@zoladotchat</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a
            className="flex items-center gap-2"
            href="https://github.com/ibelick/zola"
            rel="noopener noreferrer"
            target="_blank"
          >
            <Github className="size-4" />
            <span>GitHub</span>
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
