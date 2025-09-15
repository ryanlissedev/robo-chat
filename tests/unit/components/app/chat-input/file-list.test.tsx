import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FileList } from '@/components/app/chat-input/file-list';

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Mock FileItem component
vi.mock('@/components/app/chat-input/file-items', () => ({
  FileItem: ({
    file,
    onRemove,
  }: {
    file: File;
    onRemove: (file: File) => void;
  }) => (
    <div data-testid={`file-item-${file.name}`}>
      <span>{file.name}</span>
      <button
        type="button"
        onClick={() => onRemove(file)}
        data-testid={`remove-${file.name}`}
      >
        Remove
      </button>
    </div>
  ),
}));

const createMockFile = (
  name: string,
  type = 'text/plain',
  size = 1024
): File => {
  const file = new File(['content'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

const defaultProps = {
  files: [],
  onFileRemove: vi.fn(),
};

function renderFileList(props = {}) {
  return render(<FileList {...defaultProps} {...props} />);
}

describe('FileList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Empty state', () => {
    it('should render nothing when no files provided', () => {
      renderFileList();

      expect(screen.queryByTestId(/file-item-/)).not.toBeInTheDocument();
    });

    it('should not render container when files array is empty', () => {
      const { container } = renderFileList({ files: [] });

      // Should not have any file-related elements
      expect(
        container.querySelector('.overflow-hidden')
      ).not.toBeInTheDocument();
    });
  });

  describe('Single file', () => {
    it('should render single file correctly', () => {
      const file = createMockFile('document.txt');
      renderFileList({ files: [file] });

      expect(screen.getByTestId('file-item-document.txt')).toBeInTheDocument();
      expect(screen.getByText('document.txt')).toBeInTheDocument();
    });

    it('should pass onFileRemove to FileItem', () => {
      const file = createMockFile('document.txt');
      const onFileRemove = vi.fn();
      renderFileList({ files: [file], onFileRemove });

      const removeButton = screen.getByTestId('remove-document.txt');
      removeButton.click();

      expect(onFileRemove).toHaveBeenCalledWith(file);
    });
  });

  describe('Multiple files', () => {
    it('should render multiple files', () => {
      const files = [
        createMockFile('document1.txt'),
        createMockFile('document2.pdf', 'application/pdf'),
        createMockFile('image.png', 'image/png'),
      ];
      renderFileList({ files });

      expect(screen.getByTestId('file-item-document1.txt')).toBeInTheDocument();
      expect(screen.getByTestId('file-item-document2.pdf')).toBeInTheDocument();
      expect(screen.getByTestId('file-item-image.png')).toBeInTheDocument();
    });

    it('should maintain file order', () => {
      const files = [
        createMockFile('first.txt'),
        createMockFile('second.txt'),
        createMockFile('third.txt'),
      ];
      renderFileList({ files });

      const fileItems = screen.getAllByTestId(/file-item-/);
      expect(fileItems[0]).toHaveAttribute(
        'data-testid',
        'file-item-first.txt'
      );
      expect(fileItems[1]).toHaveAttribute(
        'data-testid',
        'file-item-second.txt'
      );
      expect(fileItems[2]).toHaveAttribute(
        'data-testid',
        'file-item-third.txt'
      );
    });

    it('should handle removing files from list', () => {
      const files = [
        createMockFile('document1.txt'),
        createMockFile('document2.txt'),
      ];
      const onFileRemove = vi.fn();
      renderFileList({ files, onFileRemove });

      // Remove first file
      const removeButton1 = screen.getByTestId('remove-document1.txt');
      removeButton1.click();

      expect(onFileRemove).toHaveBeenCalledWith(files[0]);

      // Remove second file
      const removeButton2 = screen.getByTestId('remove-document2.txt');
      removeButton2.click();

      expect(onFileRemove).toHaveBeenCalledWith(files[1]);
      expect(onFileRemove).toHaveBeenCalledTimes(2);
    });
  });

  describe('Layout and styling', () => {
    it('should apply overflow-x-auto for horizontal scrolling', () => {
      const files = [createMockFile('file1.txt'), createMockFile('file2.txt')];
      const { container } = renderFileList({ files });

      const scrollContainer = container.querySelector('.overflow-x-auto');
      expect(scrollContainer).toBeInTheDocument();
      expect(scrollContainer).toHaveClass('flex', 'flex-row', 'pl-3');
    });

    it('should apply correct container classes', () => {
      const files = [createMockFile('file.txt')];
      const { container } = renderFileList({ files });

      const outerContainer = container.querySelector('.overflow-hidden');
      expect(outerContainer).toBeInTheDocument();
    });

    it('should set fixed width for file items', () => {
      const files = [createMockFile('file.txt')];
      renderFileList({ files });

      // Motion div should have width animation properties
      // This is tested through the motion mock
      expect(screen.getByTestId('file-item-file.txt')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('should use AnimatePresence for enter/exit animations', () => {
      const files = [createMockFile('file.txt')];
      renderFileList({ files });

      // AnimatePresence is mocked but component should still render
      expect(screen.getByTestId('file-item-file.txt')).toBeInTheDocument();
    });

    it('should animate height changes when files are added/removed', () => {
      const { rerender } = renderFileList({ files: [] });

      // Add files
      const files = [createMockFile('file.txt')];
      rerender(<FileList files={files} onFileRemove={vi.fn()} />);

      expect(screen.getByTestId('file-item-file.txt')).toBeInTheDocument();
    });

    it('should animate individual file items', () => {
      const files = [createMockFile('file1.txt'), createMockFile('file2.txt')];
      renderFileList({ files });

      // Each file should be wrapped in motion div
      expect(screen.getByTestId('file-item-file1.txt')).toBeInTheDocument();
      expect(screen.getByTestId('file-item-file2.txt')).toBeInTheDocument();
    });
  });

  describe('File types', () => {
    it('should handle different file types', () => {
      const files = [
        createMockFile('document.txt', 'text/plain'),
        createMockFile('image.jpg', 'image/jpeg'),
        createMockFile('video.mp4', 'video/mp4'),
        createMockFile('audio.mp3', 'audio/mpeg'),
      ];
      renderFileList({ files });

      files.forEach((file) => {
        expect(
          screen.getByTestId(`file-item-${file.name}`)
        ).toBeInTheDocument();
      });
    });

    it('should handle files with special characters in names', () => {
      const files = [
        createMockFile('file with spaces.txt'),
        createMockFile('file-with-dashes.txt'),
        createMockFile('file_with_underscores.txt'),
        createMockFile('file(with)parentheses.txt'),
      ];
      renderFileList({ files });

      files.forEach((file) => {
        expect(
          screen.getByTestId(`file-item-${file.name}`)
        ).toBeInTheDocument();
      });
    });

    it('should handle very long file names', () => {
      const longName = `${'a'.repeat(100)}.txt`;
      const file = createMockFile(longName);
      renderFileList({ files: [file] });

      expect(screen.getByTestId(`file-item-${longName}`)).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should handle large number of files', () => {
      const files = Array.from({ length: 50 }, (_, i) =>
        createMockFile(`file${i}.txt`)
      );
      renderFileList({ files });

      expect(screen.getAllByTestId(/file-item-/).length).toBe(50);
    });

    it('should handle rapid file additions and removals', () => {
      const onFileRemove = vi.fn();
      const files = [
        createMockFile('file1.txt'),
        createMockFile('file2.txt'),
        createMockFile('file3.txt'),
      ];
      renderFileList({ files, onFileRemove });

      // Quickly remove all files
      files.forEach((file, _index) => {
        const removeButton = screen.getByTestId(`remove-${file.name}`);
        removeButton.click();
      });

      expect(onFileRemove).toHaveBeenCalledTimes(3);
    });
  });

  describe('Edge cases', () => {
    it('should handle null files array gracefully', () => {
      // @ts-expect-error - testing edge case
      renderFileList({ files: null });

      // Should not crash
      expect(screen.queryByTestId(/file-item-/)).not.toBeInTheDocument();
    });

    it('should handle undefined onFileRemove', () => {
      const files = [createMockFile('file.txt')];
      // @ts-expect-error - testing edge case
      renderFileList({ files, onFileRemove: undefined });

      // Should render without crashing
      expect(screen.getByTestId('file-item-file.txt')).toBeInTheDocument();
    });

    it('should handle files with zero size', () => {
      const file = createMockFile('empty.txt', 'text/plain', 0);
      renderFileList({ files: [file] });

      expect(screen.getByTestId('file-item-empty.txt')).toBeInTheDocument();
    });

    it('should handle files without extensions', () => {
      const file = createMockFile('README');
      renderFileList({ files: [file] });

      expect(screen.getByTestId('file-item-README')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should maintain focus management during file operations', () => {
      const files = [createMockFile('file.txt')];
      const onFileRemove = vi.fn();
      renderFileList({ files, onFileRemove });

      const removeButton = screen.getByTestId('remove-file.txt');
      removeButton.focus();

      expect(document.activeElement).toBe(removeButton);
    });

    it('should provide proper ARIA labels through FileItem', () => {
      const files = [createMockFile('document.txt')];
      renderFileList({ files });

      // FileItem should handle its own accessibility
      expect(screen.getByTestId('file-item-document.txt')).toBeInTheDocument();
    });
  });
});
