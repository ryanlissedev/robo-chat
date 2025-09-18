'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface Source {
  id: string;
  url: string;
  title?: string;
  domain?: string;
  favicon?: string;
}

interface FaviconGroupProps {
  sources: Source[];
  maxVisible?: number;
  className?: string;
}

export function FaviconGroup({
  sources = [],
  maxVisible = 3,
  className,
}: FaviconGroupProps) {
  const visibleSources = sources.slice(0, maxVisible);
  const overflowCount = Math.max(0, sources.length - maxVisible);

  if (sources.length === 0) {
    return null;
  }

  const getFaviconUrl = (source: Source): string => {
    if (source.favicon) {
      return source.favicon;
    }

    try {
      const url = new URL(source.url);
      return `${url.protocol}//${url.hostname}/favicon.ico`;
    } catch {
      return `https://www.google.com/s2/favicons?domain=${source.domain || source.url}&sz=16`;
    }
  };

  return (
    <div className={cn('flex items-center', className)}>
      {/* Overlapping favicons */}
      <div className="flex -space-x-1">
        {visibleSources.map((source, index) => (
          <div
            key={source.id}
            className="relative inline-flex h-4 w-4 items-center justify-center rounded-full border border-background bg-muted ring-1 ring-background"
            style={{ zIndex: maxVisible - index }}
            title={source.title || source.domain || source.url}
          >
            <img
              src={getFaviconUrl(source)}
              alt={`${source.domain || 'Source'} favicon`}
              className="h-3 w-3 rounded-full object-cover"
              onError={(e) => {
                // Fallback to Google favicon service
                const target = e.target as HTMLImageElement;
                const domain = source.domain || new URL(source.url).hostname;
                target.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
              }}
            />
          </div>
        ))}
      </div>

      {/* Overflow indicator */}
      {overflowCount > 0 && (
        <div className="ml-1 flex h-4 w-auto min-w-4 items-center justify-center rounded-full bg-muted px-1 text-xs font-medium text-muted-foreground">
          +{overflowCount}
        </div>
      )}
    </div>
  );
}