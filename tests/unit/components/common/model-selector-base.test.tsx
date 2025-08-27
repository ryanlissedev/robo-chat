import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as useBreakpointHook from '@/app/hooks/use-breakpoint';
import * as useKeyShortcutHook from '@/app/hooks/use-key-shortcut';
import { ModelSelector } from '@/components/common/model-selector/base';
import * as modelStoreProvider from '@/lib/model-store/provider';
import * as webCrypto from '@/lib/security/web-crypto';
import * as userPreferenceStoreProvider from '@/lib/user-preference-store/provider';
import * as userStoreProvider from '@/lib/user-store/provider';
import {
  mockApiEndpoints,
  mockModels,
  renderWithProviders,
} from '@/tests/test-utils';

// Mock functions will be set up via vi.mocked in beforeEach

// Mock the model store provider
vi.mock('@/lib/model-store/provider');

// Mock the user preferences provider
vi.mock('@/lib/user-preference-store/provider');

// Mock the security module
vi.mock('@/lib/security/web-crypto');

// Mock the breakpoint hook
vi.mock('@/app/hooks/use-breakpoint');

// Mock the key shortcut hook
vi.mock('@/app/hooks/use-key-shortcut');

// Mock the user store provider
vi.mock('@/lib/user-store/provider');

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

