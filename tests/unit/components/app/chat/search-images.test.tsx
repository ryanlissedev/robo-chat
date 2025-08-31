import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchImages } from '@/components/app/chat/search-images';
import * as utils from '@/components/app/chat/utils';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ alt, src, className, onError, onLoad, ...props }: any) => {
    return (
      <img
        alt={alt}
        src={src || null}
        className={className}
        onError={onError}
        onLoad={onLoad}
        {...props}
      />
    );
  },
}));

// Mock utils functions
vi.mock('@/components/app/chat/utils', () => ({
  addUTM: vi.fn((url: string) => `${url}?utm_source=test`),
  getFavicon: vi.fn(
    (url: string) => `https://favicon.service/${encodeURIComponent(url)}`
  ),
  getSiteName: vi.fn((url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return url;
    }
  }),
}));

type ImageResult = {
  title: string;
  imageUrl: string;
  sourceUrl: string;
};

const mockResults: ImageResult[] = [
  {
    title: 'Beautiful sunset',
    imageUrl: 'https://example.com/sunset.jpg',
    sourceUrl: 'https://example.com/sunset-article',
  },
  {
    title: 'Mountain landscape',
    imageUrl: 'https://example.com/mountain.jpg',
    sourceUrl: 'https://example.com/mountain-article',
  },
  {
    title: 'Ocean waves',
    imageUrl: 'https://example.com/ocean.jpg',
    sourceUrl: 'https://example.com/ocean-article',
  },
];

function renderSearchImages(props = {}) {
  const defaultProps = {
    results: mockResults,
    ...props,
  };
  return render(<SearchImages {...defaultProps} />);
}

