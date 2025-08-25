'use client';

import {
  CaretDownIcon,
  CheckIcon,
  MagnifyingGlassIcon,
  StarIcon,
} from '@phosphor-icons/react';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { PopoverContentAuth } from '@/components/app/chat-input/popover-content-auth';
import { useBreakpoint } from '@/app/hooks/use-breakpoint';
import { useKeyShortcut } from '@/app/hooks/use-key-shortcut';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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
import { ProModelDialog } from '../model-selector/pro-dialog';
import { SubMenu } from '../model-selector/sub-menu';

type MultiModelSelectorProps = {
  selectedModelIds: string[];
  setSelectedModelIds: (modelIds: string[]) => void;
  className?: string;
  isUserAuthenticated?: boolean;
  maxModels?: number;
};

export function MultiModelSelector({
  selectedModelIds,
  setSelectedModelIds,
  className,
  isUserAuthenticated = true,
  maxModels = 5,
}: MultiModelSelectorProps) {
  const { models, isLoading: isLoadingModels, favoriteModels } = useModel();
  const { isModelHidden } = useUserPreferences();

  const selectedModels = models.filter((model) =>
    selectedModelIds.includes(model.id)
  );
  const isMobile = useBreakpoint(768);

  const [hoveredModel, setHoveredModel] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isProDialogOpen, setIsProDialogOpen] = useState(false);
  const [selectedProModel, setSelectedProModel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const searchInputRef = useRef<HTMLInputElement>(null);

  useKeyShortcut(
    (e) => (e.key === 'm' || e.key === 'M') && e.metaKey && e.shiftKey,
    () => {
      if (isMobile) {
        setIsDrawerOpen((prev) => !prev);
      } else {
        setIsDropdownOpen((prev) => !prev);
      }
    }
  );

  const handleModelToggle = (modelId: string, isLocked: boolean) => {
    if (isLocked) {
      setSelectedProModel(modelId);
      setIsProDialogOpen(true);
      return;
    }

    const isSelected = selectedModelIds.includes(modelId);

    if (isSelected) {
      setSelectedModelIds(selectedModelIds.filter((id) => id !== modelId));
    } else if (selectedModelIds.length < maxModels) {
      setSelectedModelIds([...selectedModelIds, modelId]);
    }
  };

  const renderModelItem = (model: ModelConfig) => {
    const isLocked = !model.accessible;
    const isSelected = selectedModelIds.includes(model.id);
    const isAtLimit = selectedModelIds.length >= maxModels;
    const provider = PROVIDERS.find((provider) => provider.id === model.icon);

    return (
      <div
        className={cn(
          'flex w-full cursor-pointer items-center justify-between px-3 py-2 hover:bg-accent/50',
          isSelected && 'bg-accent'
        )}
        key={model.id}
        onClick={() => handleModelToggle(model.id, isLocked)}
      >
        <div className="flex items-center gap-3">
          <Checkbox
            checked={isSelected}
            disabled={isLocked || (!isSelected && isAtLimit)}
            onChange={() => handleModelToggle(model.id, isLocked)}
            onClick={(e) => e.stopPropagation()}
          />
          {provider?.icon && <provider.icon className="size-5" />}
          <div className="flex flex-col gap-0">
            <span className="text-sm">{model.name}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLocked && (
            <div className="flex items-center gap-0.5 rounded-full border border-input bg-accent px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
              <StarIcon className="size-2" />
              <span>Locked</span>
            </div>
          )}
          {!isSelected && isAtLimit && !isLocked && (
            <div className="flex items-center gap-0.5 rounded-full border border-input bg-muted px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
              <span>Limit</span>
            </div>
          )}
        </div>
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

  if (isLoadingModels) {
    return null;
  }

  const trigger = (
    <Button
      className={cn(
        'min-w-[200px] justify-between rounded-full dark:bg-secondary',
        className
      )}
      disabled={isLoadingModels}
      variant="outline"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <AnimatePresence mode="popLayout">
          {selectedModels.length === 0 ? (
            <motion.span
              animate={{ opacity: 1, y: 0 }}
              className="text-muted-foreground"
              exit={{ opacity: 0, y: -10 }}
              initial={{ opacity: 0, y: 10 }}
              key="placeholder"
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              Select models
            </motion.span>
          ) : selectedModels.length === 1 ? (
            <motion.div
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-2"
              exit={{ opacity: 0, x: 10 }}
              initial={{ opacity: 0, x: -10 }}
              key="single-model"
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              {(() => {
                const provider = PROVIDERS.find(
                  (p) => p.id === selectedModels[0].icon
                );
                return provider?.icon ? (
                  <motion.div
                    animate={{ scale: 1, rotate: 0 }}
                    exit={{ scale: 0, rotate: 180 }}
                    initial={{ scale: 0, rotate: -180 }}
                    transition={{
                      type: 'spring',
                      stiffness: 300,
                      damping: 20,
                    }}
                  >
                    <provider.icon className="size-5 flex-shrink-0" />
                  </motion.div>
                ) : null;
              })()}
              <motion.span
                animate={{ opacity: 1 }}
                className="truncate"
                initial={{ opacity: 0 }}
                transition={{ delay: 0.2 }}
              >
                {selectedModels[0].name}
              </motion.span>
            </motion.div>
          ) : (
            <motion.div
              animate={{ opacity: 1, scale: 1 }}
              className="flex min-w-0 flex-1 items-center gap-1"
              exit={{ opacity: 0, scale: 1.1 }}
              initial={{ opacity: 0, scale: 0.9 }}
              key="multiple-models"
              transition={{ duration: 0.15, ease: 'easeOut' }}
            >
              <div className="-space-x-1 flex flex-shrink-0">
                <AnimatePresence mode="popLayout">
                  {selectedModels.slice(0, 3).map((model, index) => {
                    const provider = PROVIDERS.find((p) => p.id === model.icon);
                    return provider?.icon ? (
                      <motion.div
                        animate={{
                          scale: 1,
                          rotate: 0,
                          x: 0,
                          opacity: 1,
                        }}
                        className="flex size-5 items-center justify-center rounded-full border border-border bg-background"
                        exit={{
                          scale: 0,
                          rotate: 180,
                          x: 20,
                          opacity: 0,
                        }}
                        initial={{
                          scale: 0,
                          rotate: -180,
                          x: -20,
                          opacity: 0,
                        }}
                        key={`${model.id}`}
                        layout="position"
                        layoutId={`${model.id}`}
                        style={{ zIndex: 3 - index }}
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 25,
                          delay: index * 0.05,
                        }}
                      >
                        <provider.icon className="size-3" />
                      </motion.div>
                    ) : null;
                  })}
                </AnimatePresence>
              </div>
              <span className="font-medium text-sm">
                <AnimatePresence mode="wait">
                  <motion.span
                    animate={{ opacity: 1, y: 0 }}
                    className="inline-block"
                    exit={{ opacity: 0, y: -8 }}
                    initial={{ opacity: 0, y: 8 }}
                    key={selectedModels.length}
                    transition={{
                      duration: 0.15,
                      ease: 'easeOut',
                    }}
                  >
                    {selectedModels.length}
                  </motion.span>
                </AnimatePresence>{' '}
                model{selectedModels.length > 1 ? 's' : ''} selected
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <CaretDownIcon className="ml-2 size-4 flex-shrink-0 opacity-50" />
    </Button>
  );

  // Handle input change without losing focus
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSearchQuery(e.target.value);
  };

  // If user is not authenticated, show the auth popover
  if (!isUserAuthenticated) {
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
                <span>Select models</span>
                <CaretDownIcon className="size-4" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Select models</TooltipContent>
        </Tooltip>
        <PopoverContentAuth />
      </Popover>
    );
  }

  if (isMobile) {
    return (
      <div>
        <ProModelDialog
          currentModel={selectedProModel || ''}
          isOpen={isProDialogOpen}
          setIsOpen={setIsProDialogOpen}
        />
        <Drawer onOpenChange={setIsDrawerOpen} open={isDrawerOpen}>
          <DrawerTrigger asChild>{trigger}</DrawerTrigger>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>
                Select Models ({selectedModelIds.length}/{maxModels})
              </DrawerTitle>
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
      </div>
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
              if (selectedModelIds.length > 0) {
                setHoveredModel(selectedModelIds[0]);
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
          <TooltipContent>
            Select models ⌘⇧M ({selectedModelIds.length}/{maxModels})
          </TooltipContent>
          <DropdownMenuContent
            align="start"
            className="flex h-[320px] w-[300px] flex-col space-y-0.5 overflow-visible p-0"
            forceMount
            side="top"
            sideOffset={4}
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
                  const isSelected = selectedModelIds.includes(model.id);
                  const provider = PROVIDERS.find(
                    (provider) => provider.id === model.icon
                  );

                  return (
                    <DropdownMenuItem
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-2',
                        isSelected && 'bg-accent'
                      )}
                      key={model.id}
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
                      onSelect={(e) => {
                        e.preventDefault();
                        handleModelToggle(model.id, isLocked);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        {provider?.icon && <provider.icon className="size-5" />}
                        <div className="flex flex-col gap-0">
                          <span className="text-sm">{model.name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isSelected && <CheckIcon className="size-4" />}
                        {isLocked && (
                          <div className="flex items-center gap-0.5 rounded-full border border-input bg-accent px-1.5 py-0.5 font-medium text-[10px] text-muted-foreground">
                            <span>Locked</span>
                          </div>
                        )}
                      </div>
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
