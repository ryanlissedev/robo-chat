/**
 * Comprehensive unit tests for Loader component
 * Ensuring 100% test coverage for production validation
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Loader } from '@/components/ai-elements/loader';

describe('Loader Component', () => {
  it('should render loader with default props', () => {
    const { container } = render(<Loader />);
    
    const loaderDiv = container.firstChild as HTMLElement;
    expect(loaderDiv).toHaveClass('inline-flex', 'animate-spin', 'items-center', 'justify-center');
    
    const svg = loaderDiv.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '16');
    expect(svg).toHaveAttribute('height', '16');
    expect(svg).toHaveAttribute('viewBox', '0 0 16 16');
  });

  it('should render loader with custom size', () => {
    const { container } = render(<Loader size={32} />);
    
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveAttribute('height', '32');
  });

  it('should apply custom className', () => {
    const { container } = render(<Loader className="custom-loader-class" />);
    
    const loaderDiv = container.firstChild as HTMLElement;
    expect(loaderDiv).toHaveClass('custom-loader-class');
    expect(loaderDiv).toHaveClass('inline-flex', 'animate-spin', 'items-center', 'justify-center');
  });

  it('should forward additional props to div element', () => {
    const { container } = render(
      <Loader data-testid="loader" aria-label="Loading content" />
    );
    
    const loaderDiv = container.firstChild as HTMLElement;
    expect(loaderDiv).toHaveAttribute('data-testid', 'loader');
    expect(loaderDiv).toHaveAttribute('aria-label', 'Loading content');
  });

  it('should render svg with all required paths', () => {
    const { container } = render(<Loader />);
    
    const svg = container.querySelector('svg');
    const paths = svg?.querySelectorAll('path');
    
    expect(paths).toHaveLength(10);
    
    // Check that paths have different opacity values for animation effect
    const opacities = Array.from(paths || []).map(path => 
      path.getAttribute('opacity')
    );
    
    expect(opacities).toContain('0.5');
    expect(opacities).toContain('0.9');
    expect(opacities).toContain('0.1');
    expect(opacities).toContain('0.4');
    expect(opacities).toContain('0.6');
  });

  it('should have accessible title', () => {
    const { container } = render(<Loader />);
    
    const title = container.querySelector('title');
    expect(title).toHaveTextContent('Loader');
  });

  it('should render with clipPath defined', () => {
    const { container } = render(<Loader />);
    
    const clipPath = container.querySelector('clipPath');
    expect(clipPath).toBeInTheDocument();
    expect(clipPath).toHaveAttribute('id', 'clip0_2393_1490');
    
    const rect = clipPath?.querySelector('rect');
    expect(rect).toHaveAttribute('fill', 'white');
    expect(rect).toHaveAttribute('height', '16');
    expect(rect).toHaveAttribute('width', '16');
  });

  it('should use currentcolor for stroke', () => {
    const { container } = render(<Loader />);
    
    const svg = container.querySelector('svg');
    expect(svg).toHaveStyle({ color: 'currentcolor' });
    
    const paths = svg?.querySelectorAll('path');
    paths?.forEach(path => {
      expect(path).toHaveAttribute('stroke', 'currentColor');
      expect(path).toHaveAttribute('strokeWidth', '1.5');
    });
  });

  it('should render with correct strokeLinejoin', () => {
    const { container } = render(<Loader />);
    
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('strokeLinejoin', 'round');
  });

  it('should handle zero size', () => {
    const { container } = render(<Loader size={0} />);
    
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '0');
    expect(svg).toHaveAttribute('height', '0');
  });

  it('should handle large size', () => {
    const { container } = render(<Loader size={100} />);
    
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '100');
    expect(svg).toHaveAttribute('height', '100');
  });

  it('should combine custom className with default classes', () => {
    const { container } = render(<Loader className="text-red-500 bg-blue-100" />);
    
    const loaderDiv = container.firstChild as HTMLElement;
    expect(loaderDiv).toHaveClass('text-red-500', 'bg-blue-100');
    expect(loaderDiv).toHaveClass('inline-flex', 'animate-spin', 'items-center', 'justify-center');
  });

  it('should handle id prop', () => {
    const { container } = render(<Loader id="my-loader" />);
    
    const loaderDiv = container.firstChild as HTMLElement;
    expect(loaderDiv).toHaveAttribute('id', 'my-loader');
  });

  it('should handle onClick prop', () => {
    const handleClick = vi.fn();
    const { container } = render(<Loader onClick={handleClick} />);
    
    const loaderDiv = container.firstChild as HTMLElement;
    loaderDiv.click();
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should handle style prop', () => {
    const { container } = render(<Loader style={{ backgroundColor: 'red' }} />);
    
    const loaderDiv = container.firstChild as HTMLElement;
    expect(loaderDiv).toHaveStyle({ backgroundColor: 'red' });
  });

  it('should render multiple loaders independently', () => {
    const { container } = render(
      <div>
        <Loader size={16} className="loader-1" />
        <Loader size={24} className="loader-2" />
      </div>
    );
    
    const loaders = container.querySelectorAll('.inline-flex');
    expect(loaders).toHaveLength(2);
    
    const firstSvg = loaders[0].querySelector('svg');
    const secondSvg = loaders[1].querySelector('svg');
    
    expect(firstSvg).toHaveAttribute('width', '16');
    expect(secondSvg).toHaveAttribute('width', '24');
  });

  it('should have correct display name for debugging', () => {
    expect(Loader.displayName).toBe('Loader');
  });
});