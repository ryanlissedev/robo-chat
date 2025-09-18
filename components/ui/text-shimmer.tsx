import type React from 'react';
import { cn } from '@/lib/utils';

interface TextShimmerProps extends React.ComponentProps<'span'> {
  children?: React.ReactNode;
  className?: string;
}

function TextShimmer({ children, className, ...props }: TextShimmerProps) {
  return (
    <span
      className={cn(
        'relative overflow-hidden text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-clip-text animate-shimmer',
        className
      )}
      data-testid="text-shimmer"
      {...props}
    >
      {children}
    </span>
  );
}

export { TextShimmer };
export type { TextShimmerProps };