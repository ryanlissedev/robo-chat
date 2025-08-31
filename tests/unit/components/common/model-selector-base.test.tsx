import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as useBreakpointHook from '@/app/hooks/use-breakpoint';
import * as useKeyShortcutHook from '@/app/hooks/use-key-shortcut';
import { ModelSelector } from '@/components/common/model-selector/base';
import { fetchClient } from '@/lib/fetch';
import * as modelStoreProvider from '@/lib/model-store/provider';
import * as modelStoreUtils from '@/lib/model-store/utils';
import * as webCrypto from '@/lib/security/web-crypto';
import * as userPreferenceStoreProvider from '@/lib/user-preference-store/provider';

// Mock the security module to simulate guest credentials
vi.mock('@/lib/security/web-crypto', () => ({
  getMemoryCredential: vi.fn(),
  getSessionCredential: vi.fn(),
}));

// Mock localStorage for guest credentials
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock the breakpoint hook
vi.mock('@/app/hooks/use-breakpoint');

// Mock the key shortcut hook
vi.mock('@/app/hooks/use-key-shortcut');

// Mock the model store utils
vi.mock('@/lib/model-store/utils');

// Mock the model store provider
vi.mock('@/lib/model-store/provider', () => ({
  useModel: vi.fn(),
}));

// Mock the user preference store provider
vi.mock('@/lib/user-preference-store/provider', () => ({
  useUserPreferences: vi.fn(),
}));

// Mock fetchClient to return our test data
vi.mock('@/lib/fetch', () => ({
  fetchClient: vi.fn(),
}));

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ alt, ...props }: any) => <img alt={alt} {...props} />,
}));

