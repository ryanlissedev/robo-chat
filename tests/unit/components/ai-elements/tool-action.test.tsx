import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import '@testing-library/jest-dom';

// Hoist all mock functions
const { mockMotionDiv, mockAnimatePresence, mockIcons, mockFavicon, mockCn } = vi.hoisted(() => ({
  mockMotionDiv: vi.fn(({ children, ...props }: any) => (
    <div data-testid="motion-div" {...props}>
      {children}
    </div>
  )),
  mockAnimatePresence: vi.fn(({ children }: any) => (
    <div data-testid="animate-presence">{children}</div>
  )),
  mockIcons: {
    Search: vi.fn(() => <svg data-testid="search-icon" />),
    FileText: vi.fn(() => <svg data-testid="file-icon" />),
    Code: vi.fn(() => <svg data-testid="code-icon" />),
    Globe: vi.fn(() => <svg data-testid="globe-icon" />),
    ExternalLink: vi.fn(() => <svg data-testid="external-link-icon" />),
    Terminal: vi.fn(() => <svg data-testid="terminal-icon" />),
  },
  mockFavicon: vi.fn(({ domain, onError, onLoad }: any) => {
    // Simulate async loading behavior for testing
    React.useEffect(() => {
      const timeout = setTimeout(() => {
        if (domain === 'error-domain.com') {
          onError?.();
        } else {
          onLoad?.();
        }
      }, 10);
      return () => clearTimeout(timeout);
    }, [domain, onError, onLoad]);

    return (
      <img
        data-testid="favicon"
        data-domain={domain}
        src={`https://www.google.com/s2/favicons?domain=${domain}`}
        alt={`${domain} favicon`}
      />
    );
  }),
  mockCn: vi.fn((...classes: any[]) => classes.filter(Boolean).join(' ')),
}));

// Mock motion library
vi.mock('motion', () => ({
  motion: {
    div: mockMotionDiv,
  },
  AnimatePresence: mockAnimatePresence,
}));

// Mock lucide-react icons
vi.mock('lucide-react', () => mockIcons);

// Mock the Favicon component
vi.mock('@/components/ui/favicon', () => ({
  Favicon: mockFavicon,
}));

// Mock utils
vi.mock('@/lib/utils', () => ({
  cn: mockCn,
}));

// Import components under test after mocks
import {
  ToolActionContainer,
  ToolActionKind,
  ToolActionContent,
  type ToolActionContainerProps,
  type ToolActionKindProps,
  type ToolActionContentProps,
} from '@/components/ai-elements/tool-action';

import {
  WebSearchToolAction,
  DocumentToolAction,
  CodeExecutionToolAction,
  type WebSearchToolActionProps,
  type DocumentToolActionProps,
  type CodeExecutionToolActionProps,
} from '@/components/ai-elements/tool-actions';

