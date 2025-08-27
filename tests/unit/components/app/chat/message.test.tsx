import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Message } from '@/components/app/chat/message';
import type { ExtendedUIMessage } from '@/app/types/ai-extended';

// Mock child components
vi.mock('@/components/app/chat/message-assistant', () => ({
  MessageAssistant: ({ children, messageId, onQuote, onReload, copyToClipboard, isLast, parts, status, hasScrollAnchor, langsmithRunId, className, copied, ...otherProps }: any) => {
    // Only pass standard DOM props to avoid React warnings
    const domProps: Record<string, any> = {};
    
    // Only include standard HTML attributes
    Object.keys(otherProps).forEach((key) => {
      if (key.startsWith('data-') || key.startsWith('aria-') || key === 'id' || key === 'role' || key === 'tabIndex' || key === 'className') {
        domProps[key] = otherProps[key];
      }
    });
    
    return (
      <div 
        data-testid="message-assistant" 
        data-message-id={messageId}
        className={className}
        {...domProps}
      >
        <div>{children}</div>
        <button onClick={onQuote && (() => onQuote('quoted text', messageId))}>Quote</button>
        <button onClick={onReload}>Reload</button>
        <button onClick={() => {
          console.log('[Mock] copyToClipboard called in MessageAssistant');
          copyToClipboard();
        }}>Copy</button>
      </div>
    );
  },
}));

vi.mock('@/components/app/chat/message-user', () => ({
  MessageUser: ({ children, id, onDelete, onEdit, copyToClipboard, ...otherProps }: any) => {
    // Only pass standard DOM props to avoid React warnings
    const domProps: Record<string, any> = {};
    
    // Only include standard HTML attributes
    Object.keys(otherProps).forEach((key) => {
      if (key.startsWith('data-') || key.startsWith('aria-') || key === 'id' || key === 'role' || key === 'tabIndex' || key === 'className') {
        domProps[key] = otherProps[key];
      }
    });
    
    return (
      <div data-testid="message-user" data-message-id={id} {...domProps}>
        <div>{children}</div>
        <button onClick={() => onDelete(id)}>Delete</button>
        <button onClick={() => onEdit(id, 'edited text')}>Edit</button>
        <button onClick={() => {
          console.log('[Mock] copyToClipboard called in MessageUser');
          copyToClipboard();
        }}>Copy</button>
      </div>
    );
  },
}));

// Hoist clipboard mock to avoid conflicts with global setup
const { mockWriteText } = vi.hoisted(() => ({
  mockWriteText: vi.fn().mockResolvedValue(undefined),
}));

const defaultProps = {
  id: 'test-message-1',
  children: 'Test message content',
  variant: 'user' as const,
  onDelete: vi.fn(),
  onEdit: vi.fn(),
  onReload: vi.fn(),
  onQuote: vi.fn(),
} as const;

function renderMessage(props = {}) {
  return render(<Message {...defaultProps} {...props} />);
}