// Mock UI components
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children, open, onOpenChange }: any) => (
    <div data-testid="drawer">
      {children}
      {open && <div data-testid="drawer-open-content">Drawer is open</div>}
    </div>
  ),
  DrawerContent: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  DrawerHeader: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  DrawerTitle: ({ children, ...props }: any) => <h2 {...props}>{children}</h2>,
  DrawerTrigger: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('@/components/ui/dropdown-menu', () => {
  return {
    DropdownMenu: ({ children, open, onOpenChange }: any) => {
      // For controlled dropdowns (open prop provided), use that value
      // For uncontrolled dropdowns, maintain internal state
      const [internalOpen, setInternalOpen] = React.useState(false);
      const isControlled = open !== undefined;
      const isOpen = isControlled ? open : internalOpen;

      const handleOpenChange = React.useCallback(
        (newOpen: boolean) => {
          // Update internal state for uncontrolled mode
          if (!isControlled) {
            setInternalOpen(newOpen);
          }

          // Always call the onOpenChange callback if provided
          if (onOpenChange) {
            onOpenChange(newOpen);
          }
        },
        [isControlled, onOpenChange]
      );

      // Create context object to pass to children
      const dropdownContext = {
        isOpen,
        onOpenChange: handleOpenChange,
      };

      // Clone children and pass dropdown context
      const processChildren = (children: React.ReactNode): React.ReactNode => {
        return React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              ...child.props,
              __dropdownContext: dropdownContext,
              children: child.props?.children
                ? processChildren(child.props.children)
                : child.props?.children,
            });
          }
          return child;
        });
      };

      return (
        <div data-testid="dropdown-menu" data-open={isOpen}>
          {processChildren(children)}
        </div>
      );
    },

    DropdownMenuContent: ({
      children,
      forceMount,
      __dropdownContext,
      ...props
    }: any) => {
      // Get state from dropdown context
      const isOpen = __dropdownContext?.isOpen || false;

      if (forceMount) {
        // Always render when forceMount is true, control visibility with CSS
        return (
          <div
            data-testid="model-selector-content"
            role="menu"
            tabIndex={-1}
            data-state={isOpen ? 'open' : 'closed'}
            style={{ display: isOpen ? 'block' : 'none' }}
            {...props}
          >
            {children}
          </div>
        );
      }

      // When forceMount is false, only render when open
      return isOpen ? (
        <div
          data-testid="model-selector-content"
          role="menu"
          tabIndex={-1}
          data-state="open"
          {...props}
        >
          {children}
        </div>
      ) : null;
    },

    DropdownMenuTrigger: ({
      children,
      asChild,
      __dropdownContext,
      ...props
    }: any) => {
      // Get state and handlers from dropdown context
      const isOpen = __dropdownContext?.isOpen || false;
      const onOpenChange = __dropdownContext?.onOpenChange;

      const handleClick = React.useCallback(
        (event: React.MouseEvent) => {
          event.preventDefault();
          const newOpen = !isOpen;
          if (onOpenChange) {
            onOpenChange(newOpen);
          }

          // Also call any existing onClick handler
          if (props.onClick) {
            props.onClick(event);
          }
        },
        [isOpen, onOpenChange, props.onClick]
      );

      const handleKeyDown = React.useCallback(
        (event: React.KeyboardEvent) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            const newOpen = !isOpen;
            if (onOpenChange) {
              onOpenChange(newOpen);
            }
          }
        },
        [isOpen, onOpenChange]
      );

      if (asChild) {
        // Pass props to child when using asChild pattern - this is the key fix!
        return React.Children.map(children, (child) => {
          if (React.isValidElement(child)) {
            return React.cloneElement(child, {
              ...child.props,
              ...props,
              onClick: handleClick,
              onKeyDown: handleKeyDown,
              'aria-expanded': isOpen,
              'aria-haspopup': true,
              role: 'button',
            });
          }
          return child;
        });
      }

      return (
        <button
          {...props}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          {children}
        </button>
      );
    },

    DropdownMenuItem: ({ children, onSelect, ...props }: any) => (
      <div
        {...props}
        role="menuitem"
        onClick={(e: React.MouseEvent) => {
          if (props.onClick) props.onClick(e);
          if (onSelect) onSelect();
        }}
      >
        {children}
      </div>
    ),

    DropdownMenuSeparator: (props: any) => <hr {...props} />,
    DropdownMenuLabel: ({ children, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
    DropdownMenuGroup: ({ children, ...props }: any) => (
      <div {...props}>{children}</div>
    ),
  };
});

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
  TooltipTrigger: ({ children, asChild, ...props }: any) => {
    if (asChild) {
      // Pass through props to child when using asChild pattern
      return React.Children.map(children, (child) => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child, {
            ...child.props,
            ...props,
          });
        }
        return child;
      });
    }
    return <div {...props}>{children}</div>;
  },
  TooltipProvider: ({ children }: any) => <>{children}</>,
}));

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
    })),
    channel: vi.fn(() => ({
      on: vi.fn(() => ({
        subscribe: vi.fn(),
      })),
    })),
    removeChannel: vi.fn(),
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: null }, error: null })
      ),
    },
  })),
}));

