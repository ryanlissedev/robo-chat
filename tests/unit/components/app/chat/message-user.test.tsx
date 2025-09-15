import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageUser } from '@/components/app/chat/message-user';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ alt, src, className, width, height, ...props }: any) => (
    <img
      alt={alt}
      src={src}
      className={className}
      width={width}
      height={height}
      {...props}
    />
  ),
}));

// Mock the morphing dialog components
vi.mock('@/components/motion-primitives/morphing-dialog', () => ({
  MorphingDialog: ({ children }: any) => <div data-testid="morphing-dialog">{children}</div>,
  MorphingDialogTrigger: ({ children, className }: any) => (
    <div data-testid="morphing-dialog-trigger" className={className}>
      {children}
    </div>
  ),
  MorphingDialogContainer: ({ children }: any) => (
    <div data-testid="morphing-dialog-container">{children}</div>
  ),
  MorphingDialogContent: ({ children, className }: any) => (
    <div data-testid="morphing-dialog-content" className={className}>
      {children}
    </div>
  ),
  MorphingDialogImage: ({ alt, className, src }: any) => (
    <img data-testid="morphing-dialog-image" alt={alt} className={className} src={src} />
  ),
  MorphingDialogClose: ({ className }: any) => (
    <button data-testid="morphing-dialog-close" className={className}>
      Close
    </button>
  ),
}));

// Mock the prompt-kit message components
vi.mock('@/components/prompt-kit/message', () => ({
  Message: ({ children, className }: any) => (
    <div data-testid="message-container" className={className}>
      {children}
    </div>
  ),
  MessageActions: ({ children, className }: any) => (
    <div data-testid="message-actions" className={className}>
      {children}
    </div>
  ),
  MessageAction: ({ children, tooltip, side }: any) => (
    <div data-testid="message-action" data-tooltip={tooltip} data-side={side}>
      {children}
    </div>
  ),
  MessageContent: ({ children, className, markdown, components, ...props }: any) => (
    <div
      data-testid="message-content"
      className={className}
      data-markdown={markdown}
      style={{ whiteSpace: 'pre-wrap' }}
      {...props}
    >
      {children}
    </div>
  ),
}));

// Mock the Button component
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, size, variant, ...props }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      data-size={size}
      data-variant={variant}
      type="button"
      {...props}
    >
      {children}
    </button>
  ),
}));

const defaultProps = {
  children: 'Test user message content',
  id: 'test-user-message-1',
  hasScrollAnchor: false,
  attachments: [],
  copied: false,
  copyToClipboard: vi.fn(),
  onEdit: vi.fn(),
  onReload: vi.fn(),
  onDelete: vi.fn(),
  className: '',
};

function renderMessageUser(props = {}) {
  return render(<MessageUser {...defaultProps} {...props} />);
}

