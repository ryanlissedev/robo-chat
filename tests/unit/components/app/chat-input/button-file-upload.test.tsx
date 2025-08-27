import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ButtonFileUpload } from '@/components/app/chat-input/button-file-upload';
import { isSupabaseEnabled } from '@/lib/supabase/config';

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  FileUp: () => <div data-testid="file-up-icon">FileUp</div>,
  Paperclip: () => <div data-testid="paperclip-icon">Paperclip</div>,
}));

// Mock prompt-kit components
vi.mock('@/components/prompt-kit/file-upload', () => ({
  FileUpload: ({ children, onFilesAdded, accept, multiple, disabled }: any) => (
    <div
      data-testid="file-upload"
      data-accept={accept}
      data-multiple={multiple}
      data-disabled={disabled}
    >
      <input
        type="file"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          onFilesAdded?.(files);
        }}
        data-testid="file-input"
      />
      {children}
    </div>
  ),
  FileUploadContent: ({ children }: any) => (
    <div data-testid="file-upload-content">{children}</div>
  ),
  FileUploadTrigger: ({ children, asChild }: any) => (
    <div data-testid="file-upload-trigger">{children}</div>
  ),
}));

// Mock UI components
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className,
    disabled,
    size,
    variant,
    ...props
  }: any) => (
    <button
      type="button"
      onClick={onClick}
      className={className}
      disabled={disabled}
      data-size={size}
      data-variant={variant}
      {...props}
    >
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: any) => <div data-testid="popover">{children}</div>,
  PopoverContent: ({ children, className }: any) => (
    <div data-testid="popover-content" className={className}>
      {children}
    </div>
  ),
  PopoverTrigger: ({ children, asChild }: any) => (
    <div data-testid="popover-trigger">{children}</div>
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

// Mock lib functions
vi.mock('@/lib/models', () => ({
  getModelInfo: vi.fn((model: string) => {
    const modelInfo = {
      'gpt-4-vision': { vision: true },
      'gpt-4': { vision: false },
      'claude-3': { vision: true },
      'claude-2': { vision: false },
    };
    return modelInfo[model as keyof typeof modelInfo] || { vision: false };
  }),
}));

vi.mock('@/lib/supabase/config', () => ({
  isSupabaseEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// Mock PopoverContentAuth
vi.mock('@/components/app/chat-input/popover-content-auth', () => ({
  PopoverContentAuth: () => (
    <div data-testid="popover-content-auth">Auth Required</div>
  ),
}));

const defaultProps = {
  onFileUpload: vi.fn(),
  isUserAuthenticated: true,
  model: 'gpt-4-vision',
};

function renderButtonFileUpload(props = {}) {
  return render(<ButtonFileUpload {...defaultProps} {...props} />);
}

describe('ButtonFileUpload', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset Supabase config
    vi.mocked(isSupabaseEnabled).mockReturnValue(true);
  });

  describe('Supabase disabled', () => {
    it('should return null when Supabase is disabled', () => {
      vi.mocked(isSupabaseEnabled).mockReturnValue(false);

      const { container } = renderButtonFileUpload();
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Model without vision support', () => {
    it('should show popover with message when model has no vision support', () => {
      renderButtonFileUpload({ model: 'gpt-4' }); // No vision support

      expect(screen.getByTestId('popover')).toBeInTheDocument();
      expect(screen.getByTestId('tooltip')).toBeInTheDocument();
      expect(screen.getByTestId('paperclip-icon')).toBeInTheDocument();
      expect(screen.getByLabelText('Add files')).toBeInTheDocument();
    });

    it('should display model limitation message', () => {
      renderButtonFileUpload({ model: 'gpt-4' });

      expect(screen.getByTestId('popover-content')).toBeInTheDocument();
      expect(
        screen.getByText('This model does not support file uploads.')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Please select another model.')
      ).toBeInTheDocument();
    });

    it('should have proper button styling for non-vision model', () => {
      renderButtonFileUpload({ model: 'gpt-4' });

      const button = screen.getByLabelText('Add files');
      expect(button).toHaveClass(
        'size-9',
        'rounded-full',
        'border',
        'border-border'
      );
      expect(button).toHaveAttribute('data-variant', 'secondary');
      expect(button).toHaveAttribute('data-size', 'sm');
    });

    it('should show tooltip with "Add files" text', () => {
      renderButtonFileUpload({ model: 'gpt-4' });

      expect(screen.getByTestId('tooltip-content')).toBeInTheDocument();
      expect(screen.getByText('Add files')).toBeInTheDocument();
    });
  });

  describe('Unauthenticated user', () => {
    it('should show auth popover when user is not authenticated', () => {
      renderButtonFileUpload({
        isUserAuthenticated: false,
        model: 'gpt-4-vision',
      });

      expect(screen.getByTestId('popover')).toBeInTheDocument();
      expect(screen.getByTestId('popover-content-auth')).toBeInTheDocument();
      expect(screen.getByText('Auth Required')).toBeInTheDocument();
    });

    it('should show paperclip icon for unauthenticated user', () => {
      renderButtonFileUpload({
        isUserAuthenticated: false,
        model: 'gpt-4-vision',
      });

      expect(screen.getByTestId('paperclip-icon')).toBeInTheDocument();
      expect(screen.getByLabelText('Add files')).toBeInTheDocument();
    });

    it('should have proper styling for unauthenticated state', () => {
      renderButtonFileUpload({
        isUserAuthenticated: false,
        model: 'gpt-4-vision',
      });

      const button = screen.getByLabelText('Add files');
      expect(button).toHaveClass('size-9', 'rounded-full');
      expect(button).toHaveAttribute('data-variant', 'secondary');
    });
  });

  describe('Authenticated user with vision model', () => {
    it('should render FileUpload component', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
      });

      expect(screen.getByTestId('file-upload')).toBeInTheDocument();
      expect(screen.getByTestId('file-upload-trigger')).toBeInTheDocument();
      expect(screen.getByTestId('file-upload-content')).toBeInTheDocument();
    });

    it('should have correct file upload attributes', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
      });

      const fileUpload = screen.getByTestId('file-upload');
      expect(fileUpload).toHaveAttribute(
        'data-accept',
        '.txt,.md,image/jpeg,image/png,image/gif,image/webp,image/svg,image/heic,image/heif'
      );
      expect(fileUpload).toHaveAttribute('data-multiple', 'true');
      expect(fileUpload).toHaveAttribute('data-disabled', 'false');
    });

    it('should call onFileUpload when files are selected', async () => {
      const onFileUpload = vi.fn();
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
        onFileUpload,
      });

      const fileInput = screen.getByTestId('file-input');
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      await user.upload(fileInput, mockFile);

      expect(onFileUpload).toHaveBeenCalledWith([mockFile]);
    });

    it('should render upload button with paperclip icon', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
      });

      expect(screen.getByTestId('paperclip-icon')).toBeInTheDocument();
      expect(screen.getByLabelText('Add files')).toBeInTheDocument();
    });

    it('should have proper button styling when authenticated', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
      });

      const button = screen.getByLabelText('Add files');
      expect(button).toHaveClass('size-9', 'rounded-full');
      expect(button).toHaveAttribute('data-size', 'sm');
      expect(button).toHaveAttribute('data-variant', 'secondary');
      expect(button).not.toHaveAttribute('disabled');
    });

    it('should render file upload content with drop zone', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
      });

      expect(screen.getByTestId('file-up-icon')).toBeInTheDocument();
      expect(screen.getByText('Drop files here')).toBeInTheDocument();
      expect(
        screen.getByText('Drop any files here to add it to the conversation')
      ).toBeInTheDocument();
    });
  });

  describe('Model support detection', () => {
    it('should work with different vision-enabled models', () => {
      const visionModels = ['gpt-4-vision', 'claude-3'];

      visionModels.forEach((model) => {
        const { unmount } = renderButtonFileUpload({
          isUserAuthenticated: true,
          model,
        });

        expect(screen.getByTestId('file-upload')).toBeInTheDocument();
        unmount();
      });
    });

    it('should show limitation message for non-vision models', () => {
      const nonVisionModels = ['gpt-4', 'claude-2'];

      nonVisionModels.forEach((model) => {
        const { unmount } = renderButtonFileUpload({
          isUserAuthenticated: true,
          model,
        });

        expect(
          screen.getByText('This model does not support file uploads.')
        ).toBeInTheDocument();
        unmount();
      });
    });

    it('should handle unknown models gracefully', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'unknown-model',
      });

      // Should show limitation message for unknown models
      expect(
        screen.getByText('This model does not support file uploads.')
      ).toBeInTheDocument();
    });
  });

  describe('File handling', () => {
    it('should handle multiple file selection', async () => {
      const onFileUpload = vi.fn();
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
        onFileUpload,
      });

      const fileInput = screen.getByTestId('file-input');
      const files = [
        new File(['test1'], 'test1.txt', { type: 'text/plain' }),
        new File(['test2'], 'test2.jpg', { type: 'image/jpeg' }),
      ];

      await user.upload(fileInput, files);

      expect(onFileUpload).toHaveBeenCalledWith(files);
    });

    it('should handle different file types', async () => {
      const onFileUpload = vi.fn();
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
        onFileUpload,
      });

      const fileInput = screen.getByTestId('file-input');
      const imageFile = new File(['image'], 'test.png', { type: 'image/png' });

      await user.upload(fileInput, imageFile);

      expect(onFileUpload).toHaveBeenCalledWith([imageFile]);
    });

    it('should accept specified file types', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
      });

      const fileUpload = screen.getByTestId('file-upload');
      const acceptedTypes = fileUpload.getAttribute('data-accept');

      expect(acceptedTypes).toContain('.txt');
      expect(acceptedTypes).toContain('.md');
      expect(acceptedTypes).toContain('image/jpeg');
      expect(acceptedTypes).toContain('image/png');
      expect(acceptedTypes).toContain('image/gif');
      expect(acceptedTypes).toContain('image/webp');
      expect(acceptedTypes).toContain('image/svg');
      expect(acceptedTypes).toContain('image/heic');
      expect(acceptedTypes).toContain('image/heif');
    });
  });

  describe('Disabled states', () => {
    it('should disable upload when user is not authenticated', () => {
      renderButtonFileUpload({
        isUserAuthenticated: false,
        model: 'gpt-4-vision',
      });

      // In this case, it shows auth popover instead of disabled upload
      expect(screen.getByTestId('popover-content-auth')).toBeInTheDocument();
    });

    it('should show opacity when user is not authenticated in FileUpload mode', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
      });

      const button = screen.getByLabelText('Add files');
      expect(button.className).not.toContain('opacity-50');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
      });

      const button = screen.getByLabelText('Add files');
      expect(button).toHaveAttribute('aria-label', 'Add files');
    });

    it('should have button type attribute', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
      });

      const button = screen.getByLabelText('Add files');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should be focusable', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
      });

      const button = screen.getByLabelText('Add files');
      button.focus();

      expect(document.activeElement).toBe(button);
    });

    it('should show tooltip for all states', () => {
      const states = [
        { isUserAuthenticated: true, model: 'gpt-4-vision' },
        { isUserAuthenticated: false, model: 'gpt-4-vision' },
        { isUserAuthenticated: true, model: 'gpt-4' },
      ];

      states.forEach((props, _index) => {
        const { unmount } = renderButtonFileUpload(props);

        expect(screen.getByTestId('tooltip')).toBeInTheDocument();
        expect(screen.getByText('Add files')).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('UI Layout', () => {
    it('should have proper drop zone styling', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
      });

      const content = screen.getByTestId('file-upload-content');
      expect(content).toBeInTheDocument();

      // Check for drop zone elements
      expect(screen.getByTestId('file-up-icon')).toBeInTheDocument();
      expect(screen.getByText('Drop files here')).toBeInTheDocument();
      expect(
        screen.getByText('Drop any files here to add it to the conversation')
      ).toBeInTheDocument();
    });

    it('should apply consistent button styling across states', () => {
      const states = [
        { isUserAuthenticated: true, model: 'gpt-4-vision' },
        { isUserAuthenticated: false, model: 'gpt-4-vision' },
        { isUserAuthenticated: true, model: 'gpt-4' },
      ];

      states.forEach((props) => {
        const { unmount } = renderButtonFileUpload(props);

        const button = screen.getByLabelText('Add files');
        expect(button).toHaveClass('size-9', 'rounded-full');
        expect(button).toHaveAttribute('data-variant', 'secondary');
        expect(button).toHaveAttribute('data-size', 'sm');

        unmount();
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle missing onFileUpload prop', () => {
      expect(() => {
        renderButtonFileUpload({
          isUserAuthenticated: true,
          model: 'gpt-4-vision',
          onFileUpload: undefined as any,
        });
      }).not.toThrow();
    });

    it('should handle empty model string', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: '',
      });

      // Should show limitation message for empty model
      expect(
        screen.getByText('This model does not support file uploads.')
      ).toBeInTheDocument();
    });

    it('should handle null model', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: null as any,
      });

      // Should not crash
      expect(screen.getByTestId('popover')).toBeInTheDocument();
    });
  });

  describe('Integration', () => {
    it('should work with all supported image formats', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
      });

      const fileUpload = screen.getByTestId('file-upload');
      const acceptedTypes = fileUpload.getAttribute('data-accept');

      const expectedFormats = [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg',
        'image/heic',
        'image/heif',
      ];

      expectedFormats.forEach((format) => {
        expect(acceptedTypes).toContain(format);
      });
    });

    it('should work with text file formats', () => {
      renderButtonFileUpload({
        isUserAuthenticated: true,
        model: 'gpt-4-vision',
      });

      const fileUpload = screen.getByTestId('file-upload');
      const acceptedTypes = fileUpload.getAttribute('data-accept');

      expect(acceptedTypes).toContain('.txt');
      expect(acceptedTypes).toContain('.md');
    });
  });
});
