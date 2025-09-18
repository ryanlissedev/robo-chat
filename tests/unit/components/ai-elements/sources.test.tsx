import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Sources } from '@/components/ai-elements/sources';

// Mock the UI components using London School approach
const mockDialog = vi.fn();
const mockDialogTrigger = vi.fn();
const mockDialogContent = vi.fn();
const mockDialogHeader = vi.fn();
const mockDialogTitle = vi.fn();

const mockDrawer = vi.fn();
const mockDrawerTrigger = vi.fn();
const mockDrawerContent = vi.fn();
const mockDrawerHeader = vi.fn();
const mockDrawerTitle = vi.fn();

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, ...props }: any) => {
    mockDialog(props);
    return <div data-testid="dialog" {...props}>{children}</div>;
  },
  DialogTrigger: ({ children, asChild, ...props }: any) => {
    mockDialogTrigger({ asChild, ...props });
    return <div data-testid="dialog-trigger" {...props}>{children}</div>;
  },
  DialogContent: ({ children, ...props }: any) => {
    mockDialogContent(props);
    return <div data-testid="dialog-content" {...props}>{children}</div>;
  },
  DialogHeader: ({ children, ...props }: any) => {
    mockDialogHeader(props);
    return <div data-testid="dialog-header" {...props}>{children}</div>;
  },
  DialogTitle: ({ children, ...props }: any) => {
    mockDialogTitle({ children, ...props });
    return <div data-testid="dialog-title" {...props}>{children}</div>;
  },
}));

vi.mock('@/components/ui/drawer', () => ({
  Drawer: ({ children, ...props }: any) => {
    mockDrawer(props);
    return <div data-testid="drawer" {...props}>{children}</div>;
  },
  DrawerTrigger: ({ children, asChild, ...props }: any) => {
    mockDrawerTrigger({ asChild, ...props });
    return <div data-testid="drawer-trigger" {...props}>{children}</div>;
  },
  DrawerContent: ({ children, ...props }: any) => {
    mockDrawerContent(props);
    return <div data-testid="drawer-content" {...props}>{children}</div>;
  },
  DrawerHeader: ({ children, ...props }: any) => {
    mockDrawerHeader(props);
    return <div data-testid="drawer-header" {...props}>{children}</div>;
  },
  DrawerTitle: ({ children, ...props }: any) => {
    mockDrawerTitle({ children, ...props });
    return <div data-testid="drawer-title" {...props}>{children}</div>;
  },
}));

// Mock the FaviconGroup component
const mockFaviconGroup = vi.fn();
vi.mock('@/components/ui/favicon-group', () => ({
  FaviconGroup: ({ sources, maxVisible, ...props }: any) => {
    mockFaviconGroup({ sources, maxVisible, ...props });
    return (
      <div data-testid="favicon-group" data-max-visible={maxVisible}>
        {sources?.slice(0, maxVisible || 3).map((source: any, index: number) => (
          <div key={index} data-testid={`favicon-${index}`} data-url={source.url}>
            {source.title}
          </div>
        ))}
        {sources?.length > (maxVisible || 3) && (
          <div data-testid="favicon-overflow">+{sources.length - (maxVisible || 3)}</div>
        )}
      </div>
    );
  },
}));

// Mock the SourceCard component
const mockSourceCard = vi.fn();
vi.mock('@/components/ai-elements/source-card', () => ({
  SourceCard: ({ source, index, ...props }: any) => {
    mockSourceCard({ source, index, ...props });
    return (
      <div data-testid={`source-card-${index}`} data-url={source.url} {...props}>
        <div data-testid={`source-title-${index}`}>{source.title}</div>
        <div data-testid={`source-domain-${index}`}>{source.domain}</div>
      </div>
    );
  },
}));

// Mock media query hook
const mockUseMediaQuery = vi.fn();
vi.mock('@/lib/hooks/use-media-query', () => ({
  useMediaQuery: (query: string) => mockUseMediaQuery(query),
}));

// Test data
const mockSources = [
  {
    id: '1',
    url: 'https://example.com/article1',
    title: 'Example Article 1',
    domain: 'example.com',
    favicon: 'https://example.com/favicon.ico',
  },
  {
    id: '2',
    url: 'https://test.com/article2',
    title: 'Test Article 2',
    domain: 'test.com',
    favicon: 'https://test.com/favicon.ico',
  },
  {
    id: '3',
    url: 'https://demo.com/article3',
    title: 'Demo Article 3',
    domain: 'demo.com',
    favicon: 'https://demo.com/favicon.ico',
  },
  {
    id: '4',
    url: 'https://sample.com/article4',
    title: 'Sample Article 4',
    domain: 'sample.com',
    favicon: 'https://sample.com/favicon.ico',
  },
];

