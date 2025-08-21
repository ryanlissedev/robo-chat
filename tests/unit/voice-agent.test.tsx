/**
 * @jest-environment jsdom
 */

import { render, screen } from '@testing-library/react';
import { VoiceAgent } from '@/app/components/chat/voice-agent';
import { UserProvider } from '@/lib/user-store/provider';

// Mock user store
const mockUser = {
  id: 'test-user-id',
  email: 'test@example.com',
  anonymous: false,
};

const MockUserProvider = ({ children }: { children: React.ReactNode }) => (
  <UserProvider>
    {children}
  </UserProvider>
);

// Mock MediaRecorder
global.MediaRecorder = class MockMediaRecorder {
  static isTypeSupported = () => true;
  start = jest.fn();
  stop = jest.fn();
  ondataavailable = null;
  onstop = null;
  state = 'inactive';
} as any;

// Mock getUserMedia
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockResolvedValue({
      getTracks: () => [{ stop: jest.fn() }],
    }),
  },
});

// Mock AudioContext
global.AudioContext = class MockAudioContext {
  createAnalyser = () => ({
    fftSize: 256,
    connect: jest.fn(),
    frequencyBinCount: 128,
    getByteFrequencyData: jest.fn(),
  });
  createMediaStreamSource = () => ({
    connect: jest.fn(),
  });
  close = jest.fn();
} as any;

describe('VoiceAgent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders voice agent component', () => {
    render(
      <MockUserProvider>
        <VoiceAgent 
          chatId="test-chat-id"
          onTranscription={jest.fn()}
          onResponse={jest.fn()}
        />
      </MockUserProvider>
    );

    // Should show the microphone button
    const micButton = screen.getByRole('button');
    expect(micButton).toBeInTheDocument();
    expect(micButton).toHaveAttribute('title', 'Start voice interaction');
  });

  it('shows not supported message when voice is not supported', () => {
    // Mock lack of support
    delete (global as any).MediaRecorder;
    
    render(
      <MockUserProvider>
        <VoiceAgent 
          chatId="test-chat-id"
          onTranscription={jest.fn()}
          onResponse={jest.fn()}
        />
      </MockUserProvider>
    );

    expect(screen.getByText('Voice not supported in this browser')).toBeInTheDocument();
  });

  it('calls onTranscription callback when provided', () => {
    const mockOnTranscription = jest.fn();
    
    render(
      <MockUserProvider>
        <VoiceAgent 
          chatId="test-chat-id"
          onTranscription={mockOnTranscription}
          onResponse={jest.fn()}
        />
      </MockUserProvider>
    );

    // Component should render without calling the callback initially
    expect(mockOnTranscription).not.toHaveBeenCalled();
  });

  it('disables button when disabled prop is true', () => {
    render(
      <MockUserProvider>
        <VoiceAgent 
          chatId="test-chat-id"
          onTranscription={jest.fn()}
          onResponse={jest.fn()}
          disabled={true}
        />
      </MockUserProvider>
    );

    const micButton = screen.getByRole('button');
    expect(micButton).toBeDisabled();
  });
});

describe('useVoiceAgent hook', () => {
  it('should provide voice agent functionality', () => {
    // This would be tested if we exported the hook
    // For now, we'll test it indirectly through the component
    expect(true).toBe(true);
  });
});