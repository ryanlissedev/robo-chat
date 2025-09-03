/**
 * Comprehensive unit tests for Image component
 * Ensuring 100% test coverage for production validation
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Image } from '@/components/ai-elements/image';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, width, height, className, ...props }: any) => (
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      {...props}
    />
  ),
}));

describe('Image Component', () => {
  const sampleImageData = {
    base64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    mediaType: 'image/png',
  };

  it('should render with required props', () => {
    const { container } = render(
      <Image {...sampleImageData} />
    );

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', `data:${sampleImageData.mediaType};base64,${sampleImageData.base64}`);
    expect(img).toHaveAttribute('alt', 'Generated image');
    expect(img).toHaveAttribute('width', '512');
    expect(img).toHaveAttribute('height', '512');
  });

  it('should apply default styling classes', () => {
    const { container } = render(
      <Image {...sampleImageData} />
    );

    const img = container.querySelector('img');
    expect(img).toHaveClass(
      'h-auto',
      'max-w-full',
      'overflow-hidden',
      'rounded-md'
    );
  });

  it('should use custom alt text when provided', () => {
    const customAlt = 'A beautiful landscape painting';
    const { container } = render(
      <Image {...sampleImageData} alt={customAlt} />
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('alt', customAlt);
  });

  it('should apply custom className', () => {
    const { container } = render(
      <Image {...sampleImageData} className="custom-image-class" />
    );

    const img = container.querySelector('img');
    expect(img).toHaveClass('custom-image-class');
    expect(img).toHaveClass(
      'h-auto',
      'max-w-full',
      'overflow-hidden',
      'rounded-md'
    );
  });

  it('should combine custom className with default classes', () => {
    const { container } = render(
      <Image {...sampleImageData} className="border-2 border-red-500 shadow-lg" />
    );

    const img = container.querySelector('img');
    expect(img).toHaveClass(
      'border-2',
      'border-red-500',
      'shadow-lg',
      'h-auto',
      'max-w-full',
      'overflow-hidden',
      'rounded-md'
    );
  });

  it('should handle different media types', () => {
    const jpegImageData = {
      ...sampleImageData,
      mediaType: 'image/jpeg',
    };

    const { container } = render(
      <Image {...jpegImageData} />
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,' + jpegImageData.base64);
  });

  it('should handle different base64 data', () => {
    const differentImageData = {
      base64: 'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      mediaType: 'image/gif',
    };

    const { container } = render(
      <Image {...differentImageData} />
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', `data:${differentImageData.mediaType};base64,${differentImageData.base64}`);
  });

  it('should pass through additional Next.js Image props', () => {
    const { container } = render(
      <Image
        {...sampleImageData}
        priority={true}
        loading="eager"
        quality={90}
        placeholder="blur"
      />
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('loading', 'eager');
  });

  it('should handle id prop', () => {
    const { container } = render(
      <Image {...sampleImageData} id="custom-image-id" />
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('id', 'custom-image-id');
  });

  it('should handle data attributes', () => {
    const { container } = render(
      <Image {...sampleImageData} data-testid="generated-image" />
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('data-testid', 'generated-image');
  });

  it('should handle onClick handler', () => {
    const handleClick = vi.fn();
    const { container } = render(
      <Image {...sampleImageData} onClick={handleClick} />
    );

    const img = container.querySelector('img')!;
    img.click();

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should handle onLoad handler', () => {
    const handleLoad = vi.fn();
    const { container } = render(
      <Image {...sampleImageData} onLoad={handleLoad} />
    );

    const img = container.querySelector('img')!;
    // Simulate image load event
    const loadEvent = new Event('load');
    img.dispatchEvent(loadEvent);

    expect(handleLoad).toHaveBeenCalledTimes(1);
  });

  it('should handle onError handler', () => {
    const handleError = vi.fn();
    const { container } = render(
      <Image {...sampleImageData} onError={handleError} />
    );

    const img = container.querySelector('img')!;
    // Simulate image error event
    const errorEvent = new Event('error');
    img.dispatchEvent(errorEvent);

    expect(handleError).toHaveBeenCalledTimes(1);
  });

  it('should handle style prop', () => {
    const { container } = render(
      <Image
        {...sampleImageData}
        style={{ border: '2px solid red', opacity: 0.8 }}
      />
    );

    const img = container.querySelector('img');
    expect(img).toHaveStyle({ border: '2px solid red', opacity: '0.8' });
  });

  it('should handle title attribute', () => {
    const { container } = render(
      <Image {...sampleImageData} title="Hover tooltip" />
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('title', 'Hover tooltip');
  });

  it('should handle draggable attribute', () => {
    const { container } = render(
      <Image {...sampleImageData} draggable={false} />
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('draggable', 'false');
  });

  it('should handle complex base64 data', () => {
    const complexImageData = {
      base64: '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=',
      mediaType: 'image/jpeg',
    };

    const { container } = render(
      <Image {...complexImageData} />
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', `data:${complexImageData.mediaType};base64,${complexImageData.base64}`);
  });

  describe('Edge Cases', () => {
    it('should handle empty base64 string', () => {
      const emptyImageData = {
        base64: '',
        mediaType: 'image/png',
      };

      const { container } = render(
        <Image {...emptyImageData} />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'data:image/png;base64,');
    });

    it('should handle empty media type', () => {
      const noMediaTypeData = {
        base64: sampleImageData.base64,
        mediaType: '',
      };

      const { container } = render(
        <Image {...noMediaTypeData} />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', `data:;base64,${sampleImageData.base64}`);
    });

    it('should handle special characters in base64', () => {
      const specialBase64Data = {
        base64: 'ABC123+/=def456+/=',
        mediaType: 'image/png',
      };

      const { container } = render(
        <Image {...specialBase64Data} />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'data:image/png;base64,ABC123+/=def456+/=');
    });

    it('should override className properly', () => {
      const { container } = render(
        <Image {...sampleImageData} className="w-full h-full" />
      );

      const img = container.querySelector('img');
      // Should have both default classes and custom classes
      expect(img).toHaveClass('w-full', 'h-full', 'h-auto', 'max-w-full', 'overflow-hidden', 'rounded-md');
    });

    it('should handle webp media type', () => {
      const webpImageData = {
        base64: sampleImageData.base64,
        mediaType: 'image/webp',
      };

      const { container } = render(
        <Image {...webpImageData} />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'data:image/webp;base64,' + sampleImageData.base64);
    });

    it('should handle avif media type', () => {
      const avifImageData = {
        base64: sampleImageData.base64,
        mediaType: 'image/avif',
      };

      const { container } = render(
        <Image {...avifImageData} />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'data:image/avif;base64,' + sampleImageData.base64);
    });

    it('should handle svg media type', () => {
      const svgImageData = {
        base64: btoa('<svg><rect width="100" height="100" /></svg>'),
        mediaType: 'image/svg+xml',
      };

      const { container } = render(
        <Image {...svgImageData} />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('src', `data:image/svg+xml;base64,${svgImageData.base64}`);
    });
  });

  describe('Accessibility', () => {
    it('should have proper alt text for screen readers', () => {
      const { container } = render(
        <Image {...sampleImageData} alt="AI generated artwork of mountains" />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('alt', 'AI generated artwork of mountains');
    });

    it('should use default alt text when not provided', () => {
      const { container } = render(
        <Image {...sampleImageData} />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('alt', 'Generated image');
    });

    it('should handle empty alt text for decorative images', () => {
      const { container } = render(
        <Image {...sampleImageData} alt="" />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('alt', '');
    });

    it('should handle role attribute', () => {
      const { container } = render(
        <Image {...sampleImageData} role="img" />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('role', 'img');
    });

    it('should handle aria-label', () => {
      const { container } = render(
        <Image {...sampleImageData} aria-label="Custom aria label" />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('aria-label', 'Custom aria label');
    });

    it('should handle aria-describedby', () => {
      const { container } = render(
        <Image {...sampleImageData} aria-describedby="image-description" />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('aria-describedby', 'image-description');
    });
  });

  describe('Performance', () => {
    it('should handle loading attribute', () => {
      const { container } = render(
        <Image {...sampleImageData} loading="lazy" />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('loading', 'lazy');
    });

    it('should handle decoding attribute', () => {
      const { container } = render(
        <Image {...sampleImageData} decoding="async" />
      );

      const img = container.querySelector('img');
      expect(img).toHaveAttribute('decoding', 'async');
    });
  });
});