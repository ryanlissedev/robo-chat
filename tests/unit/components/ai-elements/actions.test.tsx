/**
 * Comprehensive unit tests for Actions components
 * Ensuring 100% test coverage for production validation
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Copy, Heart, Share } from 'lucide-react';
import { Actions, Action } from '@/components/ai-elements/actions';

describe('Actions Components', () => {
  describe('Actions Container', () => {
    it('should render with default props', () => {
      const { container } = render(
        <Actions>
          <Action>Test Action</Action>
        </Actions>
      );

      const actionsDiv = container.firstChild as HTMLElement;
      expect(actionsDiv).toHaveClass('flex', 'items-center', 'gap-1');
    });

    it('should apply custom className', () => {
      const { container } = render(
        <Actions className="custom-actions">
          <Action>Test Action</Action>
        </Actions>
      );

      const actionsDiv = container.firstChild as HTMLElement;
      expect(actionsDiv).toHaveClass('custom-actions');
      expect(actionsDiv).toHaveClass('flex', 'items-center', 'gap-1');
    });

    it('should pass through additional props', () => {
      const { container } = render(
        <Actions data-testid="actions-container" role="toolbar">
          <Action>Test Action</Action>
        </Actions>
      );

      const actionsDiv = container.firstChild as HTMLElement;
      expect(actionsDiv).toHaveAttribute('data-testid', 'actions-container');
      expect(actionsDiv).toHaveAttribute('role', 'toolbar');
    });

    it('should render multiple action children', () => {
      render(
        <Actions>
          <Action tooltip="Copy">
            <Copy className="size-4" />
          </Action>
          <Action tooltip="Like">
            <Heart className="size-4" />
          </Action>
          <Action tooltip="Share">
            <Share className="size-4" />
          </Action>
        </Actions>
      );

      expect(screen.getAllByRole('button')).toHaveLength(3);
    });

    it('should handle empty children', () => {
      const { container } = render(<Actions />);

      const actionsDiv = container.firstChild as HTMLElement;
      expect(actionsDiv).toBeInTheDocument();
      expect(actionsDiv.children).toHaveLength(0);
    });

    it('should handle id prop', () => {
      const { container } = render(
        <Actions id="my-actions">
          <Action>Test</Action>
        </Actions>
      );

      const actionsDiv = container.firstChild as HTMLElement;
      expect(actionsDiv).toHaveAttribute('id', 'my-actions');
    });
  });

  describe('Action Component', () => {
    it('should render basic action button', () => {
      render(<Action>Click me</Action>);

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Click me');
      expect(button).toHaveClass(
        'size-9',
        'p-1.5',
        'text-muted-foreground',
        'hover:text-foreground'
      );
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should render with tooltip', async () => {
      const user = userEvent.setup();
      render(
        <Action tooltip="Copy to clipboard">
          <Copy className="size-4" />
        </Action>
      );

      const button = screen.getByRole('button');
      
      // Hover to show tooltip
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('Copy to clipboard')).toBeInTheDocument();
      });
    });

    it('should render with accessibility label', () => {
      render(
        <Action label="Copy action">
          <Copy className="size-4" />
        </Action>
      );

      expect(screen.getByText('Copy action', { selector: '.sr-only' })).toBeInTheDocument();
    });

    it('should prioritize tooltip over label for screen reader', () => {
      render(
        <Action tooltip="Copy tooltip" label="Copy label">
          <Copy className="size-4" />
        </Action>
      );

      expect(screen.getByText('Copy tooltip', { selector: '.sr-only' })).toBeInTheDocument();
      expect(screen.queryByText('Copy label', { selector: '.sr-only' })).not.toBeInTheDocument();
    });

    it('should handle click events', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(
        <Action onClick={handleClick}>
          <Copy className="size-4" />
        </Action>
      );

      const button = screen.getByRole('button');
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should apply custom variant and size', () => {
      render(
        <Action variant="destructive" size="lg">
          Delete
        </Action>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('size-9'); // Default size class still applied from className
    });

    it('should apply custom className', () => {
      render(
        <Action className="custom-action-class">
          Custom Action
        </Action>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-action-class');
    });

    it('should be disabled when disabled prop is true', () => {
      render(<Action disabled>Disabled Action</Action>);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should handle different button variants', () => {
      const variants = ['default', 'destructive', 'outline', 'secondary', 'ghost', 'link'] as const;

      variants.forEach(variant => {
        const { unmount } = render(
          <Action variant={variant} data-testid={`button-${variant}`}>
            {variant}
          </Action>
        );

        const button = screen.getByTestId(`button-${variant}`);
        expect(button).toBeInTheDocument();
        unmount();
      });
    });

    it('should handle different button sizes', () => {
      const sizes = ['default', 'sm', 'lg', 'icon'] as const;

      sizes.forEach(size => {
        const { unmount } = render(
          <Action size={size} data-testid={`button-${size}`}>
            {size}
          </Action>
        );

        const button = screen.getByTestId(`button-${size}`);
        expect(button).toBeInTheDocument();
        unmount();
      });
    });

    it('should handle onMouseEnter and onMouseLeave', async () => {
      const handleMouseEnter = vi.fn();
      const handleMouseLeave = vi.fn();
      const user = userEvent.setup();

      render(
        <Action onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          Hover me
        </Action>
      );

      const button = screen.getByRole('button');
      await user.hover(button);
      expect(handleMouseEnter).toHaveBeenCalledTimes(1);

      await user.unhover(button);
      expect(handleMouseLeave).toHaveBeenCalledTimes(1);
    });

    it('should handle keyboard navigation', async () => {
      const handleClick = vi.fn();
      const user = userEvent.setup();

      render(<Action onClick={handleClick}>Press Enter</Action>);

      const button = screen.getByRole('button');
      button.focus();
      
      await user.keyboard('{Enter}');
      expect(handleClick).toHaveBeenCalledTimes(1);

      await user.keyboard(' ');
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('should handle tooltip with complex content', async () => {
      const user = userEvent.setup();
      
      render(
        <Action tooltip="This is a very long tooltip with detailed explanation">
          <Copy className="size-4" />
        </Action>
      );

      const button = screen.getByRole('button');
      await user.hover(button);

      await waitFor(() => {
        expect(screen.getByText('This is a very long tooltip with detailed explanation')).toBeInTheDocument();
      });
    });

    it('should handle action without tooltip or label', () => {
      render(
        <Action>
          <Copy className="size-4" />
        </Action>
      );

      const screenReaderText = screen.getByText('', { selector: '.sr-only' });
      expect(screenReaderText).toBeInTheDocument();
      expect(screenReaderText).toHaveTextContent('');
    });

    it('should pass through additional button props', () => {
      render(
        <Action
          data-testid="custom-action"
          id="action-1"
          title="Custom title"
          tabIndex={-1}
        >
          Custom Action
        </Action>
      );

      const button = screen.getByTestId('custom-action');
      expect(button).toHaveAttribute('id', 'action-1');
      expect(button).toHaveAttribute('title', 'Custom title');
      expect(button).toHaveAttribute('tabindex', '-1');
    });

    it('should handle form-related props', () => {
      render(
        <Action form="my-form" formMethod="post" name="action-button" value="submit">
          Submit
        </Action>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('form', 'my-form');
      expect(button).toHaveAttribute('formmethod', 'post');
      expect(button).toHaveAttribute('name', 'action-button');
      expect(button).toHaveAttribute('value', 'submit');
    });

    it('should render icon children properly', () => {
      render(
        <Action tooltip="Copy">
          <Copy className="size-4" data-testid="copy-icon" />
        </Action>
      );

      expect(screen.getByTestId('copy-icon')).toBeInTheDocument();
      expect(screen.getByTestId('copy-icon')).toHaveClass('size-4');
    });

    it('should handle multiple children', () => {
      render(
        <Action>
          <Copy className="size-4" />
          <span>Copy</span>
        </Action>
      );

      const button = screen.getByRole('button');
      expect(button).toContainElement(screen.getByText('Copy'));
      expect(button.querySelector('svg')).toBeInTheDocument();
    });

    it('should handle ref forwarding', () => {
      const ref = vi.fn();
      
      render(
        <Action ref={ref}>
          Test Action
        </Action>
      );

      expect(ref).toHaveBeenCalled();
    });
  });

  describe('Integration Scenarios', () => {
    it('should work with complex action combinations', async () => {
      const handleCopy = vi.fn();
      const handleLike = vi.fn();
      const handleShare = vi.fn();
      const user = userEvent.setup();

      render(
        <Actions className="message-actions">
          <Action tooltip="Copy message" onClick={handleCopy}>
            <Copy className="size-4" />
          </Action>
          <Action tooltip="Like message" onClick={handleLike}>
            <Heart className="size-4" />
          </Action>
          <Action tooltip="Share message" onClick={handleShare} disabled>
            <Share className="size-4" />
          </Action>
        </Actions>
      );

      const [copyButton, likeButton, shareButton] = screen.getAllByRole('button');

      await user.click(copyButton);
      expect(handleCopy).toHaveBeenCalledTimes(1);

      await user.click(likeButton);
      expect(handleLike).toHaveBeenCalledTimes(1);

      await user.click(shareButton);
      expect(handleShare).not.toHaveBeenCalled(); // Should not be called because disabled

      expect(shareButton).toBeDisabled();
    });

    it('should handle nested Actions components', () => {
      render(
        <Actions>
          <Action>Action 1</Action>
          <Actions className="nested-actions">
            <Action>Nested Action 1</Action>
            <Action>Nested Action 2</Action>
          </Actions>
          <Action>Action 2</Action>
        </Actions>
      );

      expect(screen.getAllByRole('button')).toHaveLength(4);
      expect(screen.getByText('Action 1')).toBeInTheDocument();
      expect(screen.getByText('Nested Action 1')).toBeInTheDocument();
    });

    it('should handle tooltip interactions with multiple actions', async () => {
      const user = userEvent.setup();

      render(
        <Actions>
          <Action tooltip="First tooltip">Action 1</Action>
          <Action tooltip="Second tooltip">Action 2</Action>
        </Actions>
      );

      const [button1, button2] = screen.getAllByRole('button');

      // Hover first button
      await user.hover(button1);
      await waitFor(() => {
        expect(screen.getByText('First tooltip')).toBeInTheDocument();
      });

      // Move to second button
      await user.hover(button2);
      await waitFor(() => {
        expect(screen.getByText('Second tooltip')).toBeInTheDocument();
      });
    });

    it('should maintain focus management', async () => {
      const user = userEvent.setup();

      render(
        <Actions>
          <Action>First</Action>
          <Action>Second</Action>
          <Action>Third</Action>
        </Actions>
      );

      const [first, second, third] = screen.getAllByRole('button');

      // Tab navigation
      first.focus();
      expect(first).toHaveFocus();

      await user.tab();
      expect(second).toHaveFocus();

      await user.tab();
      expect(third).toHaveFocus();
    });
  });
});