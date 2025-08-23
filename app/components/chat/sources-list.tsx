'use client';

import { CaretDown, Link } from '@phosphor-icons/react';
import type { SourceUrlUIPart } from '@/app/types/ai-extended';
import { AnimatePresence, motion } from 'motion/react';
import Image from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { addUTM, formatUrl, getFavicon } from './utils';

type SourcesListProps = {
  sources: Array<{
    id: string;
    url: string;
    title: string;
  }>;
  className?: string;
};

const TRANSITION = {
  type: 'spring' as const,
  duration: 0.2,
  bounce: 0,
};

export function SourcesList({ sources, className }: SourcesListProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [failedFavicons, setFailedFavicons] = useState<Set<string>>(new Set());

  const handleFaviconError = (url: string) => {
    setFailedFavicons((prev) => new Set(prev).add(url));
  };

  return (
    <div className={cn('my-4', className)}>
      <div className="flex flex-col gap-0 overflow-hidden rounded-md border border-border">
        <button
          className="flex w-full flex-row items-center rounded-t-md px-3 py-2 transition-colors hover:bg-accent"
          onClick={() => setIsExpanded(!isExpanded)}
          type="button"
        >
          <div className="flex flex-1 flex-row items-center gap-2 text-left text-sm">
            Sources
            <div className="-space-x-1 flex">
              {sources?.map((source, index) => {
                const faviconUrl = getFavicon(source?.url || '');
                const showFallback =
                  !faviconUrl || failedFavicons.has(source?.url || '');

                return showFallback ? (
                  <div
                    className="h-4 w-4 rounded-full border border-background bg-muted"
                    key={`${source.url}-${index}`}
                  />
                ) : (
                  <Image
                    alt={`Favicon for ${source.title}`}
                    className="h-4 w-4 rounded-sm border border-background"
                    height={16}
                    key={`${source.url}-${index}`}
                    onError={() => handleFaviconError(source.url)}
                    src={faviconUrl}
                    width={16}
                  />
                );
              })}
              {sources.length > 3 && (
                <span className="ml-1 text-muted-foreground text-xs">
                  +{sources.length - 3}
                </span>
              )}
            </div>
          </div>
          <CaretDown
            className={cn(
              'h-4 w-4 transition-transform',
              isExpanded ? 'rotate-180 transform' : ''
            )}
          />
        </button>

        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              animate={{ height: 'auto', opacity: 1 }}
              className="overflow-hidden"
              exit={{ height: 0, opacity: 0 }}
              initial={{ height: 0, opacity: 0 }}
              transition={TRANSITION}
            >
              <ul className="space-y-2 px-3 pt-3 pb-3">
                {sources.map((source) => {
                  const faviconUrl = getFavicon(source.url);
                  const showFallback =
                    !faviconUrl || failedFavicons.has(source.url);

                  return (
                    <li className="flex items-center text-sm" key={source.id}>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <a
                          className="group line-clamp-1 flex items-center gap-1 text-primary hover:underline"
                          href={addUTM(source.url)}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {showFallback ? (
                            <div className="h-4 w-4 flex-shrink-0 rounded-full bg-muted" />
                          ) : (
                            <Image
                              alt={`Favicon for ${source.title}`}
                              className="h-4 w-4 flex-shrink-0 rounded-sm"
                              height={16}
                              onError={() => handleFaviconError(source.url)}
                              src={faviconUrl}
                              width={16}
                            />
                          )}
                          <span className="truncate">{source.title}</span>
                          <Link className="inline h-3 w-3 flex-shrink-0 opacity-70 transition-opacity group-hover:opacity-100" />
                        </a>
                        <div className="line-clamp-1 text-muted-foreground text-xs">
                          {formatUrl(source.url)}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
