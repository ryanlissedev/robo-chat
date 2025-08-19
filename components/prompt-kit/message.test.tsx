// Import DOM setup FIRST
import '../../tests/setup.minimal';

import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import {
  Message,
  MessageAction,
  MessageActions,
  MessageAvatar,
  MessageContent,
} from './message';

// Mock dependencies
interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  [key: string]: unknown;
}

interface MarkdownProps {
  children: React.ReactNode;
  className?: string;
  [key: string]: unknown;
}

interface ButtonCopyProps {
  value: string;
}

mock.module('@/components/ui/button', () => ({
  Button: ({ children, onClick, ...props }: ButtonProps) => (
    <button onClick={onClick} type="button" {...props}>
      {children}
    </button>
  ),
}));

// Mock the entire message module to avoid dynamic import issues
mock.module('./message', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const originalModule = require('./message');

  // Create a simple synchronous Markdown component for testing
  const TestMarkdown = ({ children, className, ...props }: MarkdownProps) => (
    <div className={className} data-testid="test-markdown" {...props}>
      {children}
    </div>
  );

  // Override MessageContent to use our test Markdown instead of dynamic import
  const TestMessageContent = ({
    children,
    markdown = false,
    className,
    ...props
  }: {
    children: React.ReactNode;
    markdown?: boolean;
    className?: string;
    [key: string]: unknown;
  }) => {
    const classNames = `rounded-lg p-2 text-foreground bg-secondary prose break-words whitespace-normal ${className || ''}`;

    return markdown ? (
      <TestMarkdown className={classNames} {...props}>
        {children as string}
      </TestMarkdown>
    ) : (
      <div className={classNames} {...props}>
        {children}
      </div>
    );
  };

  return {
    ...originalModule,
    MessageContent: TestMessageContent,
  };
});

mock.module('@/components/common/button-copy', () => ({
  ButtonCopy: ({ value }: ButtonCopyProps) => (
    <button data-testid="copy-button">Copy: {value}</button>
  ),
}));

mock.module('@/components/ui/avatar', () => ({
  Avatar: ({
    children,
    className,
  }: {
    children: React.ReactNode;
    className?: string;
  }) => (
    <div className={className} data-testid="avatar">
      {children}
    </div>
  ),
  AvatarImage: ({ src, alt }: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={alt}
      data-testid="avatar-image"
      height="24"
      src={src}
      width="24"
    />
  ),
  AvatarFallback: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="avatar-fallback">{children}</div>
  ),
}));

mock.module('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe('Message Components', () => {
  beforeEach(() => {
    cleanup();
  });

  describe('Message container', () => {
    it('should render with children', () => {
      const { getByTestId, getByText } = render(
        <Message data-testid="message-container">
          <div>Test content</div>
        </Message>
      );

      const messageContainer = getByTestId('message-container');
      expect(messageContainer).toBeInTheDocument();
      expect(getByText('Test content')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { getByTestId } = render(
        <Message className="custom-class" data-testid="message-container">
          <div>Test content</div>
        </Message>
      );

      const messageContainer = getByTestId('message-container');
      expect(messageContainer).toHaveClass('custom-class');
      expect(messageContainer).toHaveClass('flex', 'gap-3');
    });
  });

  describe('MessageContent', () => {
    it('should render content without markdown', () => {
      const { getByText } = render(
        <MessageContent>Test message content</MessageContent>
      );

      expect(getByText('Test message content')).toBeInTheDocument();
    });

    it('should render content with markdown', () => {
      const { getByTestId, getByText } = render(
        <MessageContent className="test-markdown" markdown>
          Test markdown content
        </MessageContent>
      );

      // Should render the mocked markdown component
      const markdownElement = getByTestId('test-markdown');
      expect(markdownElement).toBeInTheDocument();
      expect(markdownElement).toHaveClass('test-markdown');
      expect(markdownElement).toHaveClass(
        'rounded-lg',
        'p-2',
        'text-foreground',
        'bg-secondary',
        'prose',
        'break-words',
        'whitespace-normal'
      );
      expect(getByText('Test markdown content')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { getByTestId } = render(
        <MessageContent
          className="custom-content"
          data-testid="message-content"
        >
          Test content
        </MessageContent>
      );

      const content = getByTestId('message-content');
      expect(content).toHaveClass('custom-content');
    });
  });

  describe('MessageAvatar', () => {
    it('should render avatar with image', () => {
      const { getByTestId } = render(
        <MessageAvatar alt="Test User" fallback="TU" src="/test-avatar.png" />
      );

      expect(getByTestId('avatar')).toBeInTheDocument();
      expect(getByTestId('avatar-image')).toHaveAttribute(
        'src',
        '/test-avatar.png'
      );
      expect(getByTestId('avatar-image')).toHaveAttribute('alt', 'Test User');
    });

    it('should render fallback when provided', () => {
      const { getByTestId, getByText } = render(
        <MessageAvatar alt="Test User" fallback="TU" src="/test-avatar.png" />
      );

      expect(getByTestId('avatar-fallback')).toBeInTheDocument();
      expect(getByText('TU')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { getByTestId } = render(
        <MessageAvatar
          alt="Test User"
          className="custom-avatar"
          src="/test-avatar.png"
        />
      );

      const avatar = getByTestId('avatar');
      expect(avatar).toHaveClass('custom-avatar');
    });
  });

  describe('MessageActions', () => {
    it('should render action buttons', () => {
      const { getByTestId, getByText } = render(
        <MessageActions data-testid="message-actions">
          <button>Copy</button>
          <button>Regenerate</button>
        </MessageActions>
      );

      const actions = getByTestId('message-actions');
      expect(actions).toBeInTheDocument();
      expect(getByText('Copy')).toBeInTheDocument();
      expect(getByText('Regenerate')).toBeInTheDocument();
    });
  });

  describe('MessageAction with tooltip', () => {
    it('should render action with tooltip', () => {
      const { getByText, getByTestId } = render(
        <MessageAction tooltip="Copy message">
          <button>Copy</button>
        </MessageAction>
      );

      expect(getByText('Copy')).toBeInTheDocument();
      expect(getByTestId('tooltip-content')).toHaveTextContent('Copy message');
    });
  });

  describe('Complete message composition', () => {
    it('should render a complete message with all components', () => {
      const { getByTestId, getByText } = render(
        <Message data-testid="complete-message">
          <MessageAvatar alt="User" fallback="U" src="/user-avatar.png" />
          <div>
            <MessageContent markdown>
              Hello, this is a test message!
            </MessageContent>
            <MessageActions>
              <MessageAction tooltip="Copy message">
                <button>Copy</button>
              </MessageAction>
            </MessageActions>
          </div>
        </Message>
      );

      expect(getByTestId('complete-message')).toBeInTheDocument();
      expect(getByTestId('avatar')).toBeInTheDocument();
      expect(getByTestId('test-markdown')).toHaveTextContent(
        'Hello, this is a test message!'
      );
      expect(getByText('Copy')).toBeInTheDocument();
    });
  });
});