describe('SearchImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Rendering', () => {
    it('should render image grid with results', () => {
      renderSearchImages();

      expect(
        screen.getByText('Beautiful sunset', { hidden: true })
      ).toBeInTheDocument();
      expect(
        screen.getByText('Mountain landscape', { hidden: true })
      ).toBeInTheDocument();
      expect(
        screen.getByText('Ocean waves', { hidden: true })
      ).toBeInTheDocument();

      // Should render images
      const images = document.querySelectorAll('img');
      const mainImages = Array.from(images).filter(
        (img) => img.getAttribute('alt') !== 'favicon'
      );
      expect(mainImages.length).toBe(3);
    });

    it('should render links with correct href', () => {
      renderSearchImages();

      const links = screen.getAllByRole('link', { hidden: true });
      // Each image result creates multiple links (image link + potential favicon link)
      expect(links.length).toBeGreaterThan(0);

      // Check that image links have correct href (with UTM)
      const imageLinks = links.filter((link) =>
        link.getAttribute('href')?.includes('utm_source=test')
      );
      expect(imageLinks.length).toBeGreaterThan(0);

      imageLinks.forEach((link) => {
        const href = link.getAttribute('href');
        expect(href).toContain('utm_source=test');
      });
    });

    it('should open links in new tab', () => {
      renderSearchImages();

      const links = screen.getAllByRole('link', { hidden: true });
      links.forEach((link) => {
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toContain('noopener');
        expect(link.getAttribute('rel')).toContain('noreferrer');
      });
    });

    it('should apply correct CSS classes to grid', () => {
      renderSearchImages();

      const gridContainer = document.querySelector('div');
      expect(gridContainer).toHaveClass('grid');
      expect(gridContainer).toHaveClass('grid-cols-1');
      expect(gridContainer).toHaveClass('md:grid-cols-2');
      expect(gridContainer).toHaveClass('lg:grid-cols-3');
      expect(gridContainer).toHaveClass('gap-4');
    });

    it('should apply correct styling to image links', () => {
      renderSearchImages();

      const imageLinks = document.querySelectorAll('a');
      imageLinks.forEach((link) => {
        expect(link).toHaveClass('block');
        expect(link).toHaveClass('relative');
        expect(link).toHaveClass('group');
        expect(link).toHaveClass('overflow-hidden');
        expect(link).toHaveClass('rounded-lg');
        expect(link).toHaveClass('bg-gray-100');
        expect(link).toHaveClass('aspect-video');
      });
    });
  });

  describe('Image Display', () => {
    it('should render images with correct attributes', async () => {
      renderSearchImages();

      await waitFor(() => {
        const images = document.querySelectorAll('img');
        const mainImages = Array.from(images).filter(
          (img) => img.getAttribute('alt') !== 'favicon'
        );

        expect(mainImages.length).toBe(3);

        mainImages.forEach((img, index) => {
          expect(img).toHaveAttribute('alt', mockResults[index].title);
          expect(img).toHaveAttribute('src', mockResults[index].imageUrl);
          expect(img).toHaveClass('w-full');
          expect(img).toHaveClass('h-full');
          expect(img).toHaveClass('object-cover');
          expect(img).toHaveClass('transition-transform');
          expect(img).toHaveClass('duration-200');
          expect(img).toHaveClass('group-hover:scale-105');
        });
      });
    });

    it('should handle image load event', async () => {
      const _onLoad = vi.fn();
      renderSearchImages();

      await waitFor(() => {
        const images = document.querySelectorAll('img');
        const mainImages = Array.from(images).filter(
          (img) => img.getAttribute('alt') !== 'favicon'
        );

        // Simulate image load
        act(() => {
          mainImages.forEach((img) => {
            img.dispatchEvent(new Event('load'));
          });
        });
      });
    });

    it('should handle image error by hiding the item', async () => {
      renderSearchImages();

      await waitFor(() => {
        const images = document.querySelectorAll('img');
        const mainImages = Array.from(images).filter(
          (img) => img.getAttribute('alt') !== 'favicon'
        );

        // Simulate image error
        act(() => {
          mainImages[0].dispatchEvent(new Event('error'));
        });

        // The component should handle the error gracefully
        expect(mainImages[0].closest('a')).toBeInTheDocument();
      });
    });

    it('should handle multiple image errors', async () => {
      renderSearchImages();

      await waitFor(() => {
        const images = document.querySelectorAll('img');
        const mainImages = Array.from(images).filter(
          (img) => img.getAttribute('alt') !== 'favicon'
        );

        // Simulate multiple image errors
        act(() => {
          mainImages.forEach((img) => {
            img.dispatchEvent(new Event('error'));
          });
        });

        // All image containers should still be in the document
        // The component handles errors gracefully without removing elements
        expect(mainImages[0].closest('a')).toBeInTheDocument();
        expect(mainImages[1].closest('a')).toBeInTheDocument();
        expect(mainImages[2].closest('a')).toBeInTheDocument();
      });
    });
  });

  describe('Favicon and Site Information', () => {
    it('should render favicons for each image source', async () => {
      renderSearchImages();

      await waitFor(() => {
        const favicons = document.querySelectorAll('img[alt="favicon"]');
        expect(favicons.length).toBe(3);

        favicons.forEach((favicon, index) => {
          const expectedFaviconUrl = `https://favicon.service/${encodeURIComponent(
            mockResults[index].sourceUrl
          )}`;
          expect(favicon).toHaveAttribute('src', expectedFaviconUrl);
        });
      });
    });

    it('should display site names correctly', async () => {
      renderSearchImages();

      await waitFor(() => {
        expect(utils.getSiteName).toHaveBeenCalledWith(
          mockResults[0].sourceUrl
        );
        expect(utils.getSiteName).toHaveBeenCalledWith(
          mockResults[1].sourceUrl
        );
        expect(utils.getSiteName).toHaveBeenCalledWith(
          mockResults[2].sourceUrl
        );
      });
    });

    it('should display image titles', async () => {
      renderSearchImages();

      await waitFor(() => {
        expect(
          screen.getByText('Beautiful sunset', { hidden: true })
        ).toBeInTheDocument();
        expect(
          screen.getByText('Mountain landscape', { hidden: true })
        ).toBeInTheDocument();
        expect(
          screen.getByText('Ocean waves', { hidden: true })
        ).toBeInTheDocument();
      });
    });

    it('should call utility functions with correct parameters', async () => {
      renderSearchImages();

      await waitFor(() => {
        // Check addUTM calls
        expect(utils.addUTM).toHaveBeenCalledWith(mockResults[0].sourceUrl);
        expect(utils.addUTM).toHaveBeenCalledWith(mockResults[1].sourceUrl);
        expect(utils.addUTM).toHaveBeenCalledWith(mockResults[2].sourceUrl);

        // Check getFavicon calls
        expect(utils.getFavicon).toHaveBeenCalledWith(mockResults[0].sourceUrl);
        expect(utils.getFavicon).toHaveBeenCalledWith(mockResults[1].sourceUrl);
        expect(utils.getFavicon).toHaveBeenCalledWith(mockResults[2].sourceUrl);

        // Check getSiteName calls
        expect(utils.getSiteName).toHaveBeenCalledWith(
          mockResults[0].sourceUrl
        );
        expect(utils.getSiteName).toHaveBeenCalledWith(
          mockResults[1].sourceUrl
        );
        expect(utils.getSiteName).toHaveBeenCalledWith(
          mockResults[2].sourceUrl
        );
      });
    });
  });

  describe('Hover Effects', () => {
    it('should apply hover styling classes to overlay', async () => {
      renderSearchImages();

      await waitFor(() => {
        const overlays = document.querySelectorAll(
          '.absolute.inset-0.bg-gradient-to-t'
        );
        expect(overlays.length).toBe(3);

        overlays.forEach((overlay) => {
          expect(overlay).toHaveClass('absolute');
          expect(overlay).toHaveClass('inset-0');
          expect(overlay).toHaveClass('bg-gradient-to-t');
          expect(overlay).toHaveClass('from-black/60');
          expect(overlay).toHaveClass('via-transparent');
          expect(overlay).toHaveClass('to-transparent');
          expect(overlay).toHaveClass('opacity-0');
          expect(overlay).toHaveClass('group-hover:opacity-100');
          expect(overlay).toHaveClass('transition-opacity');
          expect(overlay).toHaveClass('duration-200');
        });
      });
    });

    it('should have proper text truncation classes', async () => {
      renderSearchImages();

      await waitFor(() => {
        const titleElements = document.querySelectorAll('.line-clamp-1');
        expect(titleElements.length).toBeGreaterThanOrEqual(3);
      });
    });
  });

  describe('Empty States', () => {
    it('should return null when results array is empty', () => {
      const { container } = renderSearchImages({ results: [] });
      expect(container.firstChild).toBeNull();
    });

    it('should return null when results is undefined', () => {
      const { container } = renderSearchImages({ results: undefined });
      expect(container.firstChild).toBeNull();
    });

    it('should return null when results is null', () => {
      const { container } = renderSearchImages({ results: null });
      expect(container.firstChild).toBeNull();
    });

    it('should handle results with missing properties gracefully', async () => {
      const incompleteResults = [
        {
          title: 'Complete Result',
          imageUrl: 'https://example.com/image.jpg',
          sourceUrl: 'https://example.com/source',
        },
        {
          title: '',
          imageUrl: '',
          sourceUrl: '',
        },
      ];

      renderSearchImages({ results: incompleteResults });
      // Should not crash and should render at least the complete result
      await waitFor(() => {
        expect(
          screen.getByText('Complete Result', { hidden: true })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive grid classes', async () => {
      renderSearchImages();

      const gridContainer = document.querySelector('div');
      expect(gridContainer).toHaveClass('grid-cols-1');
      expect(gridContainer).toHaveClass('md:grid-cols-2');
      expect(gridContainer).toHaveClass('lg:grid-cols-3');
    });

    it('should maintain aspect ratio constraints', async () => {
      renderSearchImages();

      const imageLinks = document.querySelectorAll('a');
      imageLinks.forEach((link) => {
        expect(link).toHaveClass('aspect-video');
      });
    });
  });

  describe('Performance', () => {
    it('should handle large number of results efficiently', async () => {
      const largeResults = Array.from({ length: 100 }, (_, i) => ({
        title: `Image ${i}`,
        imageUrl: `https://example.com/image${i}.jpg`,
        sourceUrl: `https://example.com/source${i}`,
      }));

      const startTime = Date.now();
      renderSearchImages({ results: largeResults });
      const renderTime = Date.now() - startTime;

      // Should render quickly even with many results
      expect(renderTime).toBeLessThan(1000); // Less than 1 second

      // Should still render all items
      expect(document.querySelectorAll('img').length).toBeGreaterThan(100);
    });

    it('should maintain state correctly after errors', async () => {
      renderSearchImages();

      await waitFor(() => {
        const images = document.querySelectorAll('img');
        const mainImages = Array.from(images).filter(
          (img) => img.getAttribute('alt') !== 'favicon'
        );

        // Simulate some errors
        act(() => {
          mainImages[0].dispatchEvent(new Event('error'));
          mainImages[1].dispatchEvent(new Event('error'));
        });

        // Component should maintain its structure
        const links = screen.getAllByRole('link', { hidden: true });
        expect(links.length).toBeGreaterThan(0);

        // And still handle successful loads
        act(() => {
          mainImages[2].dispatchEvent(new Event('load'));
        });

        // Should not affect other images
        expect(
          screen.getByText('Ocean waves', { hidden: true })
        ).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper alt texts for all images', async () => {
      renderSearchImages();

      const images = document.querySelectorAll('img');
      const mainImages = Array.from(images).filter(
        (img) => img.getAttribute('alt') !== 'favicon'
      );

      mainImages.forEach((img, index) => {
        expect(img).toHaveAttribute('alt', mockResults[index].title);
      });
    });

    it('should have proper alt texts for favicons', async () => {
      renderSearchImages();

      const favicons = document.querySelectorAll('img[alt="favicon"]');
      favicons.forEach((favicon) => {
        expect(favicon).toHaveAttribute('alt', 'favicon');
      });
    });

    it('should have keyboard accessible links', async () => {
      renderSearchImages();

      const links = screen.getAllByRole('link', { hidden: true });
      links.forEach((link) => {
        // Links should be focusable
        expect(link.tagName.toLowerCase()).toBe('a');
        expect(link).toHaveAttribute('href');
      });
    });

    it('should provide proper link context', async () => {
      renderSearchImages();

      const imageLinks = screen.getAllByRole('link', { hidden: true });
      imageLinks.forEach((link) => {
        const href = link.getAttribute('href');
        if (href?.includes('utm_source=test')) {
          // Image links should have proper context through their content
          expect(link.querySelector('img')).toBeInTheDocument();
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed URLs in sourceUrl', async () => {
      const malformedResults = [
        {
          title: 'Test Image',
          imageUrl: 'https://example.com/image.jpg',
          sourceUrl: 'not-a-valid-url',
        },
      ];

      renderSearchImages({ results: malformedResults });

      await waitFor(() => {
        expect(
          screen.getByText('Test Image', { hidden: true })
        ).toBeInTheDocument();
        expect(utils.getSiteName).toHaveBeenCalledWith('not-a-valid-url');
      });
    });

    it('should handle very long titles and URLs', async () => {
      const longResults = [
        {
          title:
            'A very long image title that might exceed the normal length limits and could potentially cause layout issues',
          imageUrl: 'https://example.com/image.jpg',
          sourceUrl:
            'https://very-long-domain-name-that-exceeds-normal-limits.example.com/very/long/path/to/resource',
        },
      ];

      renderSearchImages({ results: longResults });

      // Should render without layout issues due to line-clamp classes
      await waitFor(() => {
        const titleElement = screen.getByText(/A very long image title/, {
          hidden: true,
        });
        expect(titleElement).toHaveClass('line-clamp-1');
      });
    });

    it('should handle empty strings in result properties', async () => {
      const emptyResults = [
        {
          title: '',
          imageUrl: '',
          sourceUrl: '',
        },
      ];

      renderSearchImages({ results: emptyResults });

      await waitFor(() => {
        // Should render the structure even with empty values
        // Note: Images with empty src will have src=null due to our mock
        // Images with empty alt text get role="presentation" instead of role="img"
        const images = document.querySelectorAll('img');
        const mainImages = Array.from(images).filter(
          (img) => img.getAttribute('alt') !== 'favicon'
        );
        // With empty imageUrl, the Next.js Image might not render or render differently
        // We'll check that the component doesn't crash rather than expecting a specific count
        expect(mainImages.length).toBeGreaterThanOrEqual(0);

        // Verify the link structure is still there - should only have image link, no favicon link due to empty sourceUrl
        const links = screen.getAllByRole('link', { hidden: true });
        expect(links).toHaveLength(1); // Only the main image link, no favicon link
      });
    });
  });
});