describe('ToolAction Component System - London School TDD', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    vi.clearAllMocks();
    user = userEvent.setup({ delay: null });
  });

  describe('ToolActionContainer', () => {
    const defaultContainerProps: ToolActionContainerProps = {
      isLoading: false,
      className: 'test-container',
      children: <div data-testid="test-content">Test Content</div>,
    };

    it('should render children within motion.div container', () => {
      render(<ToolActionContainer {...defaultContainerProps} />);

      // Verify motion.div is called (contract behavior)
      expect(mockMotionDiv).toHaveBeenCalled();

      // Verify essential behavior - container and content are rendered
      expect(screen.getByTestId('motion-div')).toBeInTheDocument();
      expect(screen.getByTestId('test-content')).toBeInTheDocument();

      // Verify the container includes our custom class
      const motionDiv = screen.getByTestId('motion-div');
      expect(motionDiv).toHaveClass('test-container');
    });

    it('should apply loading animation when isLoading is true', () => {
      render(<ToolActionContainer {...defaultContainerProps} isLoading={true} />);

      // Verify motion.div is called with animation properties for loading state
      expect(mockMotionDiv).toHaveBeenCalled();
      const callArgs = mockMotionDiv.mock.calls[0][0];

      // Verify loading animation behavior
      expect(callArgs.animate.opacity).toEqual([1, 0.7, 1]);
      expect(callArgs.transition.repeat).toBe(Number.POSITIVE_INFINITY);
    });

    it('should apply static animation when not loading', () => {
      render(<ToolActionContainer {...defaultContainerProps} isLoading={false} />);

      // Verify motion.div is called with static animation
      expect(mockMotionDiv).toHaveBeenCalled();
      const callArgs = mockMotionDiv.mock.calls[0][0];

      // Verify static animation behavior
      expect(callArgs.animate.opacity).toBe(1);
      expect(callArgs.transition.duration).toBe(0.3);
    });

    it('should handle hover interactions with proper animation contract', () => {
      render(<ToolActionContainer {...defaultContainerProps} />);

      // Verify motion.div is called with hover animations
      expect(mockMotionDiv).toHaveBeenCalled();
      const callArgs = mockMotionDiv.mock.calls[0][0];

      // Verify hover behavior contracts
      expect(callArgs.whileHover.scale).toBe(1.02);
      expect(callArgs.whileTap.scale).toBe(0.98);
    });

    it('should compose className properly using cn utility', () => {
      const customClass = 'custom-class';
      render(<ToolActionContainer {...defaultContainerProps} className={customClass} />);

      // Verify cn was called to compose classes
      expect(mockCn).toHaveBeenCalledWith(
        expect.stringContaining('rounded-lg'),
        expect.stringContaining('border'),
        customClass
      );
    });

    it('should forward additional props to motion.div', () => {
      const onClickMock = vi.fn();
      render(
        <ToolActionContainer
          {...defaultContainerProps}
          onClick={onClickMock}
          data-testid="custom-container"
        />
      );

      expect(mockMotionDiv).toHaveBeenCalledWith(
        expect.objectContaining({
          onClick: onClickMock,
          'data-testid': 'custom-container',
        }),
        expect.anything()
      );
    });
  });

  describe('ToolActionKind', () => {
    const defaultKindProps: ToolActionKindProps = {
      icon: mockIcons.Search,
      name: 'Web Search',
      className: 'test-kind',
    };

    it('should render icon and name with proper structure', () => {
      render(<ToolActionKind {...defaultKindProps} />);

      // Verify icon component is called with correct props
      expect(mockIcons.Search).toHaveBeenCalledWith(
        expect.objectContaining({
          className: expect.stringContaining('w-4 h-4'),
        }),
        expect.anything()
      );

      expect(screen.getByText('Web Search')).toBeInTheDocument();
      expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    });

    it('should apply proper styling classes for icon and text', () => {
      render(<ToolActionKind {...defaultKindProps} />);

      const container = screen.getByText('Web Search').parentElement;
      expect(container).toHaveClass('flex', 'items-center', 'gap-2');

      const nameElement = screen.getByText('Web Search');
      expect(nameElement).toHaveClass('text-sm', 'font-medium');
    });

    it('should handle different icon types correctly', () => {
      const fileKindProps = {
        ...defaultKindProps,
        icon: mockIcons.FileText,
        name: 'Document',
      };

      render(<ToolActionKind {...fileKindProps} />);

      expect(mockIcons.FileText).toHaveBeenCalledWith(
        expect.objectContaining({
          className: expect.stringContaining('w-4 h-4'),
        }),
        expect.anything()
      );

      expect(screen.getByTestId('file-icon')).toBeInTheDocument();
      expect(screen.getByText('Document')).toBeInTheDocument();
    });

    it('should compose className with utility function', () => {
      render(<ToolActionKind {...defaultKindProps} />);

      expect(mockCn).toHaveBeenCalledWith(
        expect.stringContaining('flex'),
        'test-kind'
      );
    });

    it('should handle empty or special characters in name', () => {
      const specialNameProps = {
        ...defaultKindProps,
        name: 'API & Data Processing',
      };

      render(<ToolActionKind {...specialNameProps} />);
      expect(screen.getByText('API & Data Processing')).toBeInTheDocument();
    });
  });

  describe('ToolActionContent', () => {
    const defaultContentProps: ToolActionContentProps = {
      title: 'Search Results',
      url: 'https://example.com',
      domain: 'example.com',
      className: 'test-content',
    };

    it('should render title and favicon with proper structure', () => {
      render(<ToolActionContent {...defaultContentProps} />);

      expect(screen.getByText('Search Results')).toBeInTheDocument();
      expect(mockFavicon).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'example.com',
          onError: expect.any(Function),
          onLoad: expect.any(Function),
        }),
        expect.anything()
      );
    });

    it('should handle favicon loading success', async () => {
      render(<ToolActionContent {...defaultContentProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('favicon')).toBeInTheDocument();
      });

      const favicon = screen.getByTestId('favicon');
      expect(favicon).toHaveAttribute('data-domain', 'example.com');
    });

    it('should handle favicon loading error gracefully', async () => {
      const errorContentProps = {
        ...defaultContentProps,
        domain: 'error-domain.com',
      };

      render(<ToolActionContent {...errorContentProps} />);

      await waitFor(() => {
        expect(mockFavicon).toHaveBeenCalledWith(
          expect.objectContaining({
            domain: 'error-domain.com',
            onError: expect.any(Function),
          }),
          expect.anything()
        );
      });

      // Verify the component still renders without throwing
      expect(screen.getByText('Search Results')).toBeInTheDocument();
    });

    it('should render external link icon when url is provided', () => {
      render(<ToolActionContent {...defaultContentProps} />);

      expect(mockIcons.ExternalLink).toHaveBeenCalledWith(
        expect.objectContaining({
          className: expect.stringContaining('w-3 h-3'),
        }),
        expect.anything()
      );
    });

    it('should not render external link icon when url is not provided', () => {
      const noUrlProps = { ...defaultContentProps, url: undefined };
      render(<ToolActionContent {...noUrlProps} />);

      expect(mockIcons.ExternalLink).not.toHaveBeenCalled();
    });

    it('should apply proper accessibility attributes', () => {
      render(<ToolActionContent {...defaultContentProps} />);

      const titleElement = screen.getByText('Search Results');
      expect(titleElement).toHaveClass('text-sm', 'text-muted-foreground');

      // Verify structure for accessibility
      const container = titleElement.closest('div');
      expect(container).toHaveClass('flex', 'items-center', 'gap-2');
    });

    it('should handle long titles gracefully', () => {
      const longTitleProps = {
        ...defaultContentProps,
        title: 'This is a very long title that might need truncation or special handling in the UI component for better user experience',
      };

      render(<ToolActionContent {...longTitleProps} />);

      expect(screen.getByText(longTitleProps.title)).toBeInTheDocument();
    });
  });

  describe('Specific Tool Actions', () => {
    describe('WebSearchToolAction', () => {
      const defaultWebSearchProps: WebSearchToolActionProps = {
        query: 'JavaScript frameworks',
        results: [
          { title: 'React Documentation', url: 'https://react.dev', domain: 'react.dev' },
          { title: 'Vue Guide', url: 'https://vuejs.org', domain: 'vuejs.org' },
        ],
        isLoading: false,
      };

      it('should render search query and results using base components', () => {
        render(<WebSearchToolAction {...defaultWebSearchProps} />);

        expect(screen.getByText(/JavaScript frameworks/)).toBeInTheDocument();
        expect(screen.getByText('React Documentation')).toBeInTheDocument();
        expect(screen.getByText('Vue Guide')).toBeInTheDocument();
      });

      it('should show loading state when isLoading is true', () => {
        render(<WebSearchToolAction {...defaultWebSearchProps} isLoading={true} />);

        expect(mockMotionDiv).toHaveBeenCalledWith(
          expect.objectContaining({
            animate: expect.objectContaining({
              opacity: [1, 0.7, 1],
            }),
          }),
          expect.anything()
        );
      });

      it('should render search icon from ToolActionKind', () => {
        render(<WebSearchToolAction {...defaultWebSearchProps} />);

        expect(mockIcons.Search).toHaveBeenCalled();
        expect(screen.getByTestId('search-icon')).toBeInTheDocument();
      });

      it('should handle empty results gracefully', () => {
        const emptyResultsProps = { ...defaultWebSearchProps, results: [] };
        render(<WebSearchToolAction {...emptyResultsProps} />);

        expect(screen.getByText(/JavaScript frameworks/)).toBeInTheDocument();
        expect(screen.queryByText('React Documentation')).not.toBeInTheDocument();
      });
    });

    describe('DocumentToolAction', () => {
      const defaultDocumentProps: DocumentToolActionProps = {
        title: 'API Documentation',
        content: 'This document contains API reference information...',
        fileType: 'pdf',
        url: 'https://docs.example.com/api.pdf',
        isLoading: false,
      };

      it('should render document title and content', () => {
        render(<DocumentToolAction {...defaultDocumentProps} />);

        expect(screen.getByText('API Documentation')).toBeInTheDocument();
        expect(screen.getByText('This document contains API reference information...')).toBeInTheDocument();
      });

      it('should display file type information', () => {
        render(<DocumentToolAction {...defaultDocumentProps} />);

        expect(screen.getByText(/pdf/i)).toBeInTheDocument();
      });

      it('should render file icon from ToolActionKind', () => {
        render(<DocumentToolAction {...defaultDocumentProps} />);

        expect(mockIcons.FileText).toHaveBeenCalled();
        expect(screen.getByTestId('file-icon')).toBeInTheDocument();
      });

      it('should handle different file types', () => {
        const markdownProps = { ...defaultDocumentProps, fileType: 'markdown' };
        render(<DocumentToolAction {...markdownProps} />);

        expect(screen.getByText(/markdown/i)).toBeInTheDocument();
      });
    });

    describe('CodeExecutionToolAction', () => {
      const defaultCodeProps: CodeExecutionToolActionProps = {
        language: 'typescript',
        code: 'const result = await fetchData();',
        output: 'Successfully executed',
        isLoading: false,
      };

      it('should render code and execution output', () => {
        render(<CodeExecutionToolAction {...defaultCodeProps} />);

        expect(screen.getByText('const result = await fetchData();')).toBeInTheDocument();
        expect(screen.getByText('Successfully executed')).toBeInTheDocument();
      });

      it('should display language information', () => {
        render(<CodeExecutionToolAction {...defaultCodeProps} />);

        expect(screen.getByText(/typescript/i)).toBeInTheDocument();
      });

      it('should render code icon from ToolActionKind', () => {
        render(<CodeExecutionToolAction {...defaultCodeProps} />);

        expect(mockIcons.Code).toHaveBeenCalled();
        expect(screen.getByTestId('code-icon')).toBeInTheDocument();
      });

      it('should handle execution errors', () => {
        const errorProps = {
          ...defaultCodeProps,
          output: 'Error: Cannot find module',
          error: true,
        };

        render(<CodeExecutionToolAction {...errorProps} />);

        expect(screen.getByText('Error: Cannot find module')).toBeInTheDocument();
      });
    });
  });

  describe('Integration Tests - Component Interactions', () => {
    it('should handle user interactions across all components', async () => {
      const onClickMock = vi.fn();

      render(
        <ToolActionContainer onClick={onClickMock}>
          <ToolActionKind icon={mockIcons.Search} name="Search Tool" />
          <ToolActionContent
            title="Search Results"
            url="https://example.com"
            domain="example.com"
          />
        </ToolActionContainer>
      );

      // Verify components render together
      expect(screen.getByText('Search Tool')).toBeInTheDocument();
      expect(screen.getByText('Search Results')).toBeInTheDocument();

      // Test interaction behavior
      const container = screen.getByTestId('motion-div');
      fireEvent.click(container);

      expect(onClickMock).toHaveBeenCalledTimes(1);
    });

    it('should maintain consistent styling across component hierarchy', () => {
      render(
        <ToolActionContainer className="custom-container">
          <ToolActionKind
            icon={mockIcons.FileText}
            name="Document Tool"
            className="custom-kind"
          />
          <ToolActionContent
            title="Document Content"
            domain="docs.example.com"
            className="custom-content"
          />
        </ToolActionContainer>
      );

      // Verify cn utility is called for all components
      expect(mockCn).toHaveBeenCalledWith(
        expect.any(String),
        'custom-container'
      );
      expect(mockCn).toHaveBeenCalledWith(
        expect.any(String),
        'custom-kind'
      );
      expect(mockCn).toHaveBeenCalledWith(
        expect.any(String),
        'custom-content'
      );
    });

    it('should handle async favicon loading across multiple components', async () => {
      render(
        <div>
          <ToolActionContent title="Site 1" domain="site1.com" />
          <ToolActionContent title="Site 2" domain="site2.com" />
          <ToolActionContent title="Error Site" domain="error-domain.com" />
        </div>
      );

      await waitFor(() => {
        expect(mockFavicon).toHaveBeenCalledTimes(3);
      });

      // Verify all favicons are rendered
      const favicons = screen.getAllByTestId('favicon');
      expect(favicons).toHaveLength(3);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle missing props gracefully', () => {
      expect(() => {
        render(<ToolActionContainer>{null}</ToolActionContainer>);
      }).not.toThrow();

      expect(() => {
        render(<ToolActionKind icon={mockIcons.Search} name="" />);
      }).not.toThrow();

      expect(() => {
        render(<ToolActionContent title="" domain="" />);
      }).not.toThrow();
    });

    it('should handle invalid URLs in ToolActionContent', () => {
      const invalidUrlProps = {
        title: 'Test Content',
        url: 'not-a-valid-url',
        domain: 'example.com',
      };

      expect(() => {
        render(<ToolActionContent {...invalidUrlProps} />);
      }).not.toThrow();
    });

    it('should maintain accessibility during error states', () => {
      render(
        <ToolActionContainer>
          <ToolActionKind icon={mockIcons.Search} name="Failed Tool" />
          <ToolActionContent title="Error Content" domain="error-domain.com" />
        </ToolActionContainer>
      );

      // Verify content is still accessible
      expect(screen.getByText('Failed Tool')).toBeInTheDocument();
      expect(screen.getByText('Error Content')).toBeInTheDocument();
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large datasets efficiently', () => {
      const largeResults = Array.from({ length: 100 }, (_, i) => ({
        title: `Result ${i}`,
        url: `https://example${i}.com`,
        domain: `example${i}.com`,
      }));

      expect(() => {
        render(<WebSearchToolAction query="test" results={largeResults} isLoading={false} />);
      }).not.toThrow();
    });

    it('should minimize re-renders during animation states', () => {
      const { rerender } = render(
        <ToolActionContainer isLoading={false}>
          <div>Content</div>
        </ToolActionContainer>
      );

      const initialCallCount = mockMotionDiv.mock.calls.length;

      rerender(
        <ToolActionContainer isLoading={true}>
          <div>Content</div>
        </ToolActionContainer>
      );

      // Should have been called twice (initial + rerender)
      expect(mockMotionDiv.mock.calls.length).toBe(initialCallCount + 1);
    });
  });
});