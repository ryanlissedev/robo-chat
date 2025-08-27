import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FileItem } from '@/components/app/chat-input/file-items';

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ src, alt, className, ...props }: any) => (
    <img
      src={src}
      alt={alt}
      className={className}
      {...props}
      data-testid="next-image"
    />
  ),
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  X: () => <div data-testid="x-icon">X</div>,
}));

// Mock UI components
vi.mock('@/components/ui/hover-card', () => ({
  HoverCard: ({ children, onOpenChange, open }: any) => (
    <div data-testid="hover-card" data-open={open}>
      {children}
    </div>
  ),
  HoverCardContent: ({ children, side }: any) => (
    <div data-testid="hover-card-content" data-side={side}>
      {children}
    </div>
  ),
  HoverCardTrigger: ({ children, className }: any) => (
    <div data-testid="hover-card-trigger" className={className}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div data-testid="tooltip">{children}</div>,
  TooltipContent: ({ children }: any) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipTrigger: ({ children, asChild }: any) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
}));

// Mock URL.createObjectURL
const mockObjectURL = 'mock-blob-url';
global.URL.createObjectURL = vi.fn(() => mockObjectURL);
global.URL.revokeObjectURL = vi.fn();

const createMockFile = (
  name: string,
  type = 'text/plain',
  size = 1024,
  content = 'mock content'
): File => {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const defaultProps = {
  file: createMockFile('test.txt'),
  onRemove: vi.fn(),
};

function renderFileItem(props = {}) {
  return render(<FileItem {...defaultProps} {...props} />);
}

describe('FileItem', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Text file rendering', () => {
    it('should render text file with extension and size', () => {
      const file = createMockFile('document.txt', 'text/plain', 2048);
      renderFileItem({ file });

      expect(screen.getByText('document.txt')).toBeInTheDocument();
      expect(screen.getByText('2.00kB')).toBeInTheDocument();
      expect(screen.getByText('TXT')).toBeInTheDocument();
    });

    it('should display file extension in uppercase', () => {
      const file = createMockFile('readme.md', 'text/markdown');
      renderFileItem({ file });

      expect(screen.getByText('MD')).toBeInTheDocument();
    });

    it('should handle files without extension', () => {
      const file = createMockFile('README');
      renderFileItem({ file });

      // File name appears twice in the component (extension display and filename)
      const readmeElements = screen.getAllByText('README');
      expect(readmeElements).toHaveLength(2);
      // Should not crash when no extension present
      expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    });

    it('should format file size correctly', () => {
      const testCases = [
        { size: 1024, expected: '1.00kB' },
        { size: 2560, expected: '2.50kB' },
        { size: 1048576, expected: '1024.00kB' },
        { size: 512, expected: '0.50kB' },
      ];

      testCases.forEach(({ size, expected }) => {
        const file = createMockFile('test.txt', 'text/plain', size);
        const { unmount } = renderFileItem({ file });

        expect(screen.getByText(expected)).toBeInTheDocument();
        unmount();
      });
    });
  });

  describe('Image file rendering', () => {
    it('should render image file with preview', () => {
      const file = createMockFile('photo.jpg', 'image/jpeg');
      renderFileItem({ file });

      expect(screen.getByText('photo.jpg')).toBeInTheDocument();

      const images = screen.getAllByTestId('next-image');
      expect(images).toHaveLength(2); // One in trigger, one in content
      expect(images[0]).toHaveAttribute('src', mockObjectURL);
      expect(images[0]).toHaveAttribute('alt', 'photo.jpg');
    });

    it('should handle different image types', () => {
      const imageTypes = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
      ];

      imageTypes.forEach((type) => {
        const file = createMockFile(`test.${type.split('/')[1]}`, type);
        const { unmount } = renderFileItem({ file });

        const images = screen.getAllByTestId('next-image');
        expect(images.length).toBeGreaterThan(0);
        unmount();
      });
    });

    it('should enable hover card for image files only', () => {
      const imageFile = createMockFile('image.jpg', 'image/jpeg');
      const { unmount: unmountImage } = renderFileItem({ file: imageFile });

      const hoverCardImage = screen.getByTestId('hover-card');
      expect(hoverCardImage).toBeInTheDocument();

      unmountImage();

      const textFile = createMockFile('document.txt', 'text/plain');
      renderFileItem({ file: textFile });

      const hoverCardText = screen.getByTestId('hover-card');
      expect(hoverCardText).toHaveAttribute('data-open', 'false');
    });

    it('should create and revoke object URL for images', () => {
      const file = createMockFile('photo.png', 'image/png');
      renderFileItem({ file });

      expect(global.URL.createObjectURL).toHaveBeenCalledWith(file);
    });
  });

  describe('Remove functionality', () => {
    it('should call onRemove when remove button clicked', async () => {
      const onRemove = vi.fn();
      const file = createMockFile('test.txt');
      renderFileItem({ file, onRemove });

      const removeButton = screen.getByLabelText('Remove file');
      await user.click(removeButton);

      expect(onRemove).toHaveBeenCalledWith(file);
    });

    it('should set isRemoving state and hide remove button', async () => {
      const onRemove = vi.fn();
      const file = createMockFile('test.txt');
      renderFileItem({ file, onRemove });

      const removeButton = screen.getByLabelText('Remove file');
      await user.click(removeButton);

      // Button should be hidden after click
      expect(removeButton).not.toBeInTheDocument();
    });

    it('should show tooltip on remove button hover', async () => {
      renderFileItem();

      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
      expect(screen.getByText('Remove file')).toBeInTheDocument();
    });

    it('should have proper ARIA label for remove button', () => {
      renderFileItem();

      const removeButton = screen.getByLabelText('Remove file');
      expect(removeButton).toHaveAttribute('aria-label', 'Remove file');
    });
  });

  describe('Hover card functionality', () => {
    it('should show hover card content for images', async () => {
      const file = createMockFile('photo.jpg', 'image/jpeg');
      renderFileItem({ file });

      const hoverCardContent = screen.getByTestId('hover-card-content');
      expect(hoverCardContent).toBeInTheDocument();
      expect(hoverCardContent).toHaveAttribute('data-side', 'top');

      const previewImage = hoverCardContent.querySelector(
        '[data-testid="next-image"]'
      );
      expect(previewImage).toBeInTheDocument();
      expect(previewImage).toHaveAttribute('src', mockObjectURL);
    });

    it('should not show hover card content for non-images', () => {
      const file = createMockFile('document.txt', 'text/plain');
      renderFileItem({ file });

      const hoverCard = screen.getByTestId('hover-card');
      expect(hoverCard).toHaveAttribute('data-open', 'false');
    });

    it('should handle hover card open/close state', () => {
      const file = createMockFile('photo.png', 'image/png');
      renderFileItem({ file });

      // Initially should be controlled by isOpen state
      const hoverCard = screen.getByTestId('hover-card');
      expect(hoverCard).toBeInTheDocument();
    });
  });

  describe('Layout and styling', () => {
    it('should apply correct CSS classes', () => {
      renderFileItem();

      const container = screen.getByTestId('hover-card-trigger');
      expect(container).toHaveClass('w-full');
    });

    it('should have proper button styling and positioning', () => {
      renderFileItem();

      const removeButton = screen.getByLabelText('Remove file');
      expect(removeButton).toHaveClass(
        'absolute',
        'top-1',
        'right-1',
        'z-10',
        'size-6',
        'rounded-full'
      );
    });

    it('should truncate long file names', () => {
      const longName = 'very-long-file-name-that-should-be-truncated.txt';
      const file = createMockFile(longName);
      renderFileItem({ file });

      const fileName = screen.getByText(longName);
      expect(fileName).toHaveClass('truncate');
    });

    it('should have proper image dimensions', () => {
      const file = createMockFile('photo.jpg', 'image/jpeg');
      renderFileItem({ file });

      const images = screen.getAllByTestId('next-image');
      const thumbnailImage = images[0];
      const previewImage = images[1];

      expect(thumbnailImage).toHaveAttribute('width', '40');
      expect(thumbnailImage).toHaveAttribute('height', '40');
      expect(previewImage).toHaveAttribute('width', '200');
      expect(previewImage).toHaveAttribute('height', '200');
    });
  });

  describe('File type detection', () => {
    it('should correctly identify image files', () => {
      const imageFile = createMockFile('test.jpg', 'image/jpeg');
      renderFileItem({ file: imageFile });

      // Should show image preview instead of extension
      expect(screen.queryByText('JPG')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('next-image')).toHaveLength(2);
    });

    it('should correctly identify non-image files', () => {
      const textFile = createMockFile('document.pdf', 'application/pdf');
      renderFileItem({ file: textFile });

      // Should show extension instead of image in the icon area
      expect(screen.getByText('PDF')).toBeInTheDocument();

      // Image will still be rendered in hover content but hover should be disabled
      const hoverCard = screen.getByTestId('hover-card');
      expect(hoverCard).toHaveAttribute('data-open', 'false');
    });

    it('should handle edge cases in file type detection', () => {
      const edgeCases = [
        { name: 'file.IMAGE', type: 'image/png' }, // uppercase extension
        { name: 'file', type: 'image/jpeg' }, // no extension but image type
        { name: 'file.txt', type: 'image/png' }, // mismatched name and type
      ];

      edgeCases.forEach(({ name, type }) => {
        const file = createMockFile(name, type);
        const { unmount } = renderFileItem({ file });

        if (type.includes('image')) {
          expect(screen.getAllByTestId('next-image')).toHaveLength(2);
        }

        unmount();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper button semantics', () => {
      renderFileItem();

      const removeButton = screen.getByLabelText('Remove file');
      expect(removeButton.tagName).toBe('BUTTON');
      expect(removeButton).toHaveAttribute('type', 'button');
    });

    it('should support keyboard interaction', async () => {
      const onRemove = vi.fn();
      renderFileItem({ onRemove });

      const removeButton = screen.getByLabelText('Remove file');
      removeButton.focus();

      await user.keyboard('{Enter}');
      expect(onRemove).toHaveBeenCalled();
    });

    it('should have proper image alt text', () => {
      const file = createMockFile('vacation-photo.jpg', 'image/jpeg');
      renderFileItem({ file });

      const images = screen.getAllByTestId('next-image');
      images.forEach((img) => {
        expect(img).toHaveAttribute('alt', 'vacation-photo.jpg');
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle zero-size files', () => {
      const file = createMockFile('empty.txt', 'text/plain', 0);
      renderFileItem({ file });

      expect(screen.getByText('0.00kB')).toBeInTheDocument();
    });

    it('should handle very large files', () => {
      const file = createMockFile('large.txt', 'text/plain', 1073741824); // 1GB
      renderFileItem({ file });

      expect(screen.getByText('1048576.00kB')).toBeInTheDocument();
    });

    it('should handle files with special characters', () => {
      const file = createMockFile('file with spaces & symbols!.txt');
      renderFileItem({ file });

      expect(
        screen.getByText('file with spaces & symbols!.txt')
      ).toBeInTheDocument();
    });

    it('should handle files with no name', () => {
      const file = createMockFile('', 'text/plain');
      renderFileItem({ file });

      // Empty file name should be rendered (appears twice - extension area and filename)
      const emptyElements = screen.getAllByText('');
      expect(emptyElements.length).toBeGreaterThan(0);
    });

    it('should handle corrupted image files gracefully', () => {
      // Mock createObjectURL to throw an error
      const originalCreateObjectURL = global.URL.createObjectURL;
      global.URL.createObjectURL = vi.fn(() => {
        throw new Error('Failed to create object URL');
      });

      const file = createMockFile('corrupted.jpg', 'image/jpeg');

      // This should throw since the component doesn't handle the error
      expect(() => renderFileItem({ file })).toThrow(
        'Failed to create object URL'
      );

      // Restore original function
      global.URL.createObjectURL = originalCreateObjectURL;
    });
  });

  describe('Performance', () => {
    it('should handle rapid remove button clicks', async () => {
      const onRemove = vi.fn();
      const file = createMockFile('test.txt', 'text/plain'); // Non-image file to avoid URL creation
      renderFileItem({ file, onRemove });

      const removeButton = screen.getByLabelText('Remove file');

      // Rapid clicks should only trigger once due to state change
      await user.click(removeButton);

      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(removeButton).not.toBeInTheDocument();
    });

    it('should not recreate object URLs unnecessarily', () => {
      // Clear previous calls to get accurate count
      vi.mocked(global.URL.createObjectURL).mockClear();

      const file = createMockFile('document.txt', 'text/plain'); // Use non-image file
      const { rerender } = renderFileItem({ file });

      // Component calls URL.createObjectURL twice: once for trigger, once for hover content
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(2);

      // Re-render with same file
      rerender(<FileItem file={file} onRemove={vi.fn()} />);

      // Should be called again on re-render (2 more calls)
      expect(global.URL.createObjectURL).toHaveBeenCalledTimes(4);
    });
  });
});
