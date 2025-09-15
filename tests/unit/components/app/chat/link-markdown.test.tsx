import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkMarkdown } from '@/components/app/chat/link-markdown';

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

function renderLinkMarkdown(props = {}) {
  const defaultProps = {
    href: 'https://example.com',
    children: 'Example Link',
  };
  return render(<LinkMarkdown {...defaultProps} {...props} />);
}

describe('LinkMarkdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Valid URL Handling', () => {
    it('should render link with valid URL', () => {
      renderLinkMarkdown({ href: 'https://example.com' });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should display domain name without www prefix', () => {
      renderLinkMarkdown({ href: 'https://www.example.com/path' });

      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('should handle complex URLs correctly', () => {
      const complexUrl =
        'https://subdomain.example.com/path/to/resource?param=value#section';
      renderLinkMarkdown({ href: complexUrl });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', complexUrl);
      expect(screen.getByText('subdomain.example.com')).toBeInTheDocument();
    });

    it('should render favicon with correct URL encoding', () => {
      const testUrl = 'https://example.com/path?param=value';
      renderLinkMarkdown({ href: testUrl });

      const favicon = screen.getByAltText('favicon');
      expect(favicon).toHaveAttribute(
        'src',
        `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(testUrl)}`
      );
    });

    it('should handle URLs with different protocols', () => {
      const httpUrl = 'http://example.com';
      renderLinkMarkdown({ href: httpUrl });

      expect(screen.getByRole('link')).toHaveAttribute('href', httpUrl);
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('should handle URLs with ports', () => {
      const urlWithPort = 'https://example.com:3000/app';
      renderLinkMarkdown({ href: urlWithPort });

      // Domain should show hostname only, without port
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });
  });

  describe('Invalid URL Handling', () => {
    it('should render span when href is undefined', () => {
      renderLinkMarkdown({ href: undefined });

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByText('Example Link')).toBeInTheDocument();

      const span = screen.getByText('Example Link');
      expect(span.tagName).toBe('SPAN');
    });

    it('should render span when href is null', () => {
      renderLinkMarkdown({ href: null as any });

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByText('Example Link')).toBeInTheDocument();
    });

    it('should render span when href is empty string', () => {
      renderLinkMarkdown({ href: '' });

      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      expect(screen.getByText('Example Link')).toBeInTheDocument();
    });

    it('should handle relative paths as invalid URLs', () => {
      renderLinkMarkdown({ href: '/relative/path' });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/relative/path');
      expect(screen.getByText('path')).toBeInTheDocument(); // Last segment of path
    });

    it('should handle malformed URLs gracefully', () => {
      renderLinkMarkdown({ href: 'not-a-valid-url' });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'not-a-valid-url');
      expect(screen.getByText('not-a-valid-url')).toBeInTheDocument();
    });
  });

  describe('Domain Extraction', () => {
    it('should extract domain from standard HTTPS URL', () => {
      renderLinkMarkdown({ href: 'https://github.com/user/repo' });
      expect(screen.getByText('github.com')).toBeInTheDocument();
    });

    it('should remove www prefix from domain', () => {
      renderLinkMarkdown({ href: 'https://www.google.com/search' });
      expect(screen.getByText('google.com')).toBeInTheDocument();
    });

    it('should handle subdomains correctly', () => {
      renderLinkMarkdown({ href: 'https://api.github.com/repos' });
      expect(screen.getByText('api.github.com')).toBeInTheDocument();
    });

    it('should handle TLD variations', () => {
      renderLinkMarkdown({ href: 'https://example.co.uk/page' });
      expect(screen.getByText('example.co.uk')).toBeInTheDocument();
    });

    it('should fall back to last path segment for relative URLs', () => {
      renderLinkMarkdown({ href: '/docs/getting-started' });
      expect(screen.getByText('getting-started')).toBeInTheDocument();
    });

    it('should handle single segment relative paths', () => {
      renderLinkMarkdown({ href: '/dashboard' });
      expect(screen.getByText('dashboard')).toBeInTheDocument();
    });

    it('should handle root path', () => {
      renderLinkMarkdown({ href: '/' });
      expect(screen.getByText('/')).toBeInTheDocument();
    });
  });

  describe('CSS Classes and Styling', () => {
    it('should apply correct CSS classes to link', () => {
      renderLinkMarkdown({ href: 'https://example.com' });

      const link = screen.getByRole('link');
      expect(link).toHaveClass(
        'inline-flex',
        'h-5',
        'max-w-32',
        'items-center',
        'gap-1',
        'overflow-hidden',
        'overflow-ellipsis',
        'whitespace-nowrap',
        'rounded-full',
        'bg-muted',
        'py-0',
        'pr-2',
        'pl-0.5',
        'text-muted-foreground',
        'text-xs',
        'leading-none',
        'no-underline',
        'transition-colors',
        'duration-150',
        'hover:bg-muted-foreground/30',
        'hover:text-primary'
      );
    });

    it('should apply correct classes to favicon', () => {
      renderLinkMarkdown({ href: 'https://example.com' });

      const favicon = screen.getByAltText('favicon');
      expect(favicon).toHaveClass('size-3.5', 'rounded-full');
      expect(favicon).toHaveAttribute('width', '14');
      expect(favicon).toHaveAttribute('height', '14');
    });

    it('should apply text truncation classes to domain text', () => {
      renderLinkMarkdown({ href: 'https://example.com' });

      const domainSpan = screen.getByText('example.com');
      expect(domainSpan).toHaveClass(
        'overflow-hidden',
        'text-ellipsis',
        'whitespace-nowrap',
        'font-normal'
      );
    });
  });

  describe('Favicon Generation', () => {
    it('should generate favicon URL with proper encoding', () => {
      const testUrl = 'https://example.com/path?query=test&other=value';
      renderLinkMarkdown({ href: testUrl });

      const favicon = screen.getByAltText('favicon');
      const expectedSrc = `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(testUrl)}`;
      expect(favicon).toHaveAttribute('src', expectedSrc);
    });

    it('should handle special characters in URL', () => {
      const urlWithSpecialChars =
        'https://example.com/path with spaces?query=test&value=100%';
      renderLinkMarkdown({ href: urlWithSpecialChars });

      const favicon = screen.getByAltText('favicon');
      const expectedSrc = `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(urlWithSpecialChars)}`;
      expect(favicon).toHaveAttribute('src', expectedSrc);
    });

    it('should handle international domains', () => {
      const internationalUrl = 'https://例え.テスト/path';
      renderLinkMarkdown({ href: internationalUrl });

      const favicon = screen.getByAltText('favicon');
      expect(favicon).toHaveAttribute(
        'src',
        `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(internationalUrl)}`
      );
    });
  });

  describe('Props Handling', () => {
    it('should pass through additional props to link element', () => {
      renderLinkMarkdown({
        href: 'https://example.com',
        'data-testid': 'custom-link',
        className: 'custom-class',
      });

      const link = screen.getByTestId('custom-link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveClass('custom-class');
    });

    it('should pass through additional props to span when no href', () => {
      renderLinkMarkdown({
        href: undefined,
        'data-testid': 'custom-span',
        className: 'span-class',
      });

      const span = screen.getByTestId('custom-span');
      expect(span).toBeInTheDocument();
      expect(span).toHaveClass('span-class');
      expect(span.tagName).toBe('SPAN');
    });

    it('should handle children prop correctly', () => {
      renderLinkMarkdown({
        href: 'https://example.com',
        children: 'Custom Link Text',
      });

      // Children should be passed to the link but domain is shown in the span
      expect(screen.getByRole('link')).toBeInTheDocument();
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('should handle React node children', () => {
      renderLinkMarkdown({
        href: 'https://example.com',
        children: <span data-testid="child-element">Child Content</span>,
      });

      expect(screen.getByTestId('child-element')).toBeInTheDocument();
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });
  });

  describe('Security', () => {
    it('should have secure link attributes', () => {
      renderLinkMarkdown({ href: 'https://example.com' });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(link).toHaveAttribute('target', '_blank');
    });

    it('should handle potentially dangerous URLs safely', () => {
      const dangerousUrl = 'javascript:alert("xss")';
      renderLinkMarkdown({ href: dangerousUrl });

      const link = screen.getByRole('link');
      // React blocks javascript: URLs and replaces them with a security error
      expect(link).toHaveAttribute(
        'href',
        "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')"
      );
      // The browser and security measures should prevent actual execution
    });
  });

  describe('Edge Cases', () => {
    it('should handle extremely long URLs', () => {
      const longUrl = `https://example.com/${'a'.repeat(1000)}`;
      renderLinkMarkdown({ href: longUrl });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', longUrl);
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('should handle URLs with no path', () => {
      renderLinkMarkdown({ href: 'https://example.com' });

      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('should handle URLs ending with slash', () => {
      renderLinkMarkdown({ href: 'https://example.com/' });

      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('should handle file URLs', () => {
      renderLinkMarkdown({ href: 'file:///path/to/file.txt' });

      expect(screen.getByText('file.txt')).toBeInTheDocument();
    });

    it('should handle data URLs', () => {
      renderLinkMarkdown({ href: 'data:text/plain;base64,SGVsbG8gV29ybGQ=' });

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute(
        'href',
        'data:text/plain;base64,SGVsbG8gV29ybGQ='
      );
    });

    it('should handle URLs with fragments only', () => {
      renderLinkMarkdown({ href: '#section' });

      expect(screen.getByText('#section')).toBeInTheDocument();
    });

    it('should handle query-only URLs', () => {
      renderLinkMarkdown({ href: '?query=value' });

      expect(screen.getByText('?query=value')).toBeInTheDocument();
    });

    it('should handle empty domain extraction gracefully', () => {
      renderLinkMarkdown({ href: 'https://' });

      // Should fall back to showing the original href
      const link = screen.getByRole('link');
      expect(link).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should be keyboard accessible', () => {
      renderLinkMarkdown({ href: 'https://example.com' });

      const link = screen.getByRole('link');
      expect(link).not.toHaveAttribute('tabindex', '-1');
    });

    it('should provide meaningful link context', () => {
      renderLinkMarkdown({ href: 'https://github.com/user/repo' });

      const link = screen.getByRole('link');
      expect(link.textContent).toContain('github.com');
    });

    it('should have proper alt text for favicon', () => {
      renderLinkMarkdown({ href: 'https://example.com' });

      const favicon = screen.getByAltText('favicon');
      expect(favicon).toBeInTheDocument();
    });
  });
});