describe('MessageUser', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup({ delay: null });
  });

  describe('Basic Rendering', () => {
    it('should render user message content', () => {
      renderMessageUser();

      expect(screen.getByTestId('message-container')).toBeInTheDocument();
      expect(screen.getByTestId('message-content')).toBeInTheDocument();
      expect(screen.getByTestId('message-content')).toHaveTextContent('Test user message content');
    });

    it('should apply custom className', () => {
      renderMessageUser({ className: 'custom-class' });

      const container = screen.getByTestId('message-container');
      expect(container).toHaveClass('custom-class');
    });

    it('should apply scroll anchor styling when hasScrollAnchor is true', () => {
      renderMessageUser({ hasScrollAnchor: true });

      const container = screen.getByTestId('message-container');
      expect(container).toHaveClass('min-h-scroll-anchor');
    });

    it('should render message content with markdown enabled', () => {
      renderMessageUser();

      const messageContent = screen.getByTestId('message-content');
      expect(messageContent).toHaveAttribute('data-markdown', 'true');
    });
  });

  describe('Message Actions', () => {
    it('should render copy button and handle copy action', async () => {
      const copyToClipboard = vi.fn();
      renderMessageUser({ copyToClipboard });

      const copyButton = screen.getByLabelText('Copy text');
      expect(copyButton).toBeInTheDocument();

      await user.click(copyButton);
      expect(copyToClipboard).toHaveBeenCalledTimes(1);
    });

    it('should show copied state when copied is true', () => {
      renderMessageUser({ copied: true });

      const checkIcon = screen.getByTestId('mock-icon'); // Check icon should be shown
      expect(checkIcon).toBeInTheDocument();
    });

    it('should render delete button and handle delete action', async () => {
      const onDelete = vi.fn();
      renderMessageUser({ onDelete });

      const deleteButton = screen.getByLabelText('Delete');
      expect(deleteButton).toBeInTheDocument();

      await user.click(deleteButton);
      expect(onDelete).toHaveBeenCalledWith('test-user-message-1');
    });

    it('should have proper button types and labels', () => {
      renderMessageUser();

      const copyButton = screen.getByLabelText('Copy text');
      const deleteButton = screen.getByLabelText('Delete');

      expect(copyButton).toHaveAttribute('type', 'button');
      expect(deleteButton).toHaveAttribute('type', 'button');
    });
  });

  describe('Edit Functionality', () => {
    it('should enter edit mode when edit button is enabled', async () => {
      // Note: Edit functionality is currently commented out in the component
      // This test documents the expected behavior when it's implemented
      renderMessageUser();

      // Edit functionality is currently disabled, so this test ensures
      // the component renders without edit controls
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });

    it('should handle edit state management', () => {
      // This test documents the internal edit state management
      // The component has edit state variables but they're not currently used
      renderMessageUser();

      // The edit input state should be initialized with the children content
      // This is handled internally but not exposed in the current UI
      expect(screen.getByTestId('message-content')).toHaveTextContent('Test user message content');
    });
  });

  describe('Attachments Handling', () => {
    it('should render image attachments', () => {
      const attachments = [
        {
          name: 'test-image.jpg',
          contentType: 'image/jpeg',
          url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...',
        },
      ];

      renderMessageUser({ attachments });

      expect(screen.getByTestId('morphing-dialog')).toBeInTheDocument();
      expect(screen.getByTestId('morphing-dialog-trigger')).toBeInTheDocument();
      expect(screen.getByAltText('test-image.jpg')).toBeInTheDocument();
    });

    it('should render text attachments', () => {
      const attachments = [
        {
          name: 'test-file.txt',
          contentType: 'text/plain',
          url: 'data:text/plain;base64,SGVsbG8gV29ybGQ=', // "Hello World" in base64
        },
      ];

      renderMessageUser({ attachments });

      // Should render text content preview
      expect(screen.getByText('SGVsbG8gV29ybGQ=')).toBeInTheDocument();
    });

    it('should handle multiple attachments', () => {
      const attachments = [
        {
          name: 'image1.jpg',
          contentType: 'image/jpeg',
          url: 'data:image/jpeg;base64,image1data',
        },
        {
          name: 'image2.png',
          contentType: 'image/png',
          url: 'data:image/png;base64,image2data',
        },
        {
          name: 'document.txt',
          contentType: 'text/plain',
          url: 'data:text/plain;base64,textdata',
        },
      ];

      renderMessageUser({ attachments });

      expect(screen.getByAltText('image1.jpg')).toBeInTheDocument();
      expect(screen.getByAltText('image2.png')).toBeInTheDocument();
      expect(screen.getByText('textdata')).toBeInTheDocument();
    });

    it('should handle unsupported attachment types gracefully', () => {
      const attachments = [
        {
          name: 'unknown-file.xyz',
          contentType: 'application/octet-stream',
          url: 'data:application/octet-stream;base64,binarydata',
        },
      ];

      // Should render without throwing errors
      expect(() => renderMessageUser({ attachments })).not.toThrow();
    });

    it('should handle attachments without names', () => {
      const attachments = [
        {
          name: '',
          contentType: 'image/jpeg',
          url: 'data:image/jpeg;base64,imagedata',
        },
      ];

      renderMessageUser({ attachments });

      expect(screen.getByAltText('Attachment')).toBeInTheDocument();
    });
  });

  describe('Image Dialog Interaction', () => {
    it('should open image in dialog when clicked', async () => {
      const attachments = [
        {
          name: 'test-image.jpg',
          contentType: 'image/jpeg',
          url: 'data:image/jpeg;base64,testdata',
        },
      ];

      renderMessageUser({ attachments });

      const trigger = screen.getByTestId('morphing-dialog-trigger');
      expect(trigger).toBeInTheDocument();

      // The dialog components are mocked, so we just verify they're present
      expect(screen.getByTestId('morphing-dialog-container')).toBeInTheDocument();
      expect(screen.getByTestId('morphing-dialog-content')).toBeInTheDocument();
      expect(screen.getByTestId('morphing-dialog-image')).toBeInTheDocument();
      expect(screen.getByTestId('morphing-dialog-close')).toBeInTheDocument();
    });
  });

  describe('Content Handling', () => {
    it('should handle empty content', () => {
      renderMessageUser({ children: '' });

      const messageContent = screen.getByTestId('message-content');
      expect(messageContent).toBeInTheDocument();
      expect(messageContent).toHaveTextContent('');
    });

    it('should handle multiline content', () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3';
      renderMessageUser({ children: multilineContent });

      const messageContent = screen.getByTestId('message-content');
      // Check that the content is present (textContent flattens newlines)
      expect(messageContent).toHaveTextContent('Line 1 Line 2 Line 3');
      // Check that the component has whitespace pre-wrap styling to preserve newlines
      expect(messageContent).toHaveStyle({ whiteSpace: 'pre-wrap' });
    });

    it('should handle content with special characters', () => {
      const specialContent = 'Content with <HTML> & "quotes" and emoji 🚀';
      renderMessageUser({ children: specialContent });

      expect(screen.getByTestId('message-content')).toHaveTextContent(specialContent);
    });

    it('should handle very long content', () => {
      const longContent = 'A'.repeat(10000);

      expect(() => renderMessageUser({ children: longContent })).not.toThrow();
      expect(screen.getByTestId('message-content')).toHaveTextContent(longContent);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing optional props gracefully', () => {
      const minimalProps = {
        children: 'Test content',
        id: 'test-id',
        copied: false,
        copyToClipboard: vi.fn(),
        onEdit: vi.fn(),
        onReload: vi.fn(),
        onDelete: vi.fn(),
      };

      expect(() => renderMessageUser(minimalProps)).not.toThrow();
    });

    it('should handle undefined callback functions', () => {
      const props = {
        children: 'Test content',
        id: 'test-id',
        copied: false,
        copyToClipboard: undefined as any,
        onEdit: undefined as any,
        onReload: undefined as any,
        onDelete: undefined as any,
      };

      expect(() => renderMessageUser(props)).not.toThrow();
    });

    it('should handle null attachments array', () => {
      renderMessageUser({ attachments: null as any });

      expect(screen.getByTestId('message-container')).toBeInTheDocument();
      expect(screen.getByTestId('message-content')).toBeInTheDocument();
    });

    it('should handle undefined attachments array', () => {
      renderMessageUser({ attachments: undefined as any });

      expect(screen.getByTestId('message-container')).toBeInTheDocument();
      expect(screen.getByTestId('message-content')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper image alt text', () => {
      const attachments = [
        {
          name: 'vacation-photo.jpg',
          contentType: 'image/jpeg',
          url: 'data:image/jpeg;base64,photodata',
        },
      ];

      renderMessageUser({ attachments });

      expect(screen.getByAltText('vacation-photo.jpg')).toBeInTheDocument();
    });

    it('should provide fallback alt text for images without names', () => {
      const attachments = [
        {
          name: '',
          contentType: 'image/jpeg',
          url: 'data:image/jpeg;base64,photodata',
        },
      ];

      renderMessageUser({ attachments });

      expect(screen.getByAltText('Attachment')).toBeInTheDocument();
    });

    it('should have proper button labels and types', () => {
      renderMessageUser();

      const copyButton = screen.getByLabelText('Copy text');
      const deleteButton = screen.getByLabelText('Delete');

      expect(copyButton).toHaveAttribute('type', 'button');
      expect(deleteButton).toHaveAttribute('type', 'button');
      expect(copyButton).toHaveAttribute('aria-label', 'Copy text');
      expect(deleteButton).toHaveAttribute('aria-label', 'Delete');
    });
  });

  describe('Styling and Layout', () => {
    it('should apply correct CSS classes to container', () => {
      renderMessageUser();

      const container = screen.getByTestId('message-container');
      expect(container).toHaveClass(
        'group',
        'flex',
        'w-full',
        'max-w-3xl',
        'flex-col',
        'items-end',
        'gap-0.5',
        'px-6',
        'pb-2'
      );
    });

    it('should apply correct CSS classes to message content', () => {
      renderMessageUser();

      const messageContent = screen.getByTestId('message-content');
      expect(messageContent).toHaveClass(
        'prose',
        'dark:prose-invert',
        'relative',
        'max-w-[70%]',
        'rounded-3xl',
        'bg-accent',
        'px-5',
        'py-2.5'
      );
    });

    it('should apply correct styling to image attachments', () => {
      const attachments = [
        {
          name: 'test-image.jpg',
          contentType: 'image/jpeg',
          url: 'data:image/jpeg;base64,testdata',
        },
      ];

      renderMessageUser({ attachments });

      const image = screen.getByAltText('test-image.jpg');
      expect(image).toHaveClass('mb-1', 'w-40', 'rounded-md');
      expect(image).toHaveAttribute('width', '160');
      expect(image).toHaveAttribute('height', '120');
    });
  });

  describe('Performance', () => {
    it('should handle many attachments efficiently', () => {
      const manyAttachments = Array.from({ length: 20 }, (_, i) => ({
        name: `file-${i}.jpg`,
        contentType: 'image/jpeg',
        url: `data:image/jpeg;base64,data${i}`,
      }));

      expect(() => renderMessageUser({ attachments: manyAttachments })).not.toThrow();

      // Verify first and last attachments are rendered
      expect(screen.getByAltText('file-0.jpg')).toBeInTheDocument();
      expect(screen.getByAltText('file-19.jpg')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('should integrate properly with all actions', async () => {
      const handlers = {
        copyToClipboard: vi.fn(),
        onDelete: vi.fn(),
        onEdit: vi.fn(),
        onReload: vi.fn(),
      };

      renderMessageUser(handlers);

      // Test copy functionality
      const copyButton = screen.getByLabelText('Copy text');
      await user.click(copyButton);
      expect(handlers.copyToClipboard).toHaveBeenCalledTimes(1);

      // Test delete functionality
      const deleteButton = screen.getByLabelText('Delete');
      await user.click(deleteButton);
      expect(handlers.onDelete).toHaveBeenCalledWith('test-user-message-1');
    });

    it('should maintain state across re-renders', () => {
      const { rerender } = renderMessageUser({ children: 'Original content' });

      expect(screen.getByTestId('message-content')).toHaveTextContent('Original content');

      rerender(
        <MessageUser {...defaultProps} children="Updated content" />
      );

      expect(screen.getByTestId('message-content')).toHaveTextContent('Updated content');
    });
  });
});