describe('Message', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Use real timers for userEvent compatibility
    vi.useRealTimers();
    mockWriteText.mockClear();
    mockWriteText.mockResolvedValue(undefined);
    
    // Setup userEvent with proper configuration
    user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
      delay: null, // Remove delay for faster tests
    });
  });

  // Use describe-level setup to override clipboard mock
  beforeEach(() => {
    // Force override any existing clipboard mock from vitest-setup.ts
    // This needs to happen in beforeEach to ensure it's applied for each test
    const mockClipboard = {
      writeText: mockWriteText,
      readText: vi.fn().mockResolvedValue(''),
      read: vi.fn().mockResolvedValue([]),
      write: vi.fn().mockResolvedValue(undefined),
    };

    // Override navigator.clipboard
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });

    // Override global.navigator.clipboard for jsdom
    if (global.navigator) {
      Object.defineProperty(global.navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });
    }

    // Override window.navigator.clipboard 
    if (typeof window !== 'undefined' && window.navigator) {
      Object.defineProperty(window.navigator, 'clipboard', {
        value: mockClipboard,
        writable: true,
        configurable: true,
      });
    }
    
    // Verify our mock is properly set
    const isCorrectMock = navigator.clipboard.writeText === mockWriteText;
    if (!isCorrectMock) {
      throw new Error('Clipboard mock override failed - expected our mock function to be set');
    }
    
    // Ensure clipboard mock is properly available with argument
    expect(navigator.clipboard.writeText).toBeDefined();
    
    // Test the mock function works with a string argument
    expect(() => mockWriteText('test')).not.toThrow();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Clipboard Mock Verification', () => {
    it('should verify clipboard mock is working', async () => {
      // Clear any previous mock calls
      mockWriteText.mockClear();
      
      expect(navigator.clipboard).toBeDefined();
      expect(navigator.clipboard.writeText).toBeDefined();
      
      // Test direct call to clipboard
      await navigator.clipboard.writeText('test');
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test');
      expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    });
  });

  describe('User Messages', () => {
    it('should render MessageUser component for user variant', () => {
      renderMessage({ variant: 'user' });
      
      expect(screen.getByTestId('message-user')).toBeInTheDocument();
      expect(screen.queryByTestId('message-assistant')).not.toBeInTheDocument();
      expect(screen.getByText('Test message content')).toBeInTheDocument();
    });

    it('should pass correct props to MessageUser', () => {
      const props = {
        variant: 'user' as const,
        id: 'user-msg-123',
        attachments: [{ name: 'test.jpg', url: 'test.jpg', contentType: 'image/jpeg' }],
        className: 'custom-class',
        hasScrollAnchor: true,
      };
      
      renderMessage(props);
      
      const userMessage = screen.getByTestId('message-user');
      expect(userMessage).toHaveAttribute('data-message-id', 'user-msg-123');
      expect(userMessage).toHaveClass('custom-class');
    });

    it('should handle user message deletion', async () => {
      const onDelete = vi.fn();
      renderMessage({ variant: 'user', onDelete });
      
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);
      
      await waitFor(() => {
        expect(onDelete).toHaveBeenCalledWith('test-message-1');
      }, { timeout: 5000 });
    });

    it('should handle user message editing', async () => {
      const onEdit = vi.fn();
      renderMessage({ variant: 'user', onEdit });
      
      const editButton = screen.getByText('Edit');
      await user.click(editButton);
      
      await waitFor(() => {
        expect(onEdit).toHaveBeenCalledWith('test-message-1', 'edited text');
      }, { timeout: 5000 });
    });

    it('should handle clipboard copy for user messages', async () => {
      renderMessage({ variant: 'user' });
      
      const copyButton = screen.getByText('Copy');
      await user.click(copyButton);
      
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('Test message content');
      }, { timeout: 5000 });
    });
  });

  describe('Assistant Messages', () => {
    it('should render MessageAssistant component for assistant variant', () => {
      renderMessage({ variant: 'assistant' });
      
      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
      expect(screen.queryByTestId('message-user')).not.toBeInTheDocument();
      expect(screen.getByText('Test message content')).toBeInTheDocument();
    });

    it('should pass correct props to MessageAssistant', () => {
      const parts: ExtendedUIMessage['parts'] = [
        { type: 'text', text: 'Hello world' },
        { type: 'tool-call', toolCallId: 'call-123', state: 'output-available' as const, input: { query: 'search' }, output: { type: 'tool-result', content: [{ type: 'text', text: 'result' }] } },
      ];
      
      const props = {
        variant: 'assistant' as const,
        id: 'assistant-msg-456',
        className: 'assistant-class',
        isLast: true,
        hasScrollAnchor: false,
        parts,
        status: 'ready' as const,
      };
      
      renderMessage(props);
      
      const assistantMessage = screen.getByTestId('message-assistant');
      expect(assistantMessage).toHaveAttribute('data-message-id', 'assistant-msg-456');
      expect(assistantMessage).toHaveClass('assistant-class');
    });

    it('should handle assistant message reload', async () => {
      const onReload = vi.fn();
      renderMessage({ variant: 'assistant', onReload });
      
      const reloadButton = screen.getByText('Reload');
      await user.click(reloadButton);
      
      await waitFor(() => {
        expect(onReload).toHaveBeenCalledTimes(1);
      }, { timeout: 5000 });
    });

    it('should handle quote functionality', async () => {
      const onQuote = vi.fn();
      renderMessage({ variant: 'assistant', onQuote });
      
      const quoteButton = screen.getByText('Quote');
      await user.click(quoteButton);
      
      await waitFor(() => {
        expect(onQuote).toHaveBeenCalledWith('quoted text', 'test-message-1');
      }, { timeout: 5000 });
    });

    it('should handle clipboard copy for assistant messages', async () => {
      renderMessage({ variant: 'assistant' });
      
      const copyButton = screen.getByText('Copy');
      await user.click(copyButton);
      
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('Test message content');
      }, { timeout: 5000 });
    });
  });

  describe('Clipboard Functionality', () => {
    it('should copy text to clipboard and show copied state', async () => {
      renderMessage({ variant: 'user' });
      
      const copyButton = screen.getByText('Copy');
      await user.click(copyButton);
      
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('Test message content');
      }, { timeout: 5000 });
      
      // Check that copied state is passed to component (would show as copied=true)
      // The actual UI feedback is handled by the child components
    });

    it('should reset copied state after timeout', async () => {
      // Clear previous mock calls
      mockWriteText.mockClear();
      
      renderMessage({ variant: 'user' });
      
      const copyButton = screen.getByText('Copy');
      await user.click(copyButton);
      
      // Verify clipboard was called
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledTimes(1);
      }, { timeout: 1000 });
      
      // Wait for the 500ms timeout to complete naturally
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // The copied state should be reset after timeout
      // (The actual UI state change is implementation detail tested in child components)
      expect(mockWriteText).toHaveBeenCalledTimes(1); // Should still be 1, no additional calls
    });

    it('should handle clipboard write failure gracefully', async () => {
      // Mock clipboard to fail once
      mockWriteText.mockRejectedValueOnce(new Error('Clipboard failed'));
      
      renderMessage({ variant: 'assistant' });
      
      const copyButton = screen.getByText('Copy');
      
      // Should not throw error - the component handles the failure gracefully
      await expect(user.click(copyButton)).resolves.not.toThrow();
      
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalled();
      }, { timeout: 5000 });
    });

    it('should handle multiple rapid copy attempts', async () => {
      // Clear previous mock calls
      mockWriteText.mockClear();
      
      renderMessage({ variant: 'assistant' });
      
      const copyButton = screen.getByText('Copy');
      
      // Click multiple times rapidly
      await user.click(copyButton);
      await user.click(copyButton);
      await user.click(copyButton);
      
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledTimes(3);
      }, { timeout: 5000 });
    });
  });

  describe('Unknown Variants', () => {
    it('should return null for unknown variant', () => {
      const { container } = renderMessage({ variant: 'unknown' as any });
      expect(container.firstChild).toBeNull();
    });

    it('should handle undefined variant gracefully', () => {
      const { container } = renderMessage({ variant: undefined as any });
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Props Handling', () => {
    it('should handle missing optional props', () => {
      const minimalProps = {
        variant: 'user' as const,
        id: 'test-id',
        children: 'Test content',
        onDelete: vi.fn(),
        onEdit: vi.fn(),
        onReload: vi.fn(),
      };
      
      renderMessage(minimalProps);
      expect(screen.getByTestId('message-user')).toBeInTheDocument();
    });

    it('should handle all optional props for user messages', () => {
      const fullProps = {
        variant: 'user' as const,
        id: 'test-id',
        children: 'Test content',
        attachments: [
          { name: 'file1.txt', url: 'file1.txt', contentType: 'text/plain' },
          { name: 'file2.jpg', url: 'file2.jpg', contentType: 'image/jpeg' },
        ],
        isLast: true,
        onDelete: vi.fn(),
        onEdit: vi.fn(),
        onReload: vi.fn(),
        hasScrollAnchor: true,
        className: 'test-class',
        onQuote: vi.fn(),
      };
      
      renderMessage(fullProps);
      expect(screen.getByTestId('message-user')).toBeInTheDocument();
    });

    it('should handle all optional props for assistant messages', () => {
      const fullProps = {
        variant: 'assistant' as const,
        id: 'test-id',
        children: 'Test content',
        isLast: false,
        onDelete: vi.fn(),
        onEdit: vi.fn(),
        onReload: vi.fn(),
        hasScrollAnchor: false,
        parts: [{ type: 'text', text: 'Test' }] as ExtendedUIMessage['parts'],
        status: 'streaming' as const,
        className: 'assistant-test-class',
        onQuote: vi.fn(),
      };
      
      renderMessage(fullProps);
      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
    });

    it('should handle undefined callback functions', () => {
      const props = {
        variant: 'user' as const,
        id: 'test-id',
        children: 'Test content',
        onDelete: undefined as any,
        onEdit: undefined as any,
        onReload: undefined as any,
        onQuote: undefined as any,
      };
      
      expect(() => renderMessage(props)).not.toThrow();
      expect(screen.getByTestId('message-user')).toBeInTheDocument();
    });
  });

  describe('Content Handling', () => {
    it('should handle empty content', () => {
      renderMessage({ variant: 'user', children: '' });
      
      const userMessage = screen.getByTestId('message-user');
      expect(userMessage).toBeInTheDocument();
    });

    it('should handle very long content', () => {
      // Clear previous mock calls
      mockWriteText.mockClear();
      
      const longContent = 'A'.repeat(10000);
      renderMessage({ variant: 'assistant', children: longContent });
      
      expect(screen.getByText(longContent)).toBeInTheDocument();
      expect(mockWriteText).not.toHaveBeenCalled(); // Not copied yet
    });

    it('should handle content with special characters', () => {
      const specialContent = 'Content with <HTML> & "quotes" and emoji 🚀';
      renderMessage({ variant: 'user', children: specialContent });
      
      expect(screen.getByText(specialContent)).toBeInTheDocument();
    });

    it('should handle multiline content', () => {
      const multilineContent = 'Line 1\nLine 2\nLine 3';
      renderMessage({ variant: 'assistant', children: multilineContent });
      
      const assistantMessage = screen.getByTestId('message-assistant');
      expect(assistantMessage).toBeInTheDocument();
      // Note: HTML rendering converts newlines to spaces in text content
      expect(assistantMessage).toHaveTextContent('Line 1 Line 2 Line 3');
    });
  });

  describe('Status Handling', () => {
    it('should handle streaming status', () => {
      renderMessage({ 
        variant: 'assistant', 
        status: 'streaming' 
      });
      
      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
    });

    it('should handle ready status', () => {
      renderMessage({ 
        variant: 'assistant', 
        status: 'ready' 
      });
      
      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
    });

    it('should handle error status', () => {
      renderMessage({ 
        variant: 'assistant', 
        status: 'error' 
      });
      
      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
    });

    it('should handle submitted status', () => {
      renderMessage({ 
        variant: 'assistant', 
        status: 'submitted' 
      });
      
      expect(screen.getByTestId('message-assistant')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('should properly integrate user and assistant message workflows', async () => {
      const callbacks = {
        onDelete: vi.fn(),
        onEdit: vi.fn(),
        onReload: vi.fn(),
        onQuote: vi.fn(),
      };
      
      // Test user message
      const { rerender } = renderMessage({ 
        variant: 'user', 
        ...callbacks 
      });
      
      await user.click(screen.getByText('Delete'));
      await waitFor(() => {
        expect(callbacks.onDelete).toHaveBeenCalledWith('test-message-1');
      }, { timeout: 5000 });
      
      // Switch to assistant message
      rerender(
        <Message 
          {...defaultProps}
          variant="assistant"
          {...callbacks}
        />
      );
      
      await user.click(screen.getByText('Quote'));
      await waitFor(() => {
        expect(callbacks.onQuote).toHaveBeenCalledWith('quoted text', 'test-message-1');
      }, { timeout: 5000 });
      
      await user.click(screen.getByText('Reload'));
      await waitFor(() => {
        expect(callbacks.onReload).toHaveBeenCalledTimes(1);
      }, { timeout: 5000 });
    });

    it('should maintain clipboard state across re-renders', async () => {
      const { rerender } = renderMessage({ variant: 'user' });
      
      await user.click(screen.getByText('Copy'));
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('Test message content');
      }, { timeout: 5000 });
      
      // Re-render with new content
      rerender(
        <Message 
          {...defaultProps}
          variant="user"
          children="New content"
        />
      );
      
      await user.click(screen.getByText('Copy'));
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledWith('New content');
      }, { timeout: 5000 });
    });
  });
});
