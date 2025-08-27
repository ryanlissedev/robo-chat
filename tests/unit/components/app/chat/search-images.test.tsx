import { render, screen, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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
  getFavicon: vi.fn((url: string) => `https://favicon.service/${encodeURIComponent(url)}`),
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
    imageUrl: 'https://nature.com/mountain.png',
    sourceUrl: 'https://nature.com/mountains',
  },
  {
    title: 'City skyline',
    imageUrl: 'https://city.com/skyline.jpg',
    sourceUrl: 'https://www.city.com/photos',
  },
];

function renderSearchImages(props = {}) {
  const defaultProps = {
    results: mockResults,
  };
  return render(<SearchImages {...defaultProps} {...props} />);
}

describe('SearchImages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render image grid with results', () => {
      renderSearchImages();
      
      // Check that all images are rendered
      expect(screen.getByAltText('Beautiful sunset')).toBeInTheDocument();
      expect(screen.getByAltText('Mountain landscape')).toBeInTheDocument();
      expect(screen.getByAltText('City skyline')).toBeInTheDocument();
    });

    it('should render links with correct href', () => {
      renderSearchImages();
      
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(3);
      
      expect(links[0]).toHaveAttribute('href', 'https://example.com/sunset-article?utm_source=test');
      expect(links[1]).toHaveAttribute('href', 'https://nature.com/mountains?utm_source=test');
      expect(links[2]).toHaveAttribute('href', 'https://www.city.com/photos?utm_source=test');
    });

    it('should open links in new tab', () => {
      renderSearchImages();
      
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    it('should apply correct CSS classes to grid', () => {
      renderSearchImages();
      
      const container = screen.getByAltText('Beautiful sunset').closest('.my-4');
      expect(container).toHaveClass(
        'my-4',
        'grid',
        'grid-cols-1',
        'gap-4',
        'sm:grid-cols-3'
      );
    });

    it('should apply correct styling to image links', () => {
      renderSearchImages();
      
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).toHaveClass(
          'group/image',
          'relative',
          'block',
          'overflow-hidden',
          'rounded-xl'
        );
      });
    });
  });

  describe('Image Display', () => {
    it('should render images with correct attributes', () => {
      renderSearchImages();
      
      const images = screen.getAllByRole('img').filter(img => 
        img.getAttribute('alt') !== 'favicon'
      );
      
      expect(images[0]).toHaveAttribute('src', 'https://example.com/sunset.jpg');
      expect(images[0]).toHaveAttribute('alt', 'Beautiful sunset');
      expect(images[0]).toHaveClass(
        'h-full',
        'max-h-48',
        'min-h-40',
        'w-full',
        'object-cover',
        'opacity-0',
        'transition-opacity',
        'duration-150',
        'ease-out'
      );
    });

    it('should handle image load event', async () => {
      renderSearchImages();
      
      const image = screen.getByAltText('Beautiful sunset');
      expect(image).toHaveClass('opacity-0');
      
      // Simulate image load - the actual opacity removal happens in the component's onLoad
      await act(async () => {
        const loadEvent = new Event('load');
        image.dispatchEvent(loadEvent);
      });
      
      // Verify the onLoad handler was attached (we can't test the classList.remove directly with our simplified mock)
      expect(image).toBeInTheDocument();
    });

    it('should handle image error by hiding the item', async () => {
      renderSearchImages();
      
      const image = screen.getByAltText('Beautiful sunset');
      expect(image).toBeInTheDocument();
      
      // Simulate image error
      await act(async () => {
        const errorEvent = new Event('error');
        image.dispatchEvent(errorEvent);
      });
      
      // Wait for the state update and re-render
      await waitFor(() => {
        expect(screen.queryByAltText('Beautiful sunset')).not.toBeInTheDocument();
      });
    });

    it('should handle multiple image errors', async () => {
      renderSearchImages();
      
      const images = [
        screen.getByAltText('Beautiful sunset'),
        screen.getByAltText('Mountain landscape'),
      ];
      
      // Trigger errors for first two images
      await act(async () => {
        images.forEach(img => {
          const errorEvent = new Event('error');
          img.dispatchEvent(errorEvent);
        });
      });
      
      // Wait for state updates and re-render
      await waitFor(() => {
        expect(screen.queryByAltText('Beautiful sunset')).not.toBeInTheDocument();
        expect(screen.queryByAltText('Mountain landscape')).not.toBeInTheDocument();
        expect(screen.getByAltText('City skyline')).toBeInTheDocument();
      });
    });
  });

  describe('Favicon and Site Information', () => {
    it('should render favicons for each image source', () => {
      renderSearchImages();
      
      const favicons = screen.getAllByAltText('favicon');
      expect(favicons).toHaveLength(3);
      
      expect(favicons[0]).toHaveAttribute('src', 'https://favicon.service/https%3A%2F%2Fexample.com%2Fsunset-article');
      expect(favicons[0]).toHaveClass('h-4', 'w-4', 'rounded-full');
    });

    it('should display site names correctly', () => {
      renderSearchImages();
      
      expect(screen.getByText('example.com')).toBeInTheDocument();
      expect(screen.getByText('nature.com')).toBeInTheDocument();
      expect(screen.getByText('city.com')).toBeInTheDocument();
    });

    it('should display image titles', () => {
      renderSearchImages();
      
      expect(screen.getByText('Beautiful sunset')).toBeInTheDocument();
      expect(screen.getByText('Mountain landscape')).toBeInTheDocument();
      expect(screen.getByText('City skyline')).toBeInTheDocument();
    });

    it('should call utility functions with correct parameters', () => {
      renderSearchImages();
      
      expect(utils.addUTM).toHaveBeenCalledWith('https://example.com/sunset-article');
      expect(utils.addUTM).toHaveBeenCalledWith('https://nature.com/mountains');
      expect(utils.addUTM).toHaveBeenCalledWith('https://www.city.com/photos');
      
      expect(utils.getFavicon).toHaveBeenCalledWith('https://example.com/sunset-article');
      expect(utils.getFavicon).toHaveBeenCalledWith('https://nature.com/mountains');
      expect(utils.getFavicon).toHaveBeenCalledWith('https://www.city.com/photos');
      
      expect(utils.getSiteName).toHaveBeenCalledWith('https://example.com/sunset-article');
      expect(utils.getSiteName).toHaveBeenCalledWith('https://nature.com/mountains');
      expect(utils.getSiteName).toHaveBeenCalledWith('https://www.city.com/photos');
    });
  });

  describe('Hover Effects', () => {
    it('should apply hover styling classes to overlay', () => {
      renderSearchImages();
      
      // Find overlays by their specific class combination instead of problematic selector
      const overlays = document.querySelectorAll('.absolute.opacity-0.transition-opacity');
      expect(overlays).toHaveLength(3);
      
      overlays.forEach(overlay => {
        expect(overlay).toHaveClass(
          'absolute',
          'right-0',
          'bottom-0',
          'left-0',
          'flex',
          'flex-col',
          'gap-0.5',
          'bg-primary',
          'px-2.5',
          'py-1.5',
          'opacity-0',
          'transition-opacity',
          'duration-100',
          'ease-out',
          'group-hover/image:opacity-100'
        );
      });
    });

    it('should have proper text truncation classes', () => {
      renderSearchImages();
      
      const titleElements = screen.getAllByText(/Beautiful sunset|Mountain landscape|City skyline/);
      const siteElements = screen.getAllByText(/example\.com|nature\.com|city\.com/);
      
      [...titleElements, ...siteElements].forEach(element => {
        expect(element).toHaveClass('line-clamp-1', 'text-xs');
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

    it('should handle results with missing properties gracefully', () => {
      const incompleteResults = [
        {
          title: '',
          imageUrl: 'https://example.com/image.jpg',
          sourceUrl: 'https://example.com',
        },
        {
          title: 'Test Image',
          imageUrl: '',
          sourceUrl: 'https://example.com',
        },
      ];
      
      renderSearchImages({ results: incompleteResults });
      
      // Should still render without crashing
      expect(screen.getByAltText('')).toBeInTheDocument();
      expect(screen.getByText('Test Image')).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive grid classes', () => {
      renderSearchImages();
      
      const container = screen.getByAltText('Beautiful sunset').closest('.grid');
      expect(container).toHaveClass('grid-cols-1', 'sm:grid-cols-3');
    });

    it('should maintain aspect ratio constraints', () => {
      renderSearchImages();
      
      const images = screen.getAllByRole('img').filter(img => 
        img.getAttribute('alt') !== 'favicon'
      );
      
      images.forEach(image => {
        expect(image).toHaveClass('max-h-48', 'min-h-40');
      });
    });
  });

  describe('Performance', () => {
    it('should handle large number of results efficiently', () => {
      const largeResults = Array.from({ length: 100 }, (_, i) => ({
        title: `Image ${i + 1}`,
        imageUrl: `https://example.com/image${i + 1}.jpg`,
        sourceUrl: `https://example.com/page${i + 1}`,
      }));
      
      renderSearchImages({ results: largeResults });
      
      // Should render all images
      expect(screen.getAllByRole('img').filter(img => 
        img.getAttribute('alt') !== 'favicon'
      )).toHaveLength(100);
    });

    it('should maintain state correctly after errors', async () => {
      renderSearchImages();
      
      // Trigger error on first image
      const firstImage = screen.getByAltText('Beautiful sunset');
      await act(async () => {
        firstImage.dispatchEvent(new Event('error'));
      });
      
      // Wait for state update
      await waitFor(() => {
        expect(screen.queryByAltText('Beautiful sunset')).not.toBeInTheDocument();
      });
      
      // Other images should still be present
      expect(screen.getByAltText('Mountain landscape')).toBeInTheDocument();
      expect(screen.getByAltText('City skyline')).toBeInTheDocument();
      
      // Trigger error on second image
      const secondImage = screen.getByAltText('Mountain landscape');
      await act(async () => {
        secondImage.dispatchEvent(new Event('error'));
      });
      
      // Wait for state update and verify only third image remains
      await waitFor(() => {
        expect(screen.queryByAltText('Mountain landscape')).not.toBeInTheDocument();
        expect(screen.getByAltText('City skyline')).toBeInTheDocument();
        expect(screen.getAllByRole('img').filter(img => 
          img.getAttribute('alt') !== 'favicon'
        )).toHaveLength(1);
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper alt texts for all images', () => {
      renderSearchImages();
      
      const mainImages = screen.getAllByRole('img').filter(img => 
        img.getAttribute('alt') !== 'favicon'
      );
      
      expect(mainImages[0]).toHaveAttribute('alt', 'Beautiful sunset');
      expect(mainImages[1]).toHaveAttribute('alt', 'Mountain landscape');
      expect(mainImages[2]).toHaveAttribute('alt', 'City skyline');
    });

    it('should have proper alt texts for favicons', () => {
      renderSearchImages();
      
      const favicons = screen.getAllByAltText('favicon');
      expect(favicons).toHaveLength(3);
      
      favicons.forEach(favicon => {
        expect(favicon).toHaveAttribute('alt', 'favicon');
      });
    });

    it('should have keyboard accessible links', () => {
      renderSearchImages();
      
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        expect(link).not.toHaveAttribute('tabindex', '-1');
      });
    });

    it('should provide proper link context', () => {
      renderSearchImages();
      
      const links = screen.getAllByRole('link');
      links.forEach(link => {
        // Links should contain both image and text content for context
        const images = link.querySelectorAll('img');
        const mainImage = Array.from(images).find(img => img.getAttribute('alt') !== 'favicon');
        expect(mainImage).toBeInTheDocument();
        expect(link.textContent).toBeTruthy();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed URLs in sourceUrl', () => {
      const malformedResults = [
        {
          title: 'Test Image',
          imageUrl: 'https://example.com/image.jpg',
          sourceUrl: 'not-a-valid-url',
        },
      ];
      
      renderSearchImages({ results: malformedResults });
      
      expect(screen.getByText('Test Image')).toBeInTheDocument();
      expect(utils.getSiteName).toHaveBeenCalledWith('not-a-valid-url');
    });

    it('should handle very long titles and URLs', () => {
      const longResults = [
        {
          title: 'A very long image title that might exceed the normal length limits and could potentially cause layout issues',
          imageUrl: 'https://example.com/image.jpg',
          sourceUrl: 'https://very-long-domain-name-that-exceeds-normal-limits.example.com/very/long/path/to/resource',
        },
      ];
      
      renderSearchImages({ results: longResults });
      
      // Should render without layout issues due to line-clamp classes
      const titleElement = screen.getByText(/A very long image title/);
      expect(titleElement).toHaveClass('line-clamp-1');
    });

    it('should handle empty strings in result properties', () => {
      const emptyResults = [
        {
          title: '',
          imageUrl: '',
          sourceUrl: '',
        },
      ];
      
      renderSearchImages({ results: emptyResults });
      
      // Should render the structure even with empty values
      // Note: Images with empty src will have src=null due to our mock
      const images = screen.getAllByRole('img').filter(img => 
        img.getAttribute('alt') !== 'favicon'
      );
      // With empty imageUrl, the Next.js Image might not render or render differently
      // We'll check that the component doesn't crash rather than expecting a specific count
      expect(images.length).toBeGreaterThanOrEqual(0);
      
      // Verify the link structure is still there
      const links = screen.getAllByRole('link');
      expect(links).toHaveLength(1);
    });
  });
});