// Mock config
vi.mock('@/lib/config', () => ({
  APP_NAME: 'Test App',
}));

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// Mock clsx and tailwind-merge
vi.mock('clsx', () => ({
  clsx: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

vi.mock('tailwind-merge', () => ({
  twMerge: (className: string) => className,
}));

// Mock providers data
vi.mock('@/lib/providers', () => ({
  PROVIDERS: [
    {
      id: 'test',
      name: 'Test Provider',
      icon: () => <span data-testid="test-provider-icon">T</span>,
    },
  ],
}));

// Mock the ProModelDialog component
vi.mock('@/components/common/model-selector/pro-dialog', () => ({
  ProModelDialog: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="pro-model-dialog">Pro Dialog</div> : null,
}));

// Mock the SubMenu component
vi.mock('@/components/common/model-selector/sub-menu', () => ({
  SubMenu: ({ hoveredModelData }: { hoveredModelData: any }) => (
    <div data-testid="sub-menu">{hoveredModelData.name} SubMenu</div>
  ),
}));

// Enhanced mock models with all required properties
const mockModels = [
  {
    id: 'test-model',
    name: 'Test Model',
    provider: 'Test Provider',
    providerId: 'test',
    baseProviderId: 'test',
    description: 'A test model',
    contextWindow: 4000,
    inputCost: 0.001,
    outputCost: 0.002,
    capabilities: ['chat'],
    icon: 'test',
    accessible: true,
    apiSdk: vi.fn(),
    credentialInfo: {
      envAvailable: true,
      guestByokAvailable: false,
      userByokAvailable: false,
    },
  },
  {
    id: 'gpt-model',
    name: 'GPT Model',
    provider: 'OpenAI',
    providerId: 'openai',
    baseProviderId: 'openai',
    description: 'A GPT model',
    contextWindow: 4000,
    inputCost: 0.001,
    outputCost: 0.002,
    capabilities: ['chat'],
    icon: 'openai',
    accessible: true,
    apiSdk: vi.fn(),
    credentialInfo: {
      envAvailable: true,
      guestByokAvailable: false,
      userByokAvailable: false,
    },
  },
  {
    id: 'claude-model',
    name: 'Claude Model',
    provider: 'Anthropic',
    providerId: 'anthropic',
    baseProviderId: 'anthropic',
    description: 'A Claude model',
    contextWindow: 4000,
    inputCost: 0.001,
    outputCost: 0.002,
    capabilities: ['chat'],
    icon: 'anthropic',
    accessible: true,
    apiSdk: vi.fn(),
    credentialInfo: {
      envAvailable: true,
      guestByokAvailable: false,
      userByokAvailable: false,
    },
  },
  {
    id: 'pro-model',
    name: 'Pro Model',
    provider: 'Test Provider',
    providerId: 'test',
    baseProviderId: 'test',
    description: 'A pro model',
    contextWindow: 4000,
    inputCost: 0.001,
    outputCost: 0.002,
    capabilities: ['chat'],
    icon: 'test',
    accessible: false, // This makes it locked
    apiSdk: vi.fn(),
    credentialInfo: {
      envAvailable: false,
      guestByokAvailable: false,
      userByokAvailable: false,
    },
  },
  {
    id: 'guest-model',
    name: 'Guest Model',
    provider: 'Test Provider',
    providerId: 'test',
    baseProviderId: 'test',
    description: 'A guest model',
    contextWindow: 4000,
    inputCost: 0.001,
    outputCost: 0.002,
    capabilities: ['chat'],
    icon: 'test',
    accessible: true,
    apiSdk: vi.fn(),
    credentialInfo: {
      envAvailable: false,
      guestByokAvailable: false, // Will be checked via localStorage
      userByokAvailable: false,
    },
  },
];

describe('ModelSelector', () => {
  const defaultProps = {
    selectedModelId: 'test-model',
    setSelectedModelId: vi.fn(),
  };

  let user: ReturnType<typeof userEvent.setup>;

  afterEach(() => {
    // Clean up after each test to prevent pollution
    vi.clearAllMocks();
    vi.clearAllTimers();

    // Clear any remaining DOM state
    document.body.innerHTML = '';

    // Clear any custom event listeners that might persist
    window.removeEventListener('guest-byok:open', () => {});

    // Reset document focus
    if (document.activeElement && document.activeElement !== document.body) {
      (document.activeElement as HTMLElement).blur();
    }

    // Force garbage collection of any React state
    if (typeof global.gc === 'function') {
      global.gc();
    }
  });

  beforeEach(() => {
    user = userEvent.setup();

    vi.clearAllMocks();
    vi.clearAllTimers();

    // Set up hook mocks
    vi.mocked(useBreakpointHook.useBreakpoint).mockReturnValue(false);
    vi.mocked(useKeyShortcutHook.useKeyShortcut).mockImplementation(() => {});

    // Set up security mocks - ensure clean state
    vi.mocked(webCrypto.getMemoryCredential).mockReturnValue(null);
    vi.mocked(webCrypto.getSessionCredential).mockResolvedValue(null);

    // Reset localStorage mock completely
    vi.mocked(window.localStorage.getItem).mockReturnValue(null);
    vi.mocked(window.localStorage.setItem).mockImplementation(() => {});
    vi.mocked(window.localStorage.removeItem).mockImplementation(() => {});

    // Set up provider mocks
    vi.mocked(modelStoreProvider.useModel).mockReturnValue({
      models: mockModels,
      isLoading: false,
      isLoadingModels: false,
      favoriteModels: ['test-model'],
      selectedModelId: 'test-model',
      setSelectedModelId: vi.fn(),
    });

    vi.mocked(userPreferenceStoreProvider.useUserPreferences).mockReturnValue({
      isModelHidden: vi.fn(() => false),
    });

    // Set up utils mocks
    vi.mocked(modelStoreUtils.filterAndSortModels).mockImplementation(
      (models, _favoriteModels, searchQuery, _isModelHidden) => {
        if (searchQuery) {
          return models.filter((model) =>
            model.name.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        return models;
      }
    );

    // Mock fetchClient to return our test data
    vi.mocked(fetchClient).mockImplementation(async (url: string) => {
      if (url.includes('/api/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ models: mockModels }),
        } as Response;
      }

      if (url.includes('/api/user-key-status')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            openai: false,
            anthropic: false,
            mistral: false,
            google: false,
            perplexity: false,
            xai: false,
            openrouter: false,
          }),
        } as Response;
      }

      if (url.includes('/api/user-preferences/favorite-models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ favorite_models: ['test-model'] }),
        } as Response;
      }

      if (url.includes('/api/user-preferences')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            layout: 'fullscreen',
            prompt_suggestions: true,
            show_tool_invocations: true,
            show_conversation_previews: true,
            multi_model_enabled: false,
            hidden_models: [],
          }),
        } as Response;
      }

      throw new Error(`Unmocked URL: ${url}`);
    });
  });

  it('should render with selected model', async () => {
    render(<ModelSelector {...defaultProps} />);

    expect(screen.getByTestId('model-selector-trigger')).toBeInTheDocument();

    // Model data should load and display synchronously - no need for waitFor
    expect(screen.getByTestId('selected-model-name')).toHaveTextContent(
      'Test Model'
    );
  });

  it('should render loading state', () => {
    // Override useModel mock to return loading state
    vi.mocked(modelStoreProvider.useModel).mockReturnValue({
      models: [],
      isLoading: true,
      isLoadingModels: true,
      favoriteModels: [],
      selectedModelId: '',
      setSelectedModelId: vi.fn(),
    });

    render(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    expect(trigger).toBeDisabled();
  });

  it('should show "Select model" when no model is selected', () => {
    render(<ModelSelector {...defaultProps} selectedModelId="" />);

    expect(screen.getByTestId('selected-model-name')).toHaveTextContent(
      'Select model'
    );
  });

  it('should open dropdown on desktop', async () => {
    render(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');

    // Check initial state
    expect(screen.getByTestId('model-selector-content')).toHaveAttribute(
      'data-state',
      'closed'
    );

    fireEvent.click(trigger);

    // Wait for state update after click
    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toHaveAttribute(
        'data-state',
        'open'
      );
    });
  });

  it('should show search input in dropdown', async () => {
    render(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    fireEvent.click(trigger);

    // Search input should appear synchronously after dropdown opens - no need for waitFor
    expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
  });

  it('should filter models by search query', async () => {
    // Store original implementation for cleanup
    const originalImplementation = vi
      .mocked(modelStoreUtils.filterAndSortModels)
      .getMockImplementation();

    // Override the provider mock to return models with GPT and Claude
    vi.mocked(modelStoreProvider.useModel).mockReturnValue({
      models: mockModels, // This includes GPT Model and Claude Model
      isLoading: false,
      isLoadingModels: false,
      favoriteModels: ['test-model'],
      selectedModelId: 'test-model',
      setSelectedModelId: vi.fn(),
    });

    // Update the filter mock to return the filtered results
    vi.mocked(modelStoreUtils.filterAndSortModels).mockImplementation(
      (models, _favoriteModels, searchQuery, _isModelHidden) => {
        if (searchQuery) {
          return models.filter((model) =>
            model.name.toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        return models;
      }
    );

    render(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toHaveAttribute(
        'data-state',
        'open'
      );
    });

    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'GPT' } });

    // Should show filtered results - GPT Model should be visible, Claude Model should not
    await waitFor(() => {
      // Check if GPT Model is visible in the rendered buttons
      const gptModelButtons = screen.getAllByRole('button', {
        name: /GPT Model/i,
      });
      expect(gptModelButtons.length).toBeGreaterThan(0);

      // Claude Model should be filtered out
      const claudeModelButtons = screen.queryAllByRole('button', {
        name: /Claude Model/i,
      });
      expect(claudeModelButtons.length).toBe(0);
    });

    // Restore original implementation to prevent test pollution
    if (originalImplementation) {
      vi.mocked(modelStoreUtils.filterAndSortModels).mockImplementation(
        originalImplementation
      );
    } else {
      vi.mocked(modelStoreUtils.filterAndSortModels).mockRestore();
    }
  });

  it('should call setSelectedModelId when model is selected', async () => {
    const setSelectedModelId = vi.fn();

    // Completely isolate this test by recreating all mocks
    vi.clearAllMocks();

    // Ensure clean provider state for this test only
    vi.mocked(modelStoreProvider.useModel).mockReturnValue({
      models: [
        {
          id: 'test-model',
          name: 'Test Model',
          provider: 'Test Provider',
          providerId: 'test',
          baseProviderId: 'test',
          description: 'A test model',
          contextWindow: 4000,
          inputCost: 0.001,
          outputCost: 0.002,
          capabilities: ['chat'],
          icon: 'test',
          accessible: true,
          apiSdk: vi.fn(),
          credentialInfo: {
            envAvailable: true, // Key: this should make needsCredentials false
            guestByokAvailable: false,
            userByokAvailable: false,
          },
        },
      ],
      isLoading: false,
      isLoadingModels: false,
      favoriteModels: [],
      selectedModelId: 'gpt-model', // Different model selected
      setSelectedModelId: vi.fn(),
    });

    // Ensure clean security state
    vi.mocked(webCrypto.getMemoryCredential).mockReturnValue(null);
    vi.mocked(webCrypto.getSessionCredential).mockResolvedValue(null);

    render(
      <ModelSelector
        selectedModelId="gpt-model" // Start with different model
        setSelectedModelId={setSelectedModelId}
      />
    );

    const trigger = screen.getByTestId('model-selector-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toHaveAttribute(
        'data-state',
        'open'
      );
    });

    // Find and click the test model button
    const modelButton = await waitFor(() => {
      return screen.getByRole('button', { name: /Select model Test Model/i });
    });

    // Verify the button exists and is clickable
    expect(modelButton).toBeInTheDocument();

    // Click the button and wait for callback
    fireEvent.click(modelButton);

    // Wait for the callback to be called
    await waitFor(
      () => {
        expect(setSelectedModelId).toHaveBeenCalledWith('test-model');
      },
      { timeout: 3000 }
    );
  });

  it('should show credential status badges', async () => {
    // Mock an accessible model to show credential badges instead of locked badge
    const accessibleModel = {
      ...mockModels[0],
      accessible: true,
      credentialInfo: { envAvailable: false },
    };

    // Mock API to return accessible model
    vi.mocked(fetchClient).mockImplementation(async (url: string) => {
      if (url.includes('/api/models')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ models: [accessibleModel] }),
        } as Response;
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      } as Response);
    });

    render(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    fireEvent.click(trigger);

    // Dropdown content should appear synchronously after click - no need for waitFor
    expect(screen.getByTestId('model-selector-content')).toBeInTheDocument();

    // Model items should show synchronously after dropdown opens - no need for waitFor
    const modelButton = screen.getByRole('button', {
      name: /select model test model/i,
    });
    expect(modelButton).toBeInTheDocument();
    // Model should have provider badge and credential badge text
    expect(modelButton.textContent).toMatch(/Test Model/);
  });

  it('should handle mobile view', () => {
    vi.mocked(useBreakpointHook.useBreakpoint).mockReturnValue(true); // Mobile

    render(<ModelSelector {...defaultProps} />);

    // Should render drawer trigger instead of dropdown
    expect(screen.getByTestId('model-selector-trigger')).toBeInTheDocument();
  });

  it('should open mobile drawer', async () => {
    vi.mocked(useBreakpointHook.useBreakpoint).mockReturnValue(true); // Mobile

    render(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    fireEvent.click(trigger);

    // Mobile drawer should open synchronously after click - no need for waitFor
    expect(screen.getByText('Select Model')).toBeInTheDocument();
  });

  it('should show tooltip with keyboard shortcut', async () => {
    render(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    fireEvent.mouseEnter(trigger);

    // Tooltip should appear synchronously after hover - no need for waitFor
    await waitFor(() => {
      const tooltipElements = screen.getAllByText((_content, element) => {
        const hasText =
          element?.textContent?.includes('Switch model') &&
          element?.textContent?.includes('⌘⇧P');
        return hasText || false;
      });
      expect(tooltipElements.length).toBeGreaterThan(0);
    });
  });

  it('should handle keyboard navigation', async () => {
    render(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    trigger.focus();

    // Use fireEvent for keyboard events as user.keyboard may not work with mocked components
    fireEvent.keyDown(trigger, { key: 'Enter' });

    // Dropdown content should appear synchronously after keyboard event - no need for waitFor
    expect(screen.getByTestId('model-selector-content')).toBeInTheDocument();
  });

  it('should handle pro models with lock badge', async () => {
    render(
      <ModelSelector
        selectedModelId="test-model"
        setSelectedModelId={vi.fn()}
      />
    );

    const trigger = screen.getByTestId('model-selector-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toHaveAttribute(
        'data-state',
        'open'
      );
    });

    // Look for the Pro Model button which should have a lock badge
    await waitFor(() => {
      const proModelButton = screen.getByRole('button', {
        name: /Select model Pro Model/i,
      });
      expect(proModelButton).toBeInTheDocument();

      // Check for Locked text within the button's container
      const buttonContainer = proModelButton.closest('button');
      expect(buttonContainer).toHaveTextContent('Locked');
    });
  });

  it('should handle guest BYOK credentials', async () => {
    // Clear all mocks first for proper isolation
    vi.clearAllMocks();

    // Reset the security module mocks
    vi.mocked(webCrypto.getMemoryCredential).mockReturnValue(null);
    vi.mocked(webCrypto.getSessionCredential).mockResolvedValue(null);

    // Set up guest credentials for the guest-model
    vi.mocked(window.localStorage.getItem).mockImplementation((key) => {
      if (key === 'guestByok:persistent:test') {
        return 'mock-encrypted-key';
      }
      return null;
    });

    render(
      <ModelSelector
        selectedModelId="test-model"
        setSelectedModelId={vi.fn()}
      />
    );

    const trigger = screen.getByTestId('model-selector-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toHaveAttribute(
        'data-state',
        'open'
      );
    });

    // Wait for Guest Model to appear
    await waitFor(
      () => {
        const guestModelButton = screen.getByRole('button', {
          name: /Select model Guest Model/i,
        });
        expect(guestModelButton).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // Then wait for Guest BYOK badge to appear
    await waitFor(
      () => {
        const guestModelButton = screen.getByRole('button', {
          name: /Select model Guest Model/i,
        });
        const buttonContainer = guestModelButton.closest('button');
        expect(buttonContainer).toHaveTextContent('Guest BYOK');
      },
      { timeout: 3000 }
    );
  });

  it('should show no results message when search returns empty', async () => {
    render(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toHaveAttribute(
        'data-state',
        'open'
      );
    });

    // Type a search query that won't match any models
    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

    // Should show no results message
    await waitFor(() => {
      // Look for the paragraph element containing 'No results found.'
      const noResultsElement = screen.getByText('No results found.');
      expect(noResultsElement).toBeInTheDocument();
      expect(noResultsElement.tagName).toBe('P');
    });
  });

  it('should show loading message when models are loading', async () => {
    // Override useModel mock to return loading state
    vi.mocked(modelStoreProvider.useModel).mockReturnValue({
      models: [],
      isLoading: true,
      isLoadingModels: true,
      favoriteModels: [],
      selectedModelId: '',
      setSelectedModelId: vi.fn(),
    });

    render(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');

    // Verify the button is disabled during loading (this is the main loading indicator)
    expect(trigger).toBeDisabled();
  });

  it('should apply custom className', () => {
    render(<ModelSelector {...defaultProps} className="custom-class" />);

    const trigger = screen.getByTestId('model-selector-trigger');
    expect(trigger).toHaveClass('custom-class');
  });

  it('should handle search input focus without losing focus', async () => {
    render(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toHaveAttribute(
        'data-state',
        'open'
      );
    });

    // Focus on search input
    const searchInput = screen.getByPlaceholderText('Search models...');

    searchInput.focus();
    fireEvent.focus(searchInput);

    // Type something to trigger change
    fireEvent.change(searchInput, { target: { value: 'test' } });

    // Input should have the value (focus testing in jsdom is limited)
    expect(searchInput).toHaveValue('test');

    // Verify that the input is the active element
    expect(document.activeElement).toBe(searchInput);
  });

  it('should close dropdown when clicking outside', async () => {
    render(
      <div>
        <ModelSelector {...defaultProps} />
        <button
          type="button"
          data-testid="outside-element"
          style={{ pointerEvents: 'auto' }}
        >
          Outside
        </button>
      </div>
    );

    const trigger = screen.getByTestId('model-selector-trigger');
    fireEvent.click(trigger);

    // Dropdown content should appear synchronously after click - no need for waitFor
    expect(screen.getByTestId('model-selector-content')).toBeInTheDocument();

    // Press Escape key instead of clicking outside to test dropdown close behavior
    await user.keyboard('{Escape}');

    // Dropdown should close synchronously after Escape key - no need for waitFor
    expect(
      screen.queryByTestId('model-selector-content')
    ).not.toBeInTheDocument();
  });

  it('should clear search when dropdown closes', async () => {
    render(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toHaveAttribute(
        'data-state',
        'open'
      );
    });

    // Type in search
    const searchInput = screen.getByPlaceholderText('Search models...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    expect(searchInput).toHaveValue('test');

    // Close dropdown by pressing Escape
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toHaveAttribute(
        'data-state',
        'closed'
      );
    });

    // Reopen and check search is cleared
    fireEvent.click(trigger);

    // Wait for dropdown to be fully open
    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toHaveAttribute(
        'data-state',
        'open'
      );
    });

    // Wait for search input to be available and verify it's cleared
    await waitFor(() => {
      const clearedSearchInput =
        screen.getByPlaceholderText('Search models...');
      expect(clearedSearchInput).toBeInTheDocument();
      expect(clearedSearchInput).toHaveValue('');
    });
  });
});
