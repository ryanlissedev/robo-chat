'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { FaviconGroup } from '@/components/ui/favicon-group';
import { SourceCard } from '@/components/ai-elements/source-card';
import { useMediaQuery } from '@/lib/hooks/use-media-query';
import { cn } from '@/lib/utils';

export interface Source {
  id: string;
  url: string;
  title: string;
  domain?: string;
  favicon?: string;
}

interface SourcesProps {
  sources: Source[];
  className?: string;
  maxVisibleFavicons?: number;
}

export function Sources({
  sources = [],
  className,
  maxVisibleFavicons = 3,
  ...props
}: SourcesProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 768px)');

  const sourceCount = sources.length;
  const sourceText = sourceCount === 1 ? 'source' : 'sources';

  const triggerContent = (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(
        'h-auto p-2 text-xs text-muted-foreground hover:text-foreground',
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        <FaviconGroup sources={sources} maxVisible={maxVisibleFavicons} />
        <span>{sourceCount} {sourceText}</span>
      </div>
    </Button>
  );

  const contentBody = (
    <div className="space-y-3">
      {sources.map((source, index) => (
        <SourceCard key={source.id} source={source} index={index} />
      ))}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          {triggerContent}
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Sources</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {contentBody}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerContent}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Sources</DialogTitle>
        </DialogHeader>
        {contentBody}
      </DialogContent>
    </Dialog>
  );
}