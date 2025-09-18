import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the cn utility function (London School: mock dependencies)
// Note: Mock must be hoisted to avoid reference errors
vi.mock('@/lib/utils', () => ({
  cn: vi.fn(),
}));

import { TextShimmer } from '@/components/ui/text-shimmer';
import { cn } from '@/lib/utils';

// Get reference to the mocked function
const mockCn = vi.mocked(cn);

describe('TextShimmer', () => {
  beforeEach(() => {
    // Reset mock state before each test
    mockCn.mockClear();
    // Default implementation returns merged classes
    mockCn.mockImplementation((...classes) => classes.filter(Boolean).join(' '));
  });

  describe('Text Content Rendering', () => {
    it('should render the provided text content', () => {
      const testText = 'Shimmering text content';

      render(<TextShimmer>{testText}</TextShimmer>);

      expect(screen.getByText(testText)).toBeInTheDocument();
    });

    it('should render text content as children', () => {
      const testText = 'Loading amazing content...';

      render(
        <TextShimmer>
          {testText}
        </TextShimmer>
      );

      expect(screen.getByText(testText)).toBeInTheDocument();
    });

    it('should handle empty text content gracefully', () => {
      render(<TextShimmer></TextShimmer>);

      // Component should still render the container
      expect(screen.getByTestId('text-shimmer')).toBeInTheDocument();
    });
  });

  describe('Shimmer Animation Classes', () => {
    it('should apply default shimmer animation classes', () => {
      const expectedClasses = 'relative overflow-hidden text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-clip-text animate-shimmer';
      mockCn.mockReturnValue(expectedClasses);

      render(<TextShimmer>Test text</TextShimmer>);

      const shimmerElement = screen.getByTestId('text-shimmer');
      expect(shimmerElement).toHaveClass(expectedClasses);

      // Verify cn was called with the base shimmer classes
      expect(mockCn).toHaveBeenCalledWith(
        'relative overflow-hidden text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-clip-text animate-shimmer',
        undefined
      );
    });

    it('should include shimmer animation keyframe class', () => {
      render(<TextShimmer>Loading...</TextShimmer>);

      // Verify the animate-shimmer class is in the call to cn
      expect(mockCn).toHaveBeenCalledWith(
        expect.stringContaining('animate-shimmer'),
        undefined
      );
    });

    it('should apply gradient background classes for shimmer effect', () => {
      render(<TextShimmer>Content</TextShimmer>);

      const expectedCall = expect.stringMatching(/bg-gradient-to-r.*from-gray-200.*via-gray-100.*to-gray-200/);
      expect(mockCn).toHaveBeenCalledWith(expectedCall, undefined);
    });
  });

  describe('Custom ClassName Prop', () => {
    it('should accept and merge custom className', () => {
      const customClass = 'text-lg font-bold';
      const mergedClasses = 'relative overflow-hidden text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-clip-text animate-shimmer text-lg font-bold';

      mockCn.mockReturnValue(mergedClasses);

      render(<TextShimmer className={customClass}>Custom styled text</TextShimmer>);

      const shimmerElement = screen.getByTestId('text-shimmer');
      expect(shimmerElement).toHaveClass(mergedClasses);

      // Verify cn was called with both base classes and custom className
      expect(mockCn).toHaveBeenCalledWith(
        'relative overflow-hidden text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-clip-text animate-shimmer',
        customClass
      );
    });

    it('should handle undefined className gracefully', () => {
      render(<TextShimmer className={undefined}>Text</TextShimmer>);

      expect(mockCn).toHaveBeenCalledWith(
        'relative overflow-hidden text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-clip-text animate-shimmer',
        undefined
      );
    });

    it('should handle empty string className', () => {
      render(<TextShimmer className="">Text</TextShimmer>);

      expect(mockCn).toHaveBeenCalledWith(
        'relative overflow-hidden text-transparent bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-clip-text animate-shimmer',
        ''
      );
    });
  });

  describe('Component Structure and Accessibility', () => {
    it('should render as a span element with proper test id', () => {
      render(<TextShimmer>Accessible content</TextShimmer>);

      const shimmerElement = screen.getByTestId('text-shimmer');
      expect(shimmerElement.tagName).toBe('SPAN');
    });

    it('should pass through additional props to the span element', () => {
      render(
        <TextShimmer aria-label="Loading content" data-loading="true">
          Content
        </TextShimmer>
      );

      const shimmerElement = screen.getByTestId('text-shimmer');
      expect(shimmerElement).toHaveAttribute('aria-label', 'Loading content');
      expect(shimmerElement).toHaveAttribute('data-loading', 'true');
    });

    it('should support role attribute for accessibility', () => {
      render(<TextShimmer role="status">Loading status</TextShimmer>);

      const shimmerElement = screen.getByTestId('text-shimmer');
      expect(shimmerElement).toHaveAttribute('role', 'status');
    });
  });

  describe('Mock Behavior Verification (London School)', () => {
    it('should verify cn utility is called exactly once per render', () => {
      render(<TextShimmer>Mock verification test</TextShimmer>);

      expect(mockCn).toHaveBeenCalledTimes(1);
    });

    it('should verify interaction pattern with cn utility', () => {
      const customClass = 'custom-shimmer-style';

      render(<TextShimmer className={customClass}>Interaction test</TextShimmer>);

      // Verify the contract/interaction with the cn utility
      expect(mockCn).toHaveBeenCalledWith(
        expect.stringContaining('animate-shimmer'),
        customClass
      );
      expect(mockCn).toHaveBeenCalledTimes(1);
    });
  });
});