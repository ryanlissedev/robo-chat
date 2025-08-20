'use client';

import {
  CaretDownIcon,
  MagnifyingGlassIcon,
  StarIcon,
} from '@phosphor-icons/react';
import { useRef, useState } from 'react';
import { PopoverContentAuth } from '@/app/components/chat-input/popover-content-auth';
import { useBreakpoint } from '@/app/hooks/use-breakpoint';
import { useKeyShortcut } from '@/app/hooks/use-key-shortcut';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useModel } from '@/lib/model-store/provider';
import { filterAndSortModels } from '@/lib/model-store/utils';
import type { ModelConfig } from '@/lib/models/types';
import { PROVIDERS } from '@/lib/providers';
import { useUserPreferences } from '@/lib/user-preference-store/provider';
import { cn } from '@/lib/utils';
import { ProModelDialog } from './pro-dialog';
import { SubMenu } from './sub-menu';

type ModelSelectorProps = {
  selectedModelId: string;
  setSelectedModelId: (modelId: string) => void;
  className?: string;
  isUserAuthenticated?: boolean;
};

export function ModelSelector({
  selectedModelId,
  setSelectedModelId,
  className,
  isUserAuthenticated = true,
}: ModelSelectorProps) {
  const { models, isLoading: isLoadingModels, favoriteModels } = useModel();
  const { isModelHidden } = useUserPreferences();

  const currentModel = models.find((model) => model.id === selectedModelId);
  const currentProvider = PROVIDERS.find(
    (provider) => provider.id === currentModel?.icon
  );
  const isMobile = useBreakpoint(768);

  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProDialogOpen, setIsProDialogOpen] = useState(false);
  const [selectedProModel, setSelectedProModel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Ref for input to maintain focus
  const searchInputRef = useRef<HTMLInputElement>(null);

  useKeyShortcut(
    (e) => (e.key === 'p' || e.key === 'P') && e.metaKey && e.shiftKey,
    () => {
      if (isMobile) {
        setIsDrawerOpen((prev) => !prev);
      } else {
        setIsDropdownOpen((prev) => !prev);
      }
    }
  );

  const renderModelItem = (model: ModelConfig) => {
    const isLocked = !model.accessible;
    const provider = PROVIDERS.find((provider) => provider.id === model.icon);

    return (
      <div
        className={cn(
          'flex w-full items-center justify-between px-3 py-2',
          selectedModelId === model.id && 'bg-accent'
        )}
        key={model.id}
        onClick={() => {
          if (isLocked) {
            setSelectedProModel(model.id);
            setIsProDialogOpen(true);
            return;
          }

          setSelectedModelId(model.id);
          if (isMobile) {
            setIsDrawerOpen(false);
          } else {
            setIsDropdownOpen(false);
          }
        }}
      >
        <div className="flex items-center gap-3">
          {provider?.icon && <provider.icon className="size-5" />}
          <div className="flex flex-col gap-0">
            <span className="text-sm">{model.name}</span>
          </div>
        </div>
        {isLocked && (
          <div className="flex items-center gap-0.5 rounded-full border border-input bg-accent px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
            <StarIcon className="size-2" />
            <span>Locked</span>
          </div>
        )}
      </div>
    );
  };

  // Get the hovered model data
  const hoveredModelData = models.find((model) => model.id === hoveredModel);

  const filteredModels = filterAndSortModels(
    models,
    favoriteModels || [],
    searchQuery,
    isModelHidden
  );

  const trigger = (
    <Button
      className={cn('justify-between dark:bg-secondary', className)}
      disabled={isLoadingModels}
      variant="outline"
      data-testid="model-selector-trigger"
    >
      <div className="flex items-center gap-2">
        {currentProvider?.icon && <currentProvider.icon className="size-5" />}
        <span data-testid="selected-model-name">{currentModel?.name || 'Select model'}</span>
      </div>
      <CaretDownIcon className="size-4 opacity-50" />
    </Button>
  );

  // Handle input change without losing focus
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSearchQuery(e.target.value);
  };

  // INTERNAL USE: Always allow model selection for guest users
  // If user is not authenticated, show the auth popover (disabled for internal use)
  if (false && !isUserAuthenticated) {
    return (
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                className={cn(
                  'h-9 w-auto border border-border bg-transparent text-accent-foreground dark:bg-secondary',
                  className
                )}
                size="sm"
                type="button"
                variant="secondary"
              >
                {currentProvider?.icon && (
                  <currentProvider.icon className="size-5" />
                )}
                {currentModel?.name}
                <CaretDownIcon className="size-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Select a model</TooltipContent>
        </Tooltip>
        <PopoverContentAuth />
      </Popover>
    );
  }

  if (isMobile) {
    return (
      <>
        <ProModelDialog
          currentModel={selectedProModel || ''}
          isOpen={isProDialogOpen}
          setIsOpen={setIsProDialogOpen}
        />
        <Drawer onOpenChange={setIsDrawerOpen} open={isDrawerOpen}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Select Model</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-2">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  onChange={handleSearchChange}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Search models..."
                  ref={searchInputRef}
                  value={searchQuery}
                />
              </div>
            </div>
            <div className="flex h-full flex-col space-y-0 overflow-y-auto px-4 pb-6">
              {isLoadingModels ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <p className="mb-2 text-muted-foreground text-sm">
                    Loading models...
                  </p>
                </div>
              ) : filteredModels.length > 0 ? (
                filteredModels.map((model) => renderModelItem(model))
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <p className="mb-2 text-muted-foreground text-sm">
                    No results found.
                  </p>
                  <a
                    className="text-muted-foreground text-sm underline"
                    href="https://github.com/ibelick/zola/issues/new?title=Model%20Request%3A%20"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Request a new model
                  </a>
                </div>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <div>
      <ProModelDialog
        currentModel={selectedProModel || ''}
        isOpen={isProDialogOpen}
        setIsOpen={setIsProDialogOpen}
      />
      <Tooltip>
        <DropdownMenu
          onOpenChange={(open) => {
            setIsDropdownOpen(open);
            if (open) {
              if (selectedModelId) {
                setHoveredModel(selectedModelId);
              }
            } else {
              setHoveredModel(null);
              setSearchQuery('');
            }
          }}
          open={isDropdownOpen}
        >
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent>Switch model ⌘⇧P</TooltipContent>
          <DropdownMenuContent
            align="start"
            className="flex h-[320px] w-[300px] flex-col space-y-0.5 overflow-visible p-0"
            forceMount
            side="top"
            sideOffset={4}
            data-testid="model-selector-content"
          >
            <div className="sticky top-0 z-10 rounded-t-md border-b bg-background px-0 pt-0 pb-0">
              <div className="relative">
                <MagnifyingGlassIcon className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  className="rounded-b-none border border-none pl-8 shadow-none focus-visible:ring-0 dark:bg-popover"
                  onChange={handleSearchChange}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Search models..."
                  ref={searchInputRef}
                  value={searchQuery}
                />
              </div>
            </div>
            <div className="flex h-full flex-col space-y-0 overflow-y-auto px-1 pt-0 pb-0">
              {isLoadingModels ? (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <p className="mb-2 text-muted-foreground text-sm">
                    Loading models...
                  </p>
                </div>
              ) : filteredModels.length > 0 ? (
                filteredModels.map((model) => {
                  const isLocked = !model.accessible;
                  const provider = PROVIDERS.find(
                    (provider) => provider.id === model.icon
                  );

                  return (
                    <DropdownMenuItem
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-2',
                        selectedModelId === model.id && 'bg-accent'
                      )}
                      key={model.id}
                      data-testid={`model-option-${model.id}`}
                      onFocus={() => {
                        if (isDropdownOpen) {
                          setHoveredModel(model.id);
                        }
                      }}
                      onMouseEnter={() => {
                        if (isDropdownOpen) {
                          setHoveredModel(model.id);
                        }
                      }}
                      onSelect={() => {
                        if (isLocked) {
                          setSelectedProModel(model.id);
                          setIsProDialogOpen(true);
                          return;
                        }

                        setSelectedModelId(model.id);
                        setIsDropdownOpen(false);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {provider?.icon && <provider.icon className="size-5" />}
                        <div className="flex flex-col gap-0">
                          <span className="text-sm">{model.name}</span>
                        </div>
                      </div>
                      {isLocked && (
                        <div className="flex items-center gap-0.5 rounded-full border border-input bg-accent px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
                          <span>Locked</span>
                        </div>
                      )}
                    </DropdownMenuItem>
                  );
                })
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <p className="mb-1 text-muted-foreground text-sm">
                    No results found.
                  </p>
                  <a
                    className="text-muted-foreground text-sm underline"
                    href="https://github.com/ibelick/zola/issues/new?title=Model%20Request%3A%20"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    Request a new model
                  </a>
                </div>
              )}
            </div>

            {/* Submenu positioned absolutely */}
            {hoveredModelData && (
              <div className="absolute top-0 left-[calc(100%+8px)]">
                <SubMenu hoveredModelData={hoveredModelData} />
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </Tooltip>
    </div>
  );
}
