'use client';

import { ChevronDown, Search, Star } from 'lucide-react';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { useBreakpoint } from '@/app/hooks/use-breakpoint';
import { useKeyShortcut } from '@/app/hooks/use-key-shortcut';
import { Badge } from '@/components/ui/badge';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useModel } from '@/lib/model-store/provider';
import { filterAndSortModels } from '@/lib/model-store/utils';
import type { ModelConfig } from '@/lib/models/types';
import { PROVIDERS } from '@/lib/providers';
import {
  getMemoryCredential,
  getSessionCredential,
} from '@/lib/security/web-crypto';
import { useUserPreferences } from '@/lib/user-preference-store/provider';
import { cn } from '@/lib/utils';
import { ProModelDialog } from './pro-dialog';
import { SubMenu } from './sub-menu';

// Constants
const MOBILE_BREAKPOINT = 768;

// Types
type CredentialInfo = {
  envAvailable?: boolean;
  guestByokAvailable?: boolean;
  userByokAvailable?: boolean;
};

type ModelWithCred = ModelConfig & { credentialInfo?: CredentialInfo };

type ModelSelectorProps = {
  selectedModelId: string;
  setSelectedModelId: (modelId: string) => void;
  className?: string;
};

// Provider name mapping
const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  mistral: 'Mistral',
  perplexity: 'Perplexity',
  xai: 'xAI',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
};

// Helper function to check guest credentials
async function checkGuestCredentials(providerId: string): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    // Check memory credential
    if (getMemoryCredential(providerId)) {
      return true;
    }

    // Check session credential
    if (await getSessionCredential(providerId)) {
      return true;
    }

    // Check persistent credential (requires passphrase, so we check localStorage directly)
    const persistentKey = localStorage.getItem(`guestByok:persistent:${providerId}`);
    if (persistentKey) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

