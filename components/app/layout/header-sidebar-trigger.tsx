'use client';

import { PanelLeft } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type HeaderSidebarTriggerProps = React.HTMLAttributes<HTMLButtonElement>;

export function HeaderSidebarTrigger({
  className,
  ...props
}: HeaderSidebarTriggerProps) {
  const { toggleSidebar, open } = useSidebar();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          className={cn(
            'pointer-events-auto',
            'rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
            'inline-flex size-9 items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            className
          )}
          onClick={toggleSidebar}
          type="button"
          {...props}
        >
          <PanelLeft size={20} />
          <span className="sr-only">Toggle sidebar</span>
        </button>
      </TooltipTrigger>
      <TooltipContent>{open ? 'Close sidebar' : 'Open sidebar'}</TooltipContent>
    </Tooltip>
  );
}