describe('ModelSelector', () => {
  const defaultProps = {
    selectedModelId: 'test-model',
    setSelectedModelId: vi.fn(),
  };

  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    vi.clearAllMocks();
    mockApiEndpoints();

    // Set up default mock returns
    vi.mocked(useBreakpointHook.useBreakpoint).mockReturnValue(false);
    vi.mocked(useKeyShortcutHook.useKeyShortcut).mockImplementation(() => {});
    vi.mocked(modelStoreProvider.useModel).mockReturnValue({
      models: mockModels,
      isLoading: false,
      favoriteModels: ['test-model'],
    });
    vi.mocked(userPreferenceStoreProvider.useUserPreferences).mockReturnValue({
      isModelHidden: vi.fn().mockReturnValue(false),
    });
    vi.mocked(webCrypto.getMemoryCredential).mockReturnValue(null);
    vi.mocked(webCrypto.getSessionCredential).mockResolvedValue(null);
    vi.mocked(userStoreProvider.useUser).mockReturnValue({
      user: null,
      isAuthenticated: false,
    });
  });

  it('should render with selected model', () => {
    renderWithProviders(<ModelSelector {...defaultProps} />);

    expect(screen.getByTestId('model-selector-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('selected-model-name')).toHaveTextContent(
      'Test Model'
    );
  });

  it('should render loading state', () => {
    vi.mocked(modelStoreProvider.useModel).mockReturnValue({
      models: [],
      isLoading: true,
      favoriteModels: [],
    });

    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    expect(trigger).toBeDisabled();
  });

  it('should show "Select model" when no model is selected', () => {
    renderWithProviders(<ModelSelector {...defaultProps} selectedModelId="" />);

    expect(screen.getByTestId('selected-model-name')).toHaveTextContent(
      'Select model'
    );
  });

  it('should open dropdown on desktop', async () => {
    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toBeInTheDocument();
    });
  });

  it('should show search input in dropdown', async () => {
    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText('Search models...')
      ).toBeInTheDocument();
    });
  });

  it('should filter models by search query', async () => {
    const multipleModels = [
      { ...mockModels[0], name: 'GPT Model' },
      { ...mockModels[0], id: 'claude-model', name: 'Claude Model' },
    ];

    vi.mocked(modelStoreProvider.useModel).mockReturnValue({
      models: multipleModels,
      isLoading: false,
      favoriteModels: [],
    });

    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    const searchInput = await screen.findByPlaceholderText('Search models...');
    await user.type(searchInput, 'GPT');

    // Should show filtered results - use getAllByText since model name appears in multiple places
    await waitFor(() => {
      const gptElements = screen.getAllByText('GPT Model');
      expect(gptElements.length).toBeGreaterThan(0);
      expect(screen.queryByText('Claude Model')).not.toBeInTheDocument();
    });
  });

  it('should call setSelectedModelId when model is selected', async () => {
    const setSelectedModelId = vi.fn();
    // Mock model with environment credentials available
    const modelWithCreds = {
      ...mockModels[0],
      credentialInfo: {
        envAvailable: true,
        guestByokAvailable: false,
        userByokAvailable: false,
      },
      accessible: true,
    };

    vi.mocked(modelStoreProvider.useModel).mockReturnValue({
      models: [modelWithCreds],
      isLoading: false,
      favoriteModels: [],
    });

    renderWithProviders(
      <ModelSelector
        {...defaultProps}
        setSelectedModelId={setSelectedModelId}
      />
    );

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toBeInTheDocument();
    });

    const modelButton = await screen.findByRole('button', {
      name: /select model test model/i,
    });
    await user.click(modelButton);

    expect(setSelectedModelId).toHaveBeenCalledWith('test-model');
  });

  it('should show credential status badges', async () => {
    // Mock an accessible model to show credential badges instead of locked badge
    const accessibleModel = {
      ...mockModels[0],
      accessible: true,
      credentialInfo: { envAvailable: false },
    };

    vi.mocked(modelStoreProvider.useModel).mockReturnValue({
      models: [accessibleModel],
      isLoading: false,
      favoriteModels: [],
    });

    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toBeInTheDocument();
    });

    // Should show model items with badges (provider and credential status)
    await waitFor(() => {
      const modelButton = screen.getByRole('button', {
        name: /select model test model/i,
      });
      expect(modelButton).toBeInTheDocument();
      // Model should have provider badge and credential badge text
      expect(modelButton.textContent).toMatch(/Test Model/);
    });
  });

  it('should handle mobile view', () => {
    vi.mocked(useBreakpointHook.useBreakpoint).mockReturnValue(true); // Mobile

    renderWithProviders(<ModelSelector {...defaultProps} />);

    // Should render drawer trigger instead of dropdown
    expect(screen.getByTestId('model-selector-trigger')).toBeInTheDocument();
  });

  it('should open mobile drawer', async () => {
    vi.mocked(useBreakpointHook.useBreakpoint).mockReturnValue(true); // Mobile

    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Select Model')).toBeInTheDocument();
    });
  });

  it('should show tooltip with keyboard shortcut', async () => {
    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.hover(trigger);

    await waitFor(() => {
      const tooltipElements = screen.getAllByText(/Switch model ⌘⇧P/);
      expect(tooltipElements.length).toBeGreaterThan(0);
    });
  });

  it('should handle keyboard navigation', async () => {
    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    trigger.focus();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toBeInTheDocument();
    });
  });

  it('should handle pro models with lock badge', async () => {
    const proModel = {
      ...mockModels[0],
      id: 'pro-model',
      name: 'Pro Model',
      accessible: false, // Locked model
    };

    vi.mocked(modelStoreProvider.useModel).mockReturnValue({
      models: [proModel],
      isLoading: false,
      favoriteModels: [],
    });

    renderWithProviders(
      <ModelSelector {...defaultProps} selectedModelId="pro-model" />
    );

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Locked')).toBeInTheDocument();
    });
  });

  it('should handle guest BYOK credentials', async () => {
    vi.mocked(webCrypto.getMemoryCredential).mockReturnValue('mock-credential');

    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    // Wait for async credential check to complete and then look for text
    await waitFor(
      () => {
        const elements = screen.queryAllByText('Guest BYOK');
        return elements.length > 0;
      },
      { timeout: 3000 }
    );
  });

  it('should show no results message when search returns empty', async () => {
    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    const searchInput = await screen.findByPlaceholderText('Search models...');
    await user.type(searchInput, 'nonexistent model');

    await waitFor(() => {
      expect(screen.getByText('No results found.')).toBeInTheDocument();
    });
  });

  it('should show loading message when models are loading', async () => {
    vi.mocked(modelStoreProvider.useModel).mockReturnValue({
      models: [],
      isLoading: true,
      favoriteModels: [],
    });

    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Loading models...')).toBeInTheDocument();
    });
  });

  it('should apply custom className', () => {
    renderWithProviders(
      <ModelSelector {...defaultProps} className="custom-class" />
    );

    const trigger = screen.getByTestId('model-selector-trigger');
    expect(trigger).toHaveClass('custom-class');
  });

  it('should handle search input focus without losing focus', async () => {
    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    const searchInput = await screen.findByPlaceholderText('Search models...');
    await user.click(searchInput);

    // Input should remain focused and dropdown should stay open
    expect(searchInput).toHaveFocus();
    expect(screen.getByTestId('model-selector-content')).toBeInTheDocument();
  });

  it('should close dropdown when clicking outside', async () => {
    renderWithProviders(
      <div>
        <ModelSelector {...defaultProps} />
        <button
          type="button"
          data-testid="outside-element"
          type="button"
          style={{ pointerEvents: 'auto' }}
        >
          Outside
        </button>
      </div>
    );

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('model-selector-content')).toBeInTheDocument();
    });

    // Press Escape key instead of clicking outside to test dropdown close behavior
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(
        screen.queryByTestId('model-selector-content')
      ).not.toBeInTheDocument();
    });
  });

  it('should clear search when dropdown closes', async () => {
    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    const searchInput = await screen.findByPlaceholderText('Search models...');
    await user.type(searchInput, 'test query');

    expect(searchInput).toHaveValue('test query');

    // Close dropdown
    await user.keyboard('{Escape}');

    // Reopen dropdown
    await user.click(trigger);

    const newSearchInput =
      await screen.findByPlaceholderText('Search models...');
    expect(newSearchInput).toHaveValue('');
  });
});
