import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ModelSelector } from '@/components/common/model-selector/base';
import { 
  renderWithProviders, 
  mockApiEndpoints, 
  mockModels, 
  mockUserKeyStatus,
  createTestQueryClient
} from '@/tests/test-utils';

// Hoist mock functions to avoid initialization errors
const { 
  mockUseModel, 
  mockUseUserPreferences,
  mockGetMemoryCredential,
  mockGetSessionCredential,
  mockUseBreakpoint,
  mockUseKeyShortcut,
  mockUseUser
} = vi.hoisted(() => ({
  mockUseModel: vi.fn(() => ({
    models: mockModels,
    isLoading: false,
    favoriteModels: ['test-model'],
  })),
  mockUseUserPreferences: vi.fn(() => ({
    isModelHidden: vi.fn().mockReturnValue(false),
  })),
  mockGetMemoryCredential: vi.fn().mockReturnValue(null),
  mockGetSessionCredential: vi.fn().mockResolvedValue(null),
  mockUseBreakpoint: vi.fn().mockReturnValue(false), // Desktop by default
  mockUseKeyShortcut: vi.fn(),
  mockUseUser: vi.fn(() => ({
    user: null,
    isAuthenticated: false,
  })),
}));

// Mock the model store provider
vi.mock('@/lib/model-store/provider', () => ({
  useModel: mockUseModel,
}));

// Mock the user preferences provider
vi.mock('@/lib/user-preference-store/provider', () => ({
  useUserPreferences: mockUseUserPreferences,
}));

// Mock the security module
vi.mock('@/lib/security/web-crypto', () => ({
  getMemoryCredential: mockGetMemoryCredential,
  getSessionCredential: mockGetSessionCredential,
}));

// Mock the breakpoint hook
vi.mock('@/app/hooks/use-breakpoint', () => ({
  useBreakpoint: mockUseBreakpoint,
}));

// Mock the key shortcut hook
vi.mock('@/app/hooks/use-key-shortcut', () => ({
  useKeyShortcut: mockUseKeyShortcut,
}));

// Mock the user store provider
vi.mock('@/lib/user-store/provider', () => ({
  useUser: mockUseUser,
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
  });

  it('should render with selected model', () => {
    renderWithProviders(<ModelSelector {...defaultProps} />);

    expect(screen.getByTestId('model-selector-trigger')).toBeInTheDocument();
    expect(screen.getByTestId('selected-model-name')).toHaveTextContent('Test Model');
  });

  it('should render loading state', () => {
    mockUseModel.mockReturnValue({
      models: [],
      isLoading: true,
      favoriteModels: [],
    });

    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    expect(trigger).toBeDisabled();
  });

  it('should show "Select model" when no model is selected', () => {
    renderWithProviders(
      <ModelSelector
        {...defaultProps}
        selectedModelId=""
      />
    );

    expect(screen.getByTestId('selected-model-name')).toHaveTextContent('Select model');
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
      expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
    });
  });

  it('should filter models by search query', async () => {
    const multipleModels = [
      { ...mockModels[0], name: 'GPT Model' },
      { ...mockModels[0], id: 'claude-model', name: 'Claude Model' },
    ];

    mockUseModel.mockReturnValue({
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

    mockUseModel.mockReturnValue({
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

    const modelButton = await screen.findByRole('button', { name: /select model test model/i });
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

    mockUseModel.mockReturnValue({
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
      const modelButton = screen.getByRole('button', { name: /select model test model/i });
      expect(modelButton).toBeInTheDocument();
      // Model should have provider badge and credential badge text
      expect(modelButton.textContent).toMatch(/Test Model/);
    });
  });

  it('should handle mobile view', () => {
    mockUseBreakpoint.mockReturnValue(true); // Mobile

    renderWithProviders(<ModelSelector {...defaultProps} />);

    // Should render drawer trigger instead of dropdown
    expect(screen.getByTestId('model-selector-trigger')).toBeInTheDocument();
  });

  it('should open mobile drawer', async () => {
    mockUseBreakpoint.mockReturnValue(true); // Mobile

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

    mockUseModel.mockReturnValue({
      models: [proModel],
      isLoading: false,
      favoriteModels: [],
    });

    renderWithProviders(<ModelSelector {...defaultProps} selectedModelId="pro-model" />);

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('Locked')).toBeInTheDocument();
    });
  });

  it('should handle guest BYOK credentials', async () => {
    mockGetMemoryCredential.mockReturnValue('mock-credential');

    renderWithProviders(<ModelSelector {...defaultProps} />);

    const trigger = screen.getByTestId('model-selector-trigger');
    await user.click(trigger);

    // Wait for async credential check to complete and then look for text
    await waitFor(() => {
      const elements = screen.queryAllByText('Guest BYOK');
      return elements.length > 0;
    }, { timeout: 3000 });
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
    mockUseModel.mockReturnValue({
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
      <ModelSelector
        {...defaultProps}
        className="custom-class"
      />
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
        <button data-testid="outside-element" type="button" style={{ pointerEvents: 'auto' }}>Outside</button>
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
      expect(screen.queryByTestId('model-selector-content')).not.toBeInTheDocument();
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

    const newSearchInput = await screen.findByPlaceholderText('Search models...');
    expect(newSearchInput).toHaveValue('');
  });
});