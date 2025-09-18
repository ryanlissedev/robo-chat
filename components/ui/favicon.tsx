'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FaviconProps {
  domain: string;
  size?: number;
  className?: string;
  onLoad?: () => void;
  onError?: () => void;
}

/**
 * Favicon component with error handling and caching
 * Fetches favicons from Google's favicon service with fallback to generic icon
 */
export const Favicon = React.forwardRef<HTMLImageElement, FaviconProps>(
  ({ domain, size = 16, className, onLoad, onError }, ref) => {
    const [hasError, setHasError] = React.useState(false);
    const [isLoaded, setIsLoaded] = React.useState(false);

    // Cache key for favicon URLs
    const faviconUrl = React.useMemo(() => {
      if (!domain || hasError) return null;
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
    }, [domain, size, hasError]);

    const handleLoad = React.useCallback(() => {
      setIsLoaded(true);
      setHasError(false);
      onLoad?.();
    }, [onLoad]);

    const handleError = React.useCallback(() => {
      setHasError(true);
      setIsLoaded(false);
      onError?.();
    }, [onError]);

    // Reset states when domain changes
    React.useEffect(() => {
      setHasError(false);
      setIsLoaded(false);
    }, [domain]);

    // If no domain or error occurred, show fallback icon
    if (!domain || hasError || !faviconUrl) {
      return (
        <Globe
          className={cn('text-muted-foreground', className)}
          style={{ width: size, height: size }}
        />
      );
    }

    return (
      <img
        ref={ref}
        src={faviconUrl}
        alt={`${domain} favicon`}
        width={size}
        height={size}
        className={cn(
          'rounded-sm',
          !isLoaded && 'opacity-0',
          isLoaded && 'opacity-100',
          className
        )}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
      />
    );
  }
);

Favicon.displayName = 'Favicon';