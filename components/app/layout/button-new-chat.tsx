import React from 'react';
'use client';

import { PenTool } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useKeyShortcut } from '@/app/hooks/use-key-shortcut';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ButtonNewChat() {
  const pathname = usePathname();
  const router = useRouter();

  useKeyShortcut(
    (e) => (e.key === 'u' || e.key === 'U') && e.metaKey && e.shiftKey,
    () => router.push('/')
  );

  if (pathname === '/') {
    return null;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          aria-label="New Chat"
          className="rounded-full bg-background p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          href="/"
          prefetch
        >
          <PenTool size={24} />
        </Link>
      </TooltipTrigger>
      <TooltipContent>New Chat ⌘⇧U</TooltipContent>
    </Tooltip>
  );
}
