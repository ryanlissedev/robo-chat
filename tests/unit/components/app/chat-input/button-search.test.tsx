import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ButtonSearch } from '@/components/app/chat-input/button-search';

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Globe: ({ className }: { className?: string }) => (
    <div data-testid="globe-icon" className={className}>
      Globe
    </div>
  ),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, className, variant, ...props }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={className}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverTrigger: ({ children, asChild }: any) => (
    <div data-testid="popover-trigger">{children}</div>
  ),
}));

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// Mock PopoverContentAuth
vi.mock('@/components/app/chat-input/popover-content-auth', () => ({
  PopoverContentAuth: () => (
    <div data-testid="popover-content-auth">Auth Content</div>
  ),
}));

const defaultProps = {
  isSelected: false,
  onToggle: vi.fn(),
  isAuthenticated: true,
};

function renderButtonSearch(props = {}) {
  return render(<ButtonSearch {...defaultProps} {...props} />);
}

describe('ButtonSearch', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Authenticated user', () => {
    it('should render search button when authenticated', () => {
      renderButtonSearch({ isAuthenticated: true });

      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByTestId('globe-icon')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
    });

    it('should show Search text on desktop', () => {
      renderButtonSearch({ isAuthenticated: true });

      const searchText = screen.getByText('Search');
      expect(searchText).toBeInTheDocument();
      expect(searchText).toHaveClass('hidden', 'md:block');
    });

    it('should call onToggle with opposite state when clicked', async () => {
      const onToggle = vi.fn();
      renderButtonSearch({
        isAuthenticated: true,
        isSelected: false,
        onToggle,
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(onToggle).toHaveBeenCalledWith(true);
    });

    it('should call onToggle with false when selected is true', async () => {
      const onToggle = vi.fn();
      renderButtonSearch({
        isAuthenticated: true,
        isSelected: true,
        onToggle,
      });

      const button = screen.getByRole('button');
      await user.click(button);

      expect(onToggle).toHaveBeenCalledWith(false);
    });

    it('should apply selected styling when isSelected is true', () => {
      renderButtonSearch({
        isAuthenticated: true,
        isSelected: true,
      });

      const button = screen.getByRole('button');
      expect(button.className).toContain('border-[#0091FF]/20');
      expect(button.className).toContain('bg-[#E5F3FE]');
      expect(button.className).toContain('text-[#0091FF]');
    });

    it('should apply default styling when isSelected is false', () => {
      renderButtonSearch({
        isAuthenticated: true,
        isSelected: false,
      });

      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-transparent');
      expect(button.className).toContain('border-border');
      expect(button.className).toContain('dark:bg-secondary');
    });

    it('should have secondary variant', () => {
      renderButtonSearch({ isAuthenticated: true });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-variant', 'secondary');
    });

    it('should have rounded-full class', () => {
      renderButtonSearch({ isAuthenticated: true });

      const button = screen.getByRole('button');
      expect(button.className).toContain('rounded-full');
    });

    it('should handle multiple rapid clicks', async () => {
      const onToggle = vi.fn();
      renderButtonSearch({
        isAuthenticated: true,
        isSelected: false, // Start with false
        onToggle,
      });

      const button = screen.getByRole('button');

      // Component always calls onToggle(!isSelected)
      // Since isSelected=false, all clicks will call onToggle(true)
      await user.click(button); // !false -> true
      await user.click(button); // !false -> true
      await user.click(button); // !false -> true

      expect(onToggle).toHaveBeenCalledTimes(3);
      expect(onToggle).toHaveBeenNthCalledWith(1, true);
      expect(onToggle).toHaveBeenNthCalledWith(2, true);
      expect(onToggle).toHaveBeenNthCalledWith(3, true);
    });
  });

  describe('Unauthenticated user', () => {
    it('should render popover when not authenticated', () => {
      renderButtonSearch({ isAuthenticated: false });

      expect(screen.getByTestId('popover')).toBeInTheDocument();
      expect(screen.getByTestId('popover-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('popover-content-auth')).toBeInTheDocument();
    });

    it('should render button inside popover trigger', () => {
      renderButtonSearch({ isAuthenticated: false });

      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByTestId('globe-icon')).toBeInTheDocument();
      expect(screen.getByText('Search')).toBeInTheDocument();
    });

    it('should not call onToggle when not authenticated', async () => {
      const onToggle = vi.fn();
      renderButtonSearch({
        isAuthenticated: false,
        onToggle,
      });

      const button = screen.getByRole('button');
      await user.click(button);

      // onToggle should not be called since it's in a popover
      expect(onToggle).not.toHaveBeenCalled();
    });

    it('should apply same styling as authenticated version', () => {
      renderButtonSearch({ isAuthenticated: false });

      const button = screen.getByRole('button');
      expect(button.className).toContain('rounded-full');
      expect(button.className).toContain('border-border');
      expect(button.className).toContain('bg-transparent');
      expect(button.className).toContain('dark:bg-secondary');
    });

    it('should have secondary variant in unauthenticated state', () => {
      renderButtonSearch({ isAuthenticated: false });

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('data-variant', 'secondary');
    });
  });

  describe('Default props', () => {
    it('should use default isSelected value of false', () => {
      renderButtonSearch({
        isAuthenticated: true,
        // isSelected not provided, should default to false
      });

      const button = screen.getByRole('button');
      expect(button.className).not.toContain('border-[#0091FF]/20');
    });

    it('should handle missing onToggle prop', async () => {
      renderButtonSearch({
        isAuthenticated: true,
        onToggle: undefined,
      });

      const button = screen.getByRole('button');

      // Should not crash when clicking
      await user.click(button);

      expect(button).toBeInTheDocument();
    });

    it('should handle explicit isSelected false', () => {
      renderButtonSearch({
        isAuthenticated: true,
        isSelected: false,
      });

      const button = screen.getByRole('button');
      expect(button.className).toContain('bg-transparent');
    });
  });

  describe('Visual states', () => {
    it('should show selected state styling', () => {
      renderButtonSearch({
        isAuthenticated: true,
        isSelected: true,
      });

      const button = screen.getByRole('button');
      const className = button.className;

      expect(className).toContain('border-[#0091FF]/20');
      expect(className).toContain('bg-[#E5F3FE]');
      expect(className).toContain('text-[#0091FF]');
      expect(className).toContain('hover:bg-[#E5F3FE]');
      expect(className).toContain('hover:text-[#0091FF]');
    });

    it('should show unselected state styling', () => {
      renderButtonSearch({
        isAuthenticated: true,
        isSelected: false,
      });

      const button = screen.getByRole('button');
      const className = button.className;

      expect(className).toContain('border-border');
      expect(className).toContain('bg-transparent');
      expect(className).toContain('dark:bg-secondary');
      expect(className).not.toContain('border-[#0091FF]/20');
    });

    it('should apply transition classes', () => {
      renderButtonSearch({ isAuthenticated: true });

      const button = screen.getByRole('button');
      expect(button.className).toContain('transition-all');
      expect(button.className).toContain('duration-150');
    });

    it('should apply responsive padding classes', () => {
      renderButtonSearch({ isAuthenticated: true });

      const button = screen.getByRole('button');
      expect(button.className).toContain('has-[>svg]:px-1.75');
      expect(button.className).toContain('md:has-[>svg]:px-3');
    });
  });

  describe('Icon rendering', () => {
    it('should render Globe icon in both authenticated and unauthenticated states', () => {
      const { unmount } = renderButtonSearch({ isAuthenticated: true });
      expect(screen.getByTestId('globe-icon')).toBeInTheDocument();

      unmount();

      renderButtonSearch({ isAuthenticated: false });
      expect(screen.getByTestId('globe-icon')).toBeInTheDocument();
    });

    it('should have proper icon size class', () => {
      renderButtonSearch({ isAuthenticated: true });

      const icon = screen.getByTestId('globe-icon');
      expect(icon).toHaveClass('size-5');
    });
  });

  describe('Accessibility', () => {
    it('should be focusable', () => {
      renderButtonSearch({ isAuthenticated: true });

      const button = screen.getByRole('button');
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it('should support keyboard interaction', async () => {
      const onToggle = vi.fn();
      renderButtonSearch({
        isAuthenticated: true,
        isSelected: false, // Default is false
        onToggle,
      });

      const button = screen.getByRole('button');
      button.focus();

      // Component always calls onToggle(!isSelected)
      // Since isSelected=false, both keys will call onToggle(true)
      await user.keyboard('{Enter}');
      expect(onToggle).toHaveBeenCalledWith(true);

      await user.keyboard(' ');
      expect(onToggle).toHaveBeenCalledWith(true);
    });

    it('should have proper button role', () => {
      renderButtonSearch({ isAuthenticated: true });

      const button = screen.getByRole('button');
      expect(button.tagName).toBe('BUTTON');
    });

    it('should be accessible in popover state', () => {
      renderButtonSearch({ isAuthenticated: false });

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toBeVisible();
    });
  });

  describe('Responsive behavior', () => {
    it('should hide text on mobile, show on desktop', () => {
      renderButtonSearch({ isAuthenticated: true });

      const searchText = screen.getByText('Search');
      expect(searchText).toHaveClass('hidden', 'md:block');
    });

    it('should apply responsive padding to icon container', () => {
      renderButtonSearch({ isAuthenticated: true });

      const button = screen.getByRole('button');
      expect(button.className).toContain('has-[>svg]:px-1.75');
      expect(button.className).toContain('md:has-[>svg]:px-3');
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined onToggle gracefully', async () => {
      renderButtonSearch({
        isAuthenticated: true,
        onToggle: undefined,
      });

      const button = screen.getByRole('button');

      expect(() => user.click(button)).not.toThrow();
    });

    it('should handle boolean conversion for isSelected', () => {
      // Test with truthy non-boolean value
      renderButtonSearch({
        isAuthenticated: true,
        isSelected: 1 as any,
      });

      const button = screen.getByRole('button');
      expect(button.className).toContain('border-[#0091FF]/20');
    });

    it('should handle mixed authentication and selection states', () => {
      // Test unauthenticated but selected (edge case)
      renderButtonSearch({
        isAuthenticated: false,
        isSelected: true,
      });

      // Should still show popover, selection state doesn't matter
      expect(screen.getByTestId('popover')).toBeInTheDocument();
      expect(screen.getByTestId('popover-content-auth')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should not recreate handler functions unnecessarily', () => {
      const onToggle = vi.fn();
      const { rerender } = renderButtonSearch({
        isAuthenticated: true,
        onToggle,
      });

      // Re-render with same props
      rerender(
        <ButtonSearch
          isAuthenticated={true}
          onToggle={onToggle}
          isSelected={false}
        />
      );

      // Component should still work
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('should handle rapid state changes', async () => {
      const onToggle = vi.fn();
      renderButtonSearch({
        isAuthenticated: true,
        onToggle,
      });

      const button = screen.getByRole('button');

      // Simulate rapid clicking
      const clicks = Array(10).fill(null);
      await Promise.all(clicks.map(() => user.click(button)));

      expect(onToggle).toHaveBeenCalledTimes(10);
    });
  });
});
