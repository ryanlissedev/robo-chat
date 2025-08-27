import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInput } from '@/components/app/chat-input/chat-input';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock dependencies
vi.mock('@/lib/models', () => ({
  getModelInfo: vi.fn((model: string) => ({
    webSearch: model === 'gpt-4',
    reasoning: model === 'claude-3-5',
  })),
}));

vi.mock('@/components/common/model-selector/base', () => ({
  ModelSelector: ({ selectedModelId, setSelectedModelId, className }: any) => (
    <button
      data-testid="model-selector"
      className={className}
      onClick={() => setSelectedModelId('new-model')}
    >
      Model: {selectedModelId}
    </button>
  ),
}));

vi.mock('@/components/app/voice/button/voice-button', () => ({
  VoiceButton: ({ onTranscriptReady, disabled, size }: any) => (
    <button
      data-testid="voice-button"
      disabled={disabled}
      onClick={() => onTranscriptReady('Voice transcript test')}
    >
      Voice ({size})
    </button>
  ),
}));

vi.mock('@/components/app/voice/panel/transcription-panel', () => ({
  TranscriptionPanel: ({ onSendTranscript, onClose, isVisible, className }: any) =>
    isVisible ? (
      <div data-testid="transcription-panel" className={className}>
        <button onClick={() => onSendTranscript('Transcription text')}>Send</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

vi.mock('@/components/app/voice/store/voice-store', () => ({
  useVoiceStore: vi.fn(() => ({})),
}));

vi.mock('@/components/app/voice/hooks/use-voice-integration', () => ({
  useVoiceIntegration: vi.fn(() => ({})),
}));

vi.mock('@/components/audio/RealtimeAudioModal', () => ({
  RealtimeAudioModal: ({ children, onTranscriptReady }: any) => (
    <div data-testid="realtime-audio-modal" onClick={() => onTranscriptReady('Realtime audio')}>
      {children}
    </div>
  ),
}));

vi.mock('@/components/prompt-kit/prompt-input', () => ({
  PromptInput: ({ children, className, onValueChange, value }: any) => (
    <div data-testid="prompt-input" className={className}>
      <input
        data-testid="prompt-input-hidden"
        onChange={(e) => onValueChange?.(e.target.value)}
        value={value}
        style={{ display: 'none' }}
      />
      {children}
    </div>
  ),
  PromptInputAction: ({ children, tooltip }: any) => (
    <div data-testid="prompt-input-action" title={tooltip}>
      {children}
    </div>
  ),
  PromptInputActions: ({ children, className }: any) => (
    <div data-testid="prompt-input-actions" className={className}>
      {children}
    </div>
  ),
  PromptInputTextarea: ({ className, onKeyDown, onPaste, placeholder, ...props }: any) => (
    <textarea
      data-testid="chat-textarea"
      className={className}
      onKeyDown={onKeyDown}
      onPaste={onPaste}
      placeholder={placeholder}
      {...props}
    />
  ),
}));

vi.mock('@/components/app/chat/reasoning-effort-selector', () => ({
  ReasoningEffortSelector: ({ onChange, value, className }: any) => (
    <select
      data-testid="reasoning-effort-selector"
      className={className}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="low">Low</option>
      <option value="medium">Medium</option>
      <option value="high">High</option>
    </select>
  ),
}));

vi.mock('@/components/app/suggestions/prompt-system', () => ({
  PromptSystem: ({ onSuggestion, onValueChange, value }: any) => (
    <div data-testid="prompt-system">
      <button onClick={() => onSuggestion?.('Test suggestion')}>Suggest</button>
      <span>Value: {value}</span>
    </div>
  ),
}));

vi.mock('./button-file-upload', () => ({
  ButtonFileUpload: ({ isUserAuthenticated, model, onFileUpload }: any) => (
    <button
      data-testid="file-upload-button"
      onClick={() => onFileUpload([new File(['test'], 'test.txt')])}
    >
      Upload ({isUserAuthenticated ? 'auth' : 'guest'}, {model})
    </button>
  ),
}));

vi.mock('./button-search', () => ({
  ButtonSearch: ({ isAuthenticated, isSelected, onToggle }: any) => (
    <button
      data-testid="search-button"
      onClick={() => onToggle(!isSelected)}
      className={isSelected ? 'selected' : ''}
    >
      Search ({isAuthenticated ? 'auth' : 'guest'}) {isSelected ? 'ON' : 'OFF'}
    </button>
  ),
}));

vi.mock('./file-list', () => ({
  FileList: ({ files, onFileRemove }: any) => (
    <div data-testid="file-list">
      {files.map((file: File, index: number) => (
        <div key={index}>
          {file.name}
          <button onClick={() => onFileRemove(file)}>Remove</button>
        </div>
      ))}
    </div>
  ),
}));

// Mock Lucide icons
vi.mock('lucide-react', () => ({
  ArrowUp: () => <div data-testid="arrow-up-icon" />,
  Square: () => <div data-testid="square-icon" />,
  AudioWaveform: () => <div data-testid="audio-waveform-icon" />,
  Sparkle: () => <div data-testid="sparkle-icon" />,
}));

describe('ChatInput', () => {
  const user = userEvent.setup();
  let queryClient: QueryClient;

  // Mock props
  const defaultProps = {
    value: '',
    onValueChange: vi.fn(),
    onSend: vi.fn(),
    isSubmitting: false,
    hasMessages: false,
    files: [],
    onFileUpload: vi.fn(),
    onFileRemove: vi.fn(),
    onSuggestion: vi.fn(),
    hasSuggestions: false,
    onSelectModel: vi.fn(),
    selectedModel: 'gpt-4',
    isUserAuthenticated: true,
    userId: 'user-123',
    stop: vi.fn(),
    status: 'ready' as const,
    setEnableSearch: vi.fn(),
    enableSearch: false,
    quotedText: null,
    reasoningEffort: 'medium' as const,
    onReasoningEffortChange: vi.fn(),
  };

  const renderComponent = (props = {}) => {
    return render(
      <QueryClientProvider client={queryClient}>
        <ChatInput {...defaultProps} {...props} />
      </QueryClientProvider>
    );
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render all main components', () => {
      renderComponent();

      expect(screen.getByTestId('prompt-input')).toBeInTheDocument();
      expect(screen.getByTestId('chat-textarea')).toBeInTheDocument();
      expect(screen.getByTestId('model-selector')).toBeInTheDocument();
      expect(screen.getByTestId('voice-button')).toBeInTheDocument();
      expect(screen.getByTestId('file-upload-button')).toBeInTheDocument();
      expect(screen.getByTestId('reasoning-effort-selector')).toBeInTheDocument();
    });

    it('should render search button when model supports web search', () => {
      renderComponent({ selectedModel: 'gpt-4' });

      expect(screen.getByTestId('search-button')).toBeInTheDocument();
      expect(screen.getByText(/Search.*OFF/)).toBeInTheDocument();
    });

    it('should not render search button when model does not support web search', () => {
      renderComponent({ selectedModel: 'claude-3' });

      expect(screen.queryByTestId('search-button')).not.toBeInTheDocument();
    });

    it('should render suggestions when hasSuggestions is true', () => {
      renderComponent({ hasSuggestions: true });

      expect(screen.getByTestId('prompt-system')).toBeInTheDocument();
    });

    it('should not render suggestions when hasSuggestions is false', () => {
      renderComponent({ hasSuggestions: false });

      expect(screen.queryByTestId('prompt-system')).not.toBeInTheDocument();
    });

    it('should render file list when files are present', () => {
      const files = [new File(['content'], 'test.txt')];
      renderComponent({ files });

      expect(screen.getByTestId('file-list')).toBeInTheDocument();
      expect(screen.getByText('test.txt')).toBeInTheDocument();
    });

    it('should render textarea with correct placeholder', () => {
      renderComponent();

      const textarea = screen.getByTestId('chat-textarea');
      expect(textarea).toHaveAttribute('placeholder', 'Ask anything…');
    });
  });

  describe('Text Input Behavior', () => {
    it('should call onValueChange when textarea value changes', async () => {
      const onValueChange = vi.fn();
      renderComponent({ onValueChange });

      const textarea = screen.getByTestId('chat-textarea');
      await user.type(textarea, 'Hello world');

      expect(onValueChange).toHaveBeenCalledWith('Hello world');
    });

    it('should handle Enter key to send message', async () => {
      const onSend = vi.fn();
      renderComponent({ value: 'Test message', onSend });

      const textarea = screen.getByTestId('chat-textarea');
      await user.type(textarea, '{Enter}');

      expect(onSend).toHaveBeenCalledTimes(1);
    });

    it('should not send message on Enter when value is only whitespace', async () => {
      const onSend = vi.fn();
      renderComponent({ value: '   \n\t  ', onSend });

      const textarea = screen.getByTestId('chat-textarea');
      await user.type(textarea, '{Enter}');

      expect(onSend).not.toHaveBeenCalled();
    });

    it('should allow new line with Shift+Enter', async () => {
      const onSend = vi.fn();
      renderComponent({ value: 'Test message', onSend });

      const textarea = screen.getByTestId('chat-textarea');
      await user.type(textarea, '{Shift>}{Enter}{/Shift}');

      expect(onSend).not.toHaveBeenCalled();
    });

    it('should prevent Enter when submitting', async () => {
      const onSend = vi.fn();
      renderComponent({ value: 'Test message', onSend, isSubmitting: true });

      const textarea = screen.getByTestId('chat-textarea');
      await user.type(textarea, '{Enter}');

      expect(onSend).not.toHaveBeenCalled();
    });

    it('should prevent Enter when status is streaming', async () => {
      const onSend = vi.fn();
      renderComponent({ value: 'Test message', onSend, status: 'streaming' });

      const textarea = screen.getByTestId('chat-textarea');
      await user.type(textarea, '{Enter}');

      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe('Send Button Behavior', () => {
    it('should show send button when there is non-whitespace text', () => {
      renderComponent({ value: 'Hello world' });

      expect(screen.getByRole('button', { name: 'Send message' })).toBeInTheDocument();
      expect(screen.getByTestId('arrow-up-icon')).toBeInTheDocument();
    });

    it('should show stop button when status is streaming', () => {
      renderComponent({ value: 'Hello world', status: 'streaming' });

      expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
      expect(screen.getByTestId('square-icon')).toBeInTheDocument();
    });

    it('should show realtime audio modal when input is empty', () => {
      renderComponent({ value: '' });

      expect(screen.getByTestId('realtime-audio-modal')).toBeInTheDocument();
      expect(screen.getByTestId('audio-waveform-icon')).toBeInTheDocument();
    });

    it('should call onSend when send button is clicked', async () => {
      const onSend = vi.fn();
      renderComponent({ value: 'Test message', onSend });

      const sendButton = screen.getByRole('button', { name: 'Send message' });
      await user.click(sendButton);

      expect(onSend).toHaveBeenCalledTimes(1);
    });

    it('should call stop when stop button is clicked', async () => {
      const stop = vi.fn();
      renderComponent({ value: 'Test message', status: 'streaming', stop });

      const stopButton = screen.getByRole('button', { name: 'Stop' });
      await user.click(stopButton);

      expect(stop).toHaveBeenCalledTimes(1);
    });

    it('should disable send button when submitting', () => {
      renderComponent({ value: 'Test message', isSubmitting: true });

      const sendButton = screen.getByRole('button', { name: 'Send message' });
      expect(sendButton).toBeDisabled();
    });

    it('should disable send button for whitespace-only text', () => {
      renderComponent({ value: '   \n\t  ' });

      const sendButton = screen.getByRole('button', { name: 'Send message' });
      expect(sendButton).toBeDisabled();
    });
  });

  describe('File Handling', () => {
    it('should handle file upload', async () => {
      const onFileUpload = vi.fn();
      renderComponent({ onFileUpload });

      const uploadButton = screen.getByTestId('file-upload-button');
      await user.click(uploadButton);

      expect(onFileUpload).toHaveBeenCalledWith([expect.any(File)]);
    });

    it('should handle file removal', async () => {
      const file = new File(['content'], 'test.txt');
      const onFileRemove = vi.fn();
      renderComponent({ files: [file], onFileRemove });

      const removeButton = screen.getByText('Remove');
      await user.click(removeButton);

      expect(onFileRemove).toHaveBeenCalledWith(file);
    });

    it('should handle image paste for authenticated users', async () => {
      const onFileUpload = vi.fn();
      renderComponent({ isUserAuthenticated: true, onFileUpload });

      const textarea = screen.getByTestId('chat-textarea');

      // Create mock clipboard data with image
      const mockFile = new File(['image'], 'test.png', { type: 'image/png' });
      const mockDataTransfer = {
        items: [
          {
            type: 'image/png',
            getAsFile: () => mockFile,
          },
        ],
      };

      fireEvent.paste(textarea, {
        clipboardData: mockDataTransfer,
      });

      await waitFor(() => {
        expect(onFileUpload).toHaveBeenCalledWith([expect.any(File)]);
      });
    });

    it('should prevent image paste for unauthenticated users', async () => {
      const onFileUpload = vi.fn();
      renderComponent({ isUserAuthenticated: false, onFileUpload });

      const textarea = screen.getByTestId('chat-textarea');

      const mockDataTransfer = {
        items: [
          {
            type: 'image/png',
            getAsFile: () => new File(['image'], 'test.png', { type: 'image/png' }),
          },
        ],
      };

      fireEvent.paste(textarea, {
        clipboardData: mockDataTransfer,
      });

      expect(onFileUpload).not.toHaveBeenCalled();
    });
  });

  describe('Model Selection', () => {
    it('should handle model selection', async () => {
      const onSelectModel = vi.fn();
      renderComponent({ onSelectModel });

      const modelSelector = screen.getByTestId('model-selector');
      await user.click(modelSelector);

      expect(onSelectModel).toHaveBeenCalledWith('new-model');
    });

    it('should disable search when model does not support it', () => {
      const setEnableSearch = vi.fn();
      renderComponent({ 
        selectedModel: 'claude-3', // No web search support
        enableSearch: true,
        setEnableSearch 
      });

      expect(setEnableSearch).toHaveBeenCalledWith(false);
    });
  });

  describe('Search Functionality', () => {
    it('should handle search toggle', async () => {
      const setEnableSearch = vi.fn();
      renderComponent({ 
        selectedModel: 'gpt-4',
        enableSearch: false,
        setEnableSearch 
      });

      const searchButton = screen.getByTestId('search-button');
      await user.click(searchButton);

      expect(setEnableSearch).toHaveBeenCalledWith(true);
    });

    it('should show correct search button state', () => {
      renderComponent({ 
        selectedModel: 'gpt-4',
        enableSearch: true 
      });

      expect(screen.getByText(/Search.*ON/)).toBeInTheDocument();
      expect(screen.getByTestId('search-button')).toHaveClass('selected');
    });
  });

  describe('Voice Features', () => {
    it('should handle voice button transcript', async () => {
      const onValueChange = vi.fn();
      renderComponent({ value: 'existing text', onValueChange });

      const voiceButton = screen.getByTestId('voice-button');
      await user.click(voiceButton);

      expect(onValueChange).toHaveBeenCalledWith('existing text\nVoice transcript test');
    });

    it('should handle realtime audio modal transcript', async () => {
      const onValueChange = vi.fn();
      renderComponent({ value: '', onValueChange });

      const audioModal = screen.getByTestId('realtime-audio-modal');
      await user.click(audioModal);

      expect(onValueChange).toHaveBeenCalledWith('Realtime audio');
    });

    it('should disable voice button when submitting', () => {
      renderComponent({ isSubmitting: true });

      const voiceButton = screen.getByTestId('voice-button');
      expect(voiceButton).toBeDisabled();
    });
  });

  describe('Reasoning Effort', () => {
    it('should handle reasoning effort change', async () => {
      const onReasoningEffortChange = vi.fn();
      renderComponent({ onReasoningEffortChange });

      const selector = screen.getByTestId('reasoning-effort-selector');
      await user.selectOptions(selector, 'high');

      expect(onReasoningEffortChange).toHaveBeenCalledWith('high');
    });

    it('should use default reasoning effort when not provided', () => {
      renderComponent({ reasoningEffort: undefined });

      const selector = screen.getByTestId('reasoning-effort-selector');
      expect(selector).toHaveValue('medium');
    });

    it('should use provided reasoning effort', () => {
      renderComponent({ reasoningEffort: 'low' });

      const selector = screen.getByTestId('reasoning-effort-selector');
      expect(selector).toHaveValue('low');
    });
  });

  describe('Suggestions', () => {
    it('should handle suggestion selection', async () => {
      const onSuggestion = vi.fn();
      renderComponent({ hasSuggestions: true, onSuggestion });

      const suggestButton = screen.getByText('Suggest');
      await user.click(suggestButton);

      expect(onSuggestion).toHaveBeenCalledWith('Test suggestion');
    });
  });

  describe('Quoted Text', () => {
    it('should handle quoted text insertion', () => {
      const onValueChange = vi.fn();
      const quotedText = { text: 'Original message', messageId: 'msg-123' };
      
      renderComponent({ 
        value: 'My response',
        onValueChange,
        quotedText 
      });

      expect(onValueChange).toHaveBeenCalledWith('My response\n\n> Original message\n\n');
    });

    it('should handle quoted text with empty value', () => {
      const onValueChange = vi.fn();
      const quotedText = { text: 'Original message', messageId: 'msg-123' };
      
      renderComponent({ 
        value: '',
        onValueChange,
        quotedText 
      });

      expect(onValueChange).toHaveBeenCalledWith('> Original message\n\n');
    });

    it('should handle multi-line quoted text', () => {
      const onValueChange = vi.fn();
      const quotedText = { text: 'Line 1\nLine 2\nLine 3', messageId: 'msg-123' };
      
      renderComponent({ 
        value: '',
        onValueChange,
        quotedText 
      });

      expect(onValueChange).toHaveBeenCalledWith('> Line 1\n> Line 2\n> Line 3\n\n');
    });
  });

  describe('Authentication States', () => {
    it('should pass authentication state to child components', () => {
      renderComponent({ isUserAuthenticated: false });

      expect(screen.getByText(/Upload.*guest/)).toBeInTheDocument();
      expect(screen.getByText(/Search.*guest/)).toBeInTheDocument();
    });

    it('should pass user ID to realtime audio modal', () => {
      renderComponent({ isUserAuthenticated: true, userId: 'user-456' });

      // RealtimeAudioModal should receive the userId prop
      expect(screen.getByTestId('realtime-audio-modal')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderComponent({ value: 'Test message' });

      const sendButton = screen.getByRole('button', { name: 'Send message' });
      expect(sendButton).toHaveAttribute('aria-label', 'Send message');
    });

    it('should have proper ARIA labels for stop button', () => {
      renderComponent({ value: 'Test message', status: 'streaming' });

      const stopButton = screen.getByRole('button', { name: 'Stop' });
      expect(stopButton).toHaveAttribute('aria-label', 'Stop');
    });

    it('should have proper ARIA label for realtime audio button', () => {
      renderComponent({ value: '' });

      const audioButton = screen.getByRole('button', { name: 'Open realtime audio modal' });
      expect(audioButton).toHaveAttribute('aria-label', 'Open realtime audio modal');
    });

    it('should be keyboard accessible', async () => {
      renderComponent();

      const textarea = screen.getByTestId('chat-textarea');
      textarea.focus();

      expect(textarea).toHaveFocus();

      // Tab should move to other interactive elements
      await user.tab();
      expect(document.activeElement).not.toBe(textarea);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle rapid value changes', async () => {
      const onValueChange = vi.fn();
      renderComponent({ onValueChange });

      // Simulate typing quickly
      for (let i = 0; i < 100; i++) {
        onValueChange(`text-${i}`);
      }

      expect(onValueChange).toHaveBeenCalledTimes(100);
    });

    it('should handle large text input', async () => {
      const largeText = 'a'.repeat(10000);
      const onValueChange = vi.fn();
      
      renderComponent({ value: largeText, onValueChange });

      const textarea = screen.getByTestId('chat-textarea');
      expect(textarea).toHaveValue(largeText);
    });

    it('should clean up effects on unmount', () => {
      const { unmount } = renderComponent();

      unmount();

      // Component should unmount without errors
      expect(screen.queryByTestId('prompt-input')).not.toBeInTheDocument();
    });
  });
});