// Accessible, hook-safe item component
function ModelItem({
  model,
  selectedModelId,
  setSelectedModelId,
  isMobile,
  setIsDrawerOpen,
  setIsProDialogOpen,
  setSelectedProModel,
  onSelected,
}: {
  model: ModelWithCred;
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  isMobile: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  setIsProDialogOpen: (open: boolean) => void;
  setSelectedProModel: (id: string) => void;
  onSelected?: () => void;
}) {
  const isLocked = !model.accessible;
  const providerMeta = PROVIDERS.find((p) => p.id === model.icon);
  const providerId = model.baseProviderId || model.providerId || model.icon || 'unknown';
  const providerName =
    PROVIDER_NAMES[providerId as keyof typeof PROVIDER_NAMES] || providerId;

  // Check if guest has credentials stored
  const [hasGuestCredentials, setHasGuestCredentials] = useState(false);

  useEffect(() => {
    checkGuestCredentials(providerId).then(setHasGuestCredentials);
  }, [providerId]);

  const cred = model.credentialInfo;

  const getCredentialStatus = () => {
    if (cred?.envAvailable) {
      return {
        label: 'Environment',
        variant: 'secondary' as const,
        className:
          'text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
      };
    }
    if (cred?.userByokAvailable) {
      return {
        label: 'User Provided',
        variant: 'secondary' as const,
        className:
          'text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      };
    }
    if (hasGuestCredentials) {
      return {
        label: 'Guest BYOK',
        variant: 'secondary' as const,
        className:
          'text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      };
    }
    return {
      label: 'Required',
      variant: 'destructive' as const,
      className:
        'text-red-600 dark:text-red-400 border-red-200 dark:border-red-800',
    };
  };

  const credentialStatus = getCredentialStatus();
  const needsCredentials = !cred?.envAvailable && !cred?.userByokAvailable && !hasGuestCredentials;

  const handleActivate = () => {
    if (isLocked) {
      setSelectedProModel(model.id);
      setIsProDialogOpen(true);
      return;
    }
    if (needsCredentials) {
      const event = new CustomEvent('guest-byok:open', {
        detail: { providerId },
      });
      window.dispatchEvent(event);
      return;
    }
    setSelectedModelId(model.id);
    if (isMobile) {
      setIsDrawerOpen(false);
    }
    if (onSelected) {
      onSelected();
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleActivate();
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={`Select model ${model.name}`}
          className={cn(
            'flex w-full cursor-pointer items-center justify-between px-3 py-2 transition-colors hover:bg-accent/50',
            selectedModelId === model.id && 'bg-accent',
            needsCredentials && 'opacity-75'
          )}
          key={model.id}
          onClick={handleActivate}
          onKeyDown={onKeyDown}
          role="button"
          type="button"
        >
          <div className="flex items-center gap-3">
            {providerMeta?.icon && <providerMeta.icon className="size-5" />}
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{model.name}</span>
                <Badge variant="outline" className="h-auto px-1.5 py-0.5 text-[10px]">
                  {providerName}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isLocked ? (
              <Badge
                variant="secondary"
                className="flex items-center gap-1 h-auto px-1.5 py-0.5 text-[10px]"
              >
                <Star className="size-2" />
                <span>Locked</span>
              </Badge>
            ) : (
              <Badge
                variant={credentialStatus.variant}
                className={cn(
                  'h-auto px-1.5 py-0.5 text-[10px]',
                  credentialStatus.className
                )}
              >
                {credentialStatus.label}
              </Badge>
            )}
          </div>
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[200px]">
        {needsCredentials ? (
          <div className="text-sm">
            <p className="font-medium">API Key Required</p>
            <p className="mt-1 text-muted-foreground">
              Add your {providerName} API key in settings to use this model.
            </p>
          </div>
        ) : (
          <div className="text-sm">
            <p className="font-medium">{model.name}</p>
            <p className="mt-1 text-muted-foreground">
              Credentials: {credentialStatus.label}
            </p>
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function ModelSelector({
  selectedModelId,
  setSelectedModelId,
  className,
}: ModelSelectorProps) {
  const { models, isLoading: isLoadingModels, favoriteModels } = useModel();
  const { isModelHidden } = useUserPreferences();

  const currentModel = models.find((model) => model.id === selectedModelId);
  const currentProvider = PROVIDERS.find(
    (p) => p.id === currentModel?.icon
  );
  const isMobile = useBreakpoint(MOBILE_BREAKPOINT);

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
      data-testid="model-selector-trigger"
      disabled={isLoadingModels}
      variant="outline"
    >
      <div className="flex items-center gap-2">
        {currentProvider?.icon && <currentProvider.icon className="size-5" />}
        <span data-testid="selected-model-name">
          {currentModel?.name || 'Select model'}
        </span>
      </div>
      <ChevronDown className="size-4 opacity-50" />
    </Button>
  );

  // Handle input change without losing focus
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    setSearchQuery(e.target.value);
  };

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
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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
                  <p className="mb-2 text-sm text-muted-foreground">
                    Loading models...
                  </p>
                </div>
              ) : filteredModels.length > 0 ? (
                filteredModels.map((model) => (
                  <ModelItem
                    key={model.id}
                    isMobile={true}
                    model={model as ModelWithCred}
                    selectedModelId={selectedModelId}
                    setIsDrawerOpen={setIsDrawerOpen}
                    setIsProDialogOpen={setIsProDialogOpen}
                    setSelectedModelId={setSelectedModelId}
                    setSelectedProModel={(id) => setSelectedProModel(id)}
                  />
                ))
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <p className="mb-2 text-sm text-muted-foreground">
                    No results found.
                  </p>
                  <a
                    className="text-sm text-muted-foreground underline"
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
            data-testid="model-selector-content"
            forceMount
            side="top"
            sideOffset={4}
          >
            <div className="sticky top-0 z-10 rounded-t-md border-b bg-background px-0 pt-0 pb-0">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
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
                  <p className="mb-2 text-sm text-muted-foreground">
                    Loading models...
                  </p>
                </div>
              ) : filteredModels.length > 0 ? (
                filteredModels.map((model) => (
                  <ModelItem
                    key={model.id}
                    isMobile={false}
                    model={model as ModelWithCred}
                    selectedModelId={selectedModelId}
                    setIsDrawerOpen={setIsDrawerOpen}
                    setIsProDialogOpen={setIsProDialogOpen}
                    setSelectedModelId={setSelectedModelId}
                    setSelectedProModel={(id) => setSelectedProModel(id)}
                  />
                ))
              ) : (
                <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                  <p className="mb-1 text-sm text-muted-foreground">
                    No results found.
                  </p>
                  <a
                    className="text-sm text-muted-foreground underline"
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