describe('Sources Component (London School TDD)', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup({ delay: null });
    mockUseMediaQuery.mockReturnValue(false); // Default to desktop
  });

  describe('Contract: Sources Button Display', () => {
    it('should render sources button with favicon group and count', () => {
      render(<Sources sources={mockSources} />);

      // Verify the trigger button exists
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent(`${mockSources.length} sources`);

      // Verify FaviconGroup contract is called correctly
      expect(mockFaviconGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          sources: mockSources,
          maxVisible: 3,
        })
      );

      // Verify favicon group is rendered
      expect(screen.getByTestId('favicon-group')).toBeInTheDocument();
    });

    it('should display correct count for various source quantities', () => {
      const singleSource = [mockSources[0]];
      const { rerender } = render(<Sources sources={singleSource} />);

      expect(screen.getByRole('button')).toHaveTextContent('1 source');

      rerender(<Sources sources={mockSources} />);
      expect(screen.getByRole('button')).toHaveTextContent('4 sources');
    });

    it('should handle empty sources gracefully', () => {
      render(<Sources sources={[]} />);

      expect(screen.getByRole('button')).toHaveTextContent('0 sources');
      expect(mockFaviconGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          sources: [],
          maxVisible: 3,
        })
      );
    });
  });

  describe('Contract: Responsive Modal/Drawer Behavior', () => {
    it('should use Dialog on desktop (non-mobile)', () => {
      mockUseMediaQuery.mockReturnValue(false); // Desktop
      render(<Sources sources={mockSources} />);

      // Verify Dialog components are used
      expect(mockDialog).toHaveBeenCalled();
      expect(mockDialogTrigger).toHaveBeenCalled();

      // Verify Drawer components are NOT used
      expect(mockDrawer).not.toHaveBeenCalled();
      expect(mockDrawerTrigger).not.toHaveBeenCalled();

      // Verify UI elements exist
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByTestId('dialog-trigger')).toBeInTheDocument();
    });

    it('should use Drawer on mobile', () => {
      mockUseMediaQuery.mockReturnValue(true); // Mobile
      render(<Sources sources={mockSources} />);

      // Verify Drawer components are used
      expect(mockDrawer).toHaveBeenCalled();
      expect(mockDrawerTrigger).toHaveBeenCalled();

      // Verify Dialog components are NOT used
      expect(mockDialog).not.toHaveBeenCalled();
      expect(mockDialogTrigger).not.toHaveBeenCalled();

      // Verify UI elements exist
      expect(screen.getByTestId('drawer')).toBeInTheDocument();
      expect(screen.getByTestId('drawer-trigger')).toBeInTheDocument();
    });

    it('should pass correct media query to useMediaQuery hook', () => {
      render(<Sources sources={mockSources} />);

      expect(mockUseMediaQuery).toHaveBeenCalledWith('(max-width: 768px)');
    });
  });

  describe('Contract: Source Cards Display', () => {
    it('should render SourceCard for each source with correct props', async () => {
      mockUseMediaQuery.mockReturnValue(false); // Desktop
      render(<Sources sources={mockSources} />);

      // Open the dialog
      const trigger = screen.getByTestId('dialog-trigger');
      await user.click(trigger);

      // Verify each SourceCard is called with correct contract
      mockSources.forEach((source, index) => {
        expect(mockSourceCard).toHaveBeenCalledWith(
          expect.objectContaining({
            source,
            index,
          })
        );
      });

      // Verify source cards are rendered in content
      mockSources.forEach((_, index) => {
        expect(screen.getByTestId(`source-card-${index}`)).toBeInTheDocument();
      });
    });

    it('should display modal title correctly for desktop', async () => {
      mockUseMediaQuery.mockReturnValue(false);
      render(<Sources sources={mockSources} />);

      await user.click(screen.getByTestId('dialog-trigger'));

      expect(mockDialogTitle).toHaveBeenCalledWith(
        expect.objectContaining({
          children: 'Sources',
        })
      );
    });

    it('should display drawer title correctly for mobile', async () => {
      mockUseMediaQuery.mockReturnValue(true);
      render(<Sources sources={mockSources} />);

      await user.click(screen.getByTestId('drawer-trigger'));

      expect(mockDrawerTitle).toHaveBeenCalledWith(
        expect.objectContaining({
          children: 'Sources',
        })
      );
    });
  });

  describe('Contract: Favicon Group Limits', () => {
    it('should show maximum 3 favicons with overflow indicator', () => {
      render(<Sources sources={mockSources} />);

      // Verify FaviconGroup receives correct maxVisible
      expect(mockFaviconGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          maxVisible: 3,
        })
      );

      // Verify first 3 favicons are shown
      expect(screen.getByTestId('favicon-0')).toBeInTheDocument();
      expect(screen.getByTestId('favicon-1')).toBeInTheDocument();
      expect(screen.getByTestId('favicon-2')).toBeInTheDocument();

      // Verify overflow indicator for 4th item
      expect(screen.getByTestId('favicon-overflow')).toHaveTextContent('+1');
    });

    it('should not show overflow indicator when sources <= maxVisible', () => {
      const threeSources = mockSources.slice(0, 3);
      render(<Sources sources={threeSources} />);

      expect(screen.queryByTestId('favicon-overflow')).not.toBeInTheDocument();
    });

    it('should handle edge case with exactly maxVisible sources', () => {
      const exactlythreeSources = mockSources.slice(0, 3);
      render(<Sources sources={exactlythreeSources} />);

      expect(mockFaviconGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          sources: exactlythreeSources,
          maxVisible: 3,
        })
      );

      expect(screen.queryByTestId('favicon-overflow')).not.toBeInTheDocument();
    });
  });

  describe('Contract: Interaction Behaviors', () => {
    it('should coordinate Dialog state management correctly', async () => {
      mockUseMediaQuery.mockReturnValue(false);
      render(<Sources sources={mockSources} />);

      // Verify Dialog receives proper open state props
      expect(mockDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          open: false,
          onOpenChange: expect.any(Function),
        })
      );

      // Verify DialogTrigger uses asChild prop correctly
      expect(mockDialogTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          asChild: true,
        })
      );
    });

    it('should coordinate Drawer state management correctly', async () => {
      mockUseMediaQuery.mockReturnValue(true);
      render(<Sources sources={mockSources} />);

      // Verify Drawer receives proper open state props
      expect(mockDrawer).toHaveBeenCalledWith(
        expect.objectContaining({
          open: false,
          onOpenChange: expect.any(Function),
        })
      );

      // Verify DrawerTrigger uses asChild prop correctly
      expect(mockDrawerTrigger).toHaveBeenCalledWith(
        expect.objectContaining({
          asChild: true,
        })
      );
    });
  });

  describe('Contract: Accessibility and Button Behavior', () => {
    it('should provide proper button attributes', () => {
      render(<Sources sources={mockSources} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAccessibleName();
    });

    it('should handle keyboard interactions properly', async () => {
      render(<Sources sources={mockSources} />);

      const button = screen.getByRole('button');
      button.focus();
      expect(button).toHaveFocus();

      await user.keyboard('{Enter}');
      // Verify interaction (state change would be tested in integration)
    });
  });

  describe('Contract: Error Handling and Edge Cases', () => {
    it('should handle undefined sources gracefully', () => {
      expect(() => render(<Sources sources={undefined as any} />)).not.toThrow();
    });

    it('should handle sources with missing properties', () => {
      const incompleteSource = [{ id: '1', url: 'https://test.com' }] as any;

      expect(() => render(<Sources sources={incompleteSource} />)).not.toThrow();

      expect(mockFaviconGroup).toHaveBeenCalledWith(
        expect.objectContaining({
          sources: incompleteSource,
        })
      );
    });

    it('should maintain consistent state across responsive changes', () => {
      mockUseMediaQuery.mockReturnValue(false);
      const { rerender } = render(<Sources sources={mockSources} />);

      // Switch to mobile
      mockUseMediaQuery.mockReturnValue(true);
      rerender(<Sources sources={mockSources} />);

      // Verify both components maintain independent state
      expect(mockDialog).toHaveBeenCalled();
      expect(mockDrawer).toHaveBeenCalled();
    });
  });

  describe('Contract: Component Integration', () => {
    it('should coordinate all child components correctly', () => {
      render(<Sources sources={mockSources} />);

      // Verify all expected contracts are established
      expect(mockFaviconGroup).toHaveBeenCalledOnce();
      expect(mockUseMediaQuery).toHaveBeenCalledOnce();

      // Verify UI structure
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByTestId('favicon-group')).toBeInTheDocument();
    });

    it('should pass through custom props correctly', () => {
      const customProps = {
        className: 'custom-sources',
        'data-testid': 'custom-sources',
      };

      render(<Sources sources={mockSources} {...customProps} />);

      // Verify custom props are applied
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-sources');
      expect(button).toHaveAttribute('data-testid', 'custom-sources');
    });
  });
});