import React from 'react';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { PopoverContentAuth } from './popover-content-auth';

type ButtonSearchProps = {
  isSelected?: boolean;
  onToggle?: (isSelected: boolean) => void;
  isAuthenticated: boolean;
};

export function ButtonSearch({
  isSelected = false,
  onToggle,
  isAuthenticated,
}: ButtonSearchProps) {
  const handleClick = () => {
    const newState = !isSelected;
    onToggle?.(newState);
  };

  if (!isAuthenticated) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            className="rounded-full border border-border bg-transparent dark:bg-secondary"
            variant="secondary"
          >
            <Globe className="size-5" />
            Search
          </Button>
        </PopoverTrigger>
        <PopoverContentAuth />
      </Popover>
    );
  }

  return (
    <Button
      className={cn(
        'rounded-full border border-border bg-transparent transition-all duration-150 has-[>svg]:px-1.75 md:has-[>svg]:px-3 dark:bg-secondary',
        isSelected &&
          'border-[#0091FF]/20 bg-[#E5F3FE] text-[#0091FF] hover:bg-[#E5F3FE] hover:text-[#0091FF]'
      )}
      onClick={handleClick}
      variant="secondary"
    >
      <Globe className="size-5" />
      <span className="hidden md:block">Search</span>
    </Button>
  );
}
