'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Source {
  id: string;
  url: string;
  title: string;
  domain?: string;
  favicon?: string;
}

interface SourceCardProps {
  source: Source;
  index: number;
  className?: string;
}

export function SourceCard({ source, index, className }: SourceCardProps) {
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

  const getDomain = (source: Source): string => {
    if (source.domain) {
      return source.domain;
    }

    try {
      const url = new URL(source.url);
      return url.hostname;
    } catch {
      return source.url;
    }
  };

  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'group flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50',
        className
      )}
    >
      {/* Favicon */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background">
        <img
          src={getFaviconUrl(source)}
          alt={`${getDomain(source)} favicon`}
          className="h-4 w-4 rounded-sm object-cover"
          onError={(e) => {
            // Fallback to Google favicon service
            const target = e.target as HTMLImageElement;
            const domain = getDomain(source);
            target.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm leading-tight line-clamp-2 group-hover:text-foreground">
              {source.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground truncate">
              {getDomain(source)}
            </p>
          </div>

          {/* External link icon */}
          <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>
    </a>
  );
}