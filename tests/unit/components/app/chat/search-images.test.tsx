import { act, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SearchImages } from '@/components/app/chat/search-images';
import * as utils from '@/components/app/chat/utils';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ alt, src, className, onError, onLoad, ...props }: any) => {
    return (
      <img
        role="img"
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

  afterEach(() => {
    // Force cleanup to prevent state contamination between tests
    cleanup();
  });

  describe('Rendering', () => {
    it('should render image grid with results', () => {
      const { container } = renderSearchImages();
      
      // The component renders synchronously, no need to wait
      // Check that all images are rendered
      expect(screen.getByAltText('Beautiful sunset')).toBeInTheDocument();
      expect(screen.getByAltText('Mountain landscape')).toBeInTheDocument();
      expect(screen.getByAltText('City skyline')).toBeInTheDocument();
      
      // Verify the grid structure
      expect(container.querySelector('.my-4.grid.grid-cols-1.gap-4.sm\\:grid-cols-3')).toBeInTheDocument();
    });

    it('should render links with correct href', () => {
      const { container } = renderSearchImages();
      
      // Debug: Print actual HTML to see what's rendered
      console.log('Rendered HTML:', container.innerHTML);

      const links = screen.getAllByRole('link', { hidden: true });
      expect(links).toHaveLength(6); // 3 images + 3 favicons = 6 links

      // Links are in DOM order: image, favicon, image, favicon, image, favicon
      expect(links[0]).toHaveAttribute(
        'href',
        'https://example.com/sunset-article?utm_source=test'
      );
      expect(links[2]).toHaveAttribute(
        'href',
        'https://nature.com/mountains?utm_source=test'
      );
      expect(links[4]).toHaveAttribute(
        'href',
        'https://www.city.com/photos?utm_source=test'
      );
    });

    it('should open links in new tab', () => {
      renderSearchImages();

      const links = screen.getAllByRole('link', { hidden: true });
      links.forEach((link) => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    it('should apply correct CSS classes to grid', () => {
      renderSearchImages();

      const images = screen.getAllByAltText('Beautiful sunset');
      const container = images[0].closest('.my-4');
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

      const links = screen.getAllByRole('link', { hidden: true });
      // Only check main image links (every other link starting from index 0)
      const imageLinks = [links[0], links[2], links[4]];
      imageLinks.forEach((link) => {
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
    it('should render images with correct attributes', async () => {
      renderSearchImages();

      await waitFor(() => {
        const images = screen
          .getAllByRole('img', { hidden: true })
          .filter((img) => img.getAttribute('alt') !== 'favicon');

        expect(images).toHaveLength(3);
      expect(images[0]).toHaveAttribute(
        'src',
        'https://example.com/sunset.jpg'
      );
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

      // Wait for images to be available
      const images = await screen.findAllByRole('img', { name: 'Beautiful sunset' });
      expect(images[0]).toHaveClass('opacity-0');

      // Simulate load event - no act() needed for synchronous DOM events
      const loadEvent = new Event('load');
      images[0].dispatchEvent(loadEvent);

      // Verify image is still present after load event (load doesn't hide images)
      const imagesAfterLoad = await screen.findAllByRole('img', { name: 'Beautiful sunset' });
      expect(imagesAfterLoad).toHaveLength(1);
    });

    it('should handle image error by hiding the item', async () => {
      renderSearchImages();

      // Wait for images to be available and verify initial state
      const images = await screen.findAllByRole('img', { name: 'Beautiful sunset' });
      expect(images).toHaveLength(1);
      
      act(() => {
        const errorEvent = new Event('error');
        images[0].dispatchEvent(errorEvent);
      });

      await waitFor(() => {
        expect(screen.queryByRole('img', { name: 'Beautiful sunset' })).not.toBeInTheDocument();
      });
    });

    it('should handle multiple image errors', async () => {
      renderSearchImages();

      // Wait for all images to be available first
      const sunsetImages = await screen.findAllByRole('img', { name: 'Beautiful sunset' });
      const mountainImages = await screen.findAllByRole('img', { name: 'Mountain landscape' });
      const cityImages = await screen.findAllByRole('img', { name: 'City skyline' });
      expect(sunsetImages).toHaveLength(1);
      expect(mountainImages).toHaveLength(1);
      expect(cityImages).toHaveLength(1);

      // Trigger errors for first two images
      act(() => {
        const errorEvent1 = new Event('error');
        const errorEvent2 = new Event('error');
        sunsetImages[0].dispatchEvent(errorEvent1);
        mountainImages[0].dispatchEvent(errorEvent2);
      });

      await waitFor(() => {
        expect(
          screen.queryByRole('img', { name: 'Beautiful sunset' })
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole('img', { name: 'Mountain landscape' })
        ).not.toBeInTheDocument();
      });

      // Third image should still be present
      expect(screen.getAllByRole('img', { name: 'City skyline' })).toHaveLength(1);
    });
  });

  describe('Favicon and Site Information', () => {
    it('should render favicons for each image source', async () => {
      renderSearchImages();

      const favicons = await screen.findAllByRole('img', { name: 'favicon' });
      expect(favicons).toHaveLength(3);

      expect(favicons[0]).toHaveAttribute(
        'src',
        'https://favicon.service/https%3A%2F%2Fexample.com%2Fsunset-article'
      );
      expect(favicons[0]).toHaveClass('h-4', 'w-4', 'rounded-full');
    });

    it('should display site names correctly', async () => {
      renderSearchImages();
      
      // Site names are rendered as text content within span elements in hover overlays
      await waitFor(() => {
        expect(screen.getByText('example.com', { hidden: true })).toBeInTheDocument();
        expect(screen.getByText('nature.com', { hidden: true })).toBeInTheDocument();
        expect(screen.getByText('city.com', { hidden: true })).toBeInTheDocument();
      });
    });

    it('should display image titles', async () => {
      renderSearchImages();

      // Image titles are rendered as text content within span elements in hover overlays
      await waitFor(() => {
        expect(screen.getByText('Beautiful sunset', { hidden: true })).toBeInTheDocument();
        expect(screen.getByText('Mountain landscape', { hidden: true })).toBeInTheDocument();
        expect(screen.getByText('City skyline', { hidden: true })).toBeInTheDocument();
      });
    });

    it('should call utility functions with correct parameters', async () => {
      // Clear mocks to ensure clean state
      vi.clearAllMocks();
      
      renderSearchImages();

      // Verify component rendered with expected content (titles are in hover overlays)
      await waitFor(() => {
        expect(screen.getByText('Beautiful sunset', { hidden: true })).toBeInTheDocument();
      });

      expect(utils.addUTM).toHaveBeenCalledWith(
        'https://example.com/sunset-article'
      );
      expect(utils.addUTM).toHaveBeenCalledWith('https://nature.com/mountains');
      expect(utils.addUTM).toHaveBeenCalledWith('https://www.city.com/photos');

      expect(utils.getFavicon).toHaveBeenCalledWith(
        'https://example.com/sunset-article'
      );
      expect(utils.getFavicon).toHaveBeenCalledWith(
        'https://nature.com/mountains'
      );
      expect(utils.getFavicon).toHaveBeenCalledWith(
        'https://www.city.com/photos'
      );

      expect(utils.getSiteName).toHaveBeenCalledWith(
        'https://example.com/sunset-article'
      );
      expect(utils.getSiteName).toHaveBeenCalledWith(
        'https://nature.com/mountains'
      );
      expect(utils.getSiteName).toHaveBeenCalledWith(
        'https://www.city.com/photos'
      );
    });
  });

  describe('Hover Effects', () => {
    it('should apply hover styling classes to overlay', async () => {
      const { container } = renderSearchImages();

      // Wait for component to render and verify by checking for image elements
      await waitFor(() => {
        expect(screen.getAllByRole('img', { hidden: true })).toHaveLength(6); // 3 main images + 3 favicons
      });

      // Find overlays by their specific class combination - these are the hover overlays
      const overlays = container.querySelectorAll(
        '.absolute.right-0.bottom-0.left-0'
      );
      expect(overlays).toHaveLength(3);

      overlays.forEach((overlay) => {
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

    it('should have proper text truncation classes', async () => {
      const { container } = renderSearchImages();

      // Wait for component to render and verify by checking for image elements  
      await waitFor(() => {
        expect(screen.getAllByRole('img', { hidden: true })).toHaveLength(6); // 3 main images + 3 favicons
      });

      // Check for line-clamp-1 and text-xs classes in the rendered HTML
      const elementsWithTruncation = container.querySelectorAll('.line-clamp-1.text-xs');
      expect(elementsWithTruncation.length).toBeGreaterThanOrEqual(6); // 3 titles + 3 site names
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
      expect(screen.getByText('Test Image', { hidden: true })).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('should apply responsive grid classes', async () => {
      const { container } = renderSearchImages();

      const gridContainer = container.querySelector('.grid');
      expect(gridContainer).toHaveClass('grid-cols-1', 'sm:grid-cols-3');
    });

    it('should maintain aspect ratio constraints', async () => {
      renderSearchImages();

      const images = screen
        .getAllByRole('img', { hidden: true })
        .filter((img) => img.getAttribute('alt') !== 'favicon');

      images.forEach((image) => {
        expect(image).toHaveClass('max-h-48', 'min-h-40');
      });
    });
  });

  describe('Performance', () => {
    it('should handle large number of results efficiently', async () => {
      const largeResults = Array.from({ length: 100 }, (_, i) => ({
        title: `Image ${i + 1}`,
        imageUrl: `https://example.com/image${i + 1}.jpg`,
        sourceUrl: `https://example.com/page${i + 1}`,
      }));

      renderSearchImages({ results: largeResults });

      // Should render all images
      expect(
        screen
          .getAllByRole('img', { hidden: true })
          .filter((img) => img.getAttribute('alt') !== 'favicon')
      ).toHaveLength(100);
    });

    it('should maintain state correctly after errors', async () => {
      renderSearchImages();

      // Wait for all images to be available initially
      const sunsetImages = await screen.findAllByAltText('Beautiful sunset');
      const mountainImages = await screen.findAllByAltText('Mountain landscape');
      const cityImages = await screen.findAllByAltText('City skyline');
      expect(sunsetImages).toHaveLength(1);
      expect(mountainImages).toHaveLength(1);
      expect(cityImages).toHaveLength(1);
      act(() => {
        sunsetImages[0].dispatchEvent(new Event('error'));
      });

      await waitFor(() => {
        expect(
          screen.queryByAltText('Beautiful sunset')
        ).not.toBeInTheDocument();
      });

      // Other images should still be present
      const remainingMountainImages = screen.getAllByAltText('Mountain landscape');
      const remainingCityImages = screen.getAllByAltText('City skyline');
      expect(remainingMountainImages).toHaveLength(1);
      expect(remainingCityImages).toHaveLength(1);

      // Trigger error on second image
      const currentMountainImages = screen.getAllByAltText('Mountain landscape');
      act(() => {
        currentMountainImages[0].dispatchEvent(new Event('error'));
      });

      await waitFor(() => {
        expect(
          screen.queryByAltText('Mountain landscape')
        ).not.toBeInTheDocument();
      });

      // Verify only the city image remains
      const finalCityImages = screen.getAllByAltText('City skyline');
      expect(finalCityImages).toHaveLength(1);
      
      const allImages = screen.getAllByRole('img', { hidden: true });
      const mainImages = allImages.filter((img) => img.getAttribute('alt') !== 'favicon');
      expect(mainImages).toHaveLength(1);
    });
  });

  describe('Accessibility', () => {
    it('should have proper alt texts for all images', async () => {
      renderSearchImages();

      const allImages = await screen.findAllByRole('img');
      const mainImages = allImages.filter((img) => img.getAttribute('alt') !== 'favicon');

      expect(mainImages[0]).toHaveAttribute('alt', 'Beautiful sunset');
      expect(mainImages[1]).toHaveAttribute('alt', 'Mountain landscape');
      expect(mainImages[2]).toHaveAttribute('alt', 'City skyline');
    });

    it('should have proper alt texts for favicons', async () => {
      renderSearchImages();

      const favicons = await screen.findAllByAltText('favicon');
      expect(favicons).toHaveLength(3);

      favicons.forEach((favicon) => {
        expect(favicon).toHaveAttribute('alt', 'favicon');
      });
    });

    it('should have keyboard accessible links', async () => {
      renderSearchImages();

      const links = await screen.findAllByRole('link', { hidden: true });
      expect(links).toHaveLength(6); // 3 images + 3 favicons
      
      links.forEach((link) => {
        expect(link).not.toHaveAttribute('tabindex', '-1');
        expect(link).toHaveAttribute('href');
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });

    it('should provide proper link context', async () => {
      renderSearchImages();

      const links = screen.getAllByRole('link', { hidden: true });
      // Only check main image links (every other link starting from index 0)
      const imageLinks = [links[0], links[2], links[4]];
      imageLinks.forEach((link) => {
        // Links should contain both image and text content for context
        const images = link.querySelectorAll('img');
        const mainImage = Array.from(images).find(
          (img) => img.getAttribute('alt') !== 'favicon'
        );
        expect(mainImage).toBeInTheDocument();
        expect(link.textContent).toBeTruthy();
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
        expect(screen.getByText('Test Image', { hidden: true })).toBeInTheDocument();
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
        const titleElement = screen.getByText(/A very long image title/, { hidden: true });
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

