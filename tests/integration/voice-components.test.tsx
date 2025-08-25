import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

// Import components and hooks
import { VoiceButton } from '@/components/app/voice/button/voice-button';
import { TranscriptionPanel } from '@/components/app/voice/panel/transcription-panel';
import { AudioVisualizer } from '@/components/app/voice/visualizer/audio-visualizer';
import { useVoiceStore } from '@/components/app/voice/store/voice-store';
import { useVoiceIntegration } from '@/components/app/voice/hooks/use-voice-integration';

// Mock external dependencies
vi.mock('@/app/components/voice/hooks/use-webrtc-connection', () => ({
  useWebRTCConnection: vi.fn(() => ({
    isConnected: false,
    connect: vi.fn(),
    disconnect: vi.fn(),
    sendMessage: vi.fn(),
  })),
}));

vi.mock('@/app/components/voice/hooks/use-personality', () => ({
  usePersonality: vi.fn(() => ({
    currentPersonality: 'safety-focused',
    updatePersonality: vi.fn(),
    getPersonalityConfig: vi.fn(() => ({ 
      name: 'Safety-Focused',
      systemPrompt: 'Be helpful and safe',
      voice: 'nova',
    })),
  })),
}));

// Mock Web APIs
Object.assign(global, {
  MediaRecorder: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    state: 'inactive',
  })),
  navigator: {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    },
  },
  AudioContext: vi.fn().mockImplementation(() => ({
    createAnalyser: vi.fn().mockReturnValue({
      connect: vi.fn(),
      disconnect: vi.fn(),
      fftSize: 256,
      frequencyBinCount: 128,
      getByteFrequencyData: vi.fn(),
    }),
    createMediaStreamSource: vi.fn().mockReturnValue({
      connect: vi.fn(),
    }),
    close: vi.fn(),
    state: 'running',
  })),
});

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Voice Components Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    
    // Mock voice session API endpoint
    mockFetch.mockImplementation((url, options) => {
      if (url === '/api/voice/session' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ sessionId: 'test-session-123' }),
        });
      }
      if (url === '/api/voice/session' && options?.method === 'DELETE') {
        return Promise.resolve({ ok: true });
      }
      if (url === '/api/voice/transcripts' && options?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            vectorStoreId: 'vs-test123',
            fileId: 'file-test456',
          }),
        });
      }
      // Return a default mock response for any other calls
      return Promise.resolve({
        ok: false,
        statusText: 'Not Found',
      });
    });
    
    // Reset voice store state
    const { getState } = useVoiceStore;
    act(() => {
      getState().reset();
    });
  });

  describe('VoiceButton Integration', () => {
    it('should integrate with voice store for recording control', async () => {
      render(<VoiceButton />);
      
      const voiceButton = screen.getByRole('button');
      const { getState } = useVoiceStore;
      
      // Initial state should be idle
      expect(voiceButton).toHaveAttribute('aria-label', expect.stringContaining('Start voice session'));
      
      // First click to start session
      await act(async () => {
        fireEvent.click(voiceButton);
      });
      
      // Wait for session to connect
      await waitFor(() => {
        expect(getState().status).toBe('connected');
        expect(getState().sessionId).toBe('test-session-123');
      });
      
      // Button should now show "Start recording"
      expect(voiceButton).toHaveAttribute('aria-label', expect.stringContaining('Start recording'));
      
      // Second click to start recording
      await act(async () => {
        fireEvent.click(voiceButton);
      });
      
      // Should update voice store state to recording
      await waitFor(() => {
        expect(getState().isRecording).toBe(true);
        expect(getState().status).toBe('recording');
      });
      
      // Button should now show "Stop recording"
      expect(voiceButton).toHaveAttribute('aria-label', expect.stringContaining('Stop recording'));
      
      // Third click to stop recording
      await act(async () => {
        fireEvent.click(voiceButton);
      });
      
      await waitFor(() => {
        expect(getState().isRecording).toBe(false);
        expect(getState().status).toBe('connected');
      });
    });

    it('should handle session errors and update store', async () => {
      // Mock fetch to reject during session start
      vi.mocked(global.fetch).mockRejectedValueOnce(
        new Error('Permission denied')
      );
      
      render(<VoiceButton />);
      
      const voiceButton = screen.getByRole('button');
      const { getState } = useVoiceStore;
      
      // First click to start session (this should fail)
      await act(async () => {
        fireEvent.click(voiceButton);
      });
      
      // Wait for error state to be set
      await waitFor(() => {
        expect(getState().status).toBe('error');
        expect(getState().error?.message).toContain('Permission denied');
        expect(getState().isRecording).toBe(false);
      });
      
      // Button should show error state
      expect(voiceButton).toHaveAttribute('aria-label', expect.stringContaining('error'));
    });
  });

  describe('TranscriptionPanel Integration', () => {
    it('should display transcript from voice store', async () => {
      const { getState } = useVoiceStore;
      
      render(
        <div>
          <VoiceButton />
          <TranscriptionPanel isVisible={true} />
        </div>
      );
      
      const voiceButton = screen.getByRole('button');
      
      // Step 1: Start session
      await act(async () => {
        fireEvent.click(voiceButton);
      });
      
      // Wait for session to connect
      await waitFor(() => {
        expect(getState().status).toBe('connected');
        expect(getState().sessionId).toBe('test-session-123');
      });
      
      // Step 2: Set transcript data and personality mode
      act(() => {
        getState().updateCurrentTranscript('Test transcript from integration');
        getState().finalizeTranscript();
        getState().setPersonalityMode('technical-expert');
      });
      
      expect(screen.getByText('Test transcript from integration')).toBeInTheDocument();
      expect(screen.getByText('Technical Mode')).toBeInTheDocument();
    });

    it('should handle edit transcript and update store', async () => {
      const { getState } = useVoiceStore;
      
      render(
        <div>
          <VoiceButton />
          <TranscriptionPanel isVisible={true} />
        </div>
      );
      
      const voiceButton = screen.getByRole('button');
      
      // Step 1: Start session
      await act(async () => {
        fireEvent.click(voiceButton);
      });
      
      // Wait for session to connect
      await waitFor(() => {
        expect(getState().status).toBe('connected');
        expect(getState().sessionId).toBe('test-session-123');
      });
      
      // Step 2: Set up initial transcript
      act(() => {
        getState().updateCurrentTranscript('Original transcript');
        getState().finalizeTranscript();
      });
      
      // Find and click edit button
      const editButton = screen.getByRole('button', { name: /edit/i });
      fireEvent.click(editButton);
      
      // Find textarea and change text
      const textarea = screen.getByRole('textbox');
      fireEvent.change(textarea, { target: { value: 'Edited transcript' } });
      
      // Save changes
      const saveButton = screen.getByRole('button', { name: /save/i });
      await act(async () => {
        fireEvent.click(saveButton);
      });
      
      await waitFor(() => {
        expect(getState().finalTranscript).toBe('Edited transcript');
      });
    });

    it('should integrate with voice indexing', async () => {
      // The beforeEach mock already handles /api/voice/transcripts endpoint
      // No additional mock needed here
      
      const { getState } = useVoiceStore;
      
      render(
        <div>
          <VoiceButton />
          <TranscriptionPanel isVisible={true} />
        </div>
      );
      
      const voiceButton = screen.getByRole('button');
      
      // Step 1: Start session
      await act(async () => {
        fireEvent.click(voiceButton);
      });
      
      // Wait for session to connect
      await waitFor(() => {
        expect(getState().status).toBe('connected');
        expect(getState().sessionId).toBe('test-session-123');
      });
      
      // Step 2: Set up auto-indexing config and user before finalizing transcript
      act(() => {
        getState().updateConfig({ autoIndexTranscripts: true });
        getState().setUserId('test-user');
        getState().updateCurrentTranscript('Transcript to index');
      });
      
      // Step 3: Finalize transcript (this triggers auto-indexing)
      await act(async () => {
        await getState().finalizeTranscript();
      });
      
      // Verify auto-indexing API call was made
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/voice/transcripts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Transcript to index'),
        });
        expect(getState().vectorStoreId).toBe('vs-test123');
        expect(getState().indexingStatus).toBe('completed');
      });
    });
  });

  describe('AudioVisualizer Integration', () => {
    it('should visualize audio from voice store data', async () => {
      const { getState } = useVoiceStore;
      
      render(
        <div>
          <VoiceButton />
          <AudioVisualizer />
        </div>
      );

      const voiceButton = screen.getByRole('button');
      
      // Step 1: Start session
      await act(async () => {
        fireEvent.click(voiceButton);
      });
      
      // Wait for session to connect
      await waitFor(() => {
        expect(getState().status).toBe('connected');
        expect(getState().sessionId).toBe('test-session-123');
      });
      
      // Step 2: Start recording and update visualization data
      act(() => {
        getState().startRecording();
        getState().updateVisualizationData(new Float32Array([0.1, 0.2, 0.3, 0.4]));
      });
      
      // Should render canvas for visualization
      const canvas = screen.getByRole('img', { hidden: true }); // Canvas has img role
      expect(canvas).toBeInTheDocument();
    });

    it('should update visualization based on recording state', async () => {
      const { getState } = useVoiceStore;
      
      const { rerender } = render(
        <div>
          <VoiceButton />
          <AudioVisualizer />
        </div>
      );

      const voiceButton = screen.getByRole('button');
      
      // Step 1: Start session
      await act(async () => {
        fireEvent.click(voiceButton);
      });
      
      // Wait for session to connect
      await waitFor(() => {
        expect(getState().status).toBe('connected');
        expect(getState().sessionId).toBe('test-session-123');
      });
      
      // Step 2: Start recording and provide visualization data
      act(() => {
        getState().startRecording();
        getState().updateVisualizationData(new Float32Array([0.5, 0.6, 0.7, 0.8]));
      });
      
      rerender(
        <div>
          <VoiceButton />
          <AudioVisualizer />
        </div>
      );
      
      // Should show active visualization with recording styles
      const canvas = screen.getByRole('img', { hidden: true });
      expect(canvas).toHaveClass('border-red-300 shadow-lg');
    });
  });

  describe('Voice Integration Hook', () => {
    it('should integrate with voice store for transcript indexing', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          vectorStoreId: 'vs-integration123',
        }),
      });
      
      const { result } = renderHook(() => useVoiceIntegration({
        userId: 'integration-user',
        autoIndexTranscripts: true,
      }));
      
      await act(async () => {
        await result.current.indexTranscriptManually('Manual test transcript', {
          sessionId: 'integration-session',
          personalityMode: 'safety-focused',
        });
      });
      
      expect(mockFetch).toHaveBeenCalledWith('/api/voice/transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: expect.stringContaining('Manual test transcript'),
      });
      
      expect(result.current.indexingStatus).toBe('completed');
      expect(result.current.vectorStoreId).toBe('vs-integration123');
    });

    it('should search transcripts through API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          vectorStoreId: 'vs-search123',
          fileCount: 3,
          message: 'Vector store found',
        }),
      });
      
      const { result } = renderHook(() => useVoiceIntegration({
        userId: 'search-user',
      }));
      
      let searchResult;
      await act(async () => {
        searchResult = await result.current.searchTranscripts('technical discussion');
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/voice/transcripts?userId=search-user&query=technical%20discussion'
      );
      expect(searchResult).toEqual({
        success: true,
        vectorStoreId: 'vs-search123',
        fileCount: 3,
        message: 'Vector store found',
      });
    });
  });

  describe('Complete Voice Workflow Integration', () => {
    it('should handle end-to-end voice workflow', async () => {
      // Mock API responses for different endpoints
      mockFetch.mockImplementation((url, options) => {
        if (url === '/api/voice/session' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sessionId: 'test-session-123' }),
          });
        }
        if (url === '/api/voice/transcripts' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              success: true,
              vectorStoreId: 'vs-workflow123',
              fileId: 'file-workflow456',
            }),
          });
        }
        return Promise.resolve({ ok: true });
      });
      
      const { getState } = useVoiceStore;
      
      // Render all components together
      const VoiceWorkflow = () => (
        <div>
          <VoiceButton />
          <AudioVisualizer />
          <TranscriptionPanel isVisible={true} />
        </div>
      );
      
      render(<VoiceWorkflow />);
      
      // Step 1: Start session
      const voiceButton = screen.getByRole('button');
      await act(async () => {
        fireEvent.click(voiceButton);
      });
      
      // Wait for session to connect
      await waitFor(() => {
        expect(getState().status).toBe('connected');
        expect(getState().sessionId).toBe('test-session-123');
      });
      
      // Step 2: Start recording
      await act(async () => {
        fireEvent.click(voiceButton);
      });
      
      await waitFor(() => {
        expect(getState().isRecording).toBe(true);
        expect(getState().status).toBe('recording');
      });
      
      // Step 3: Set up auto-indexing config and user before finalizing transcript
      act(() => {
        getState().updateConfig({ autoIndexTranscripts: true });
        getState().setUserId('workflow-user');
        getState().updateCurrentTranscript('Complete workflow test transcript');
      });
      
      // Step 4: Verify transcript is displayed
      await waitFor(() => {
        expect(screen.getByText('Complete workflow test transcript')).toBeInTheDocument();
      });
      
      // Step 5: Finalize transcript (this triggers auto-indexing)
      await act(async () => {
        await getState().finalizeTranscript();
      });
      
      // Verify auto-indexing API call was made
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith('/api/voice/transcripts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Complete workflow test transcript'),
        });
        expect(getState().vectorStoreId).toBe('vs-workflow123');
        expect(getState().indexingStatus).toBe('completed');
      });
    });

    it('should handle errors gracefully across components', async () => {
      // Mock API error for transcript indexing
      mockFetch.mockImplementation((url, options) => {
        if (url === '/api/voice/session' && options?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ sessionId: 'test-session-123' }),
          });
        }
        if (url === '/api/voice/transcripts' && options?.method === 'POST') {
          return Promise.reject(new Error('API Error'));
        }
        return Promise.resolve({ ok: true });
      });
      
      const { getState } = useVoiceStore;
      
      render(
        <div>
          <VoiceButton />
          <TranscriptionPanel isVisible={true} />
        </div>
      );
      
      // Set up auto-indexing config and transcript
      act(() => {
        getState().updateConfig({ autoIndexTranscripts: true });
        getState().setUserId('error-user');
        getState().updateCurrentTranscript('Error test transcript');
      });
      
      // Try to finalize transcript (this triggers auto-indexing which will fail)
      await act(async () => {
        try {
          await getState().finalizeTranscript();
        } catch (error) {
          // Expected to fail
        }
      });
      
      await waitFor(() => {
        expect(getState().indexingStatus).toBe('failed');
        expect(getState().error?.message).toContain('API Error');
      });
      
      // Error should be displayed in UI
      expect(screen.getByText('API Error')).toBeInTheDocument();
    });
  });

  describe('State Synchronization', () => {
    it('should maintain state consistency across components', async () => {
      const { getState } = useVoiceStore;
      
      // Render multiple components that use the same store
      render(
        <div>
          <VoiceButton />
          <TranscriptionPanel isVisible={true} />
          <AudioVisualizer />
        </div>
      );
      
      const voiceButton = screen.getByRole('button');
      
      // Start session first
      await act(async () => {
        fireEvent.click(voiceButton);
      });
      
      // Wait for session to connect
      await waitFor(() => {
        expect(getState().status).toBe('connected');
        expect(getState().sessionId).toBe('test-session-123');
      });
      
      // Update state with transcript and personality
      act(() => {
        getState().updateCurrentTranscript('Sync test');
        getState().finalizeTranscript();
        getState().setPersonalityMode('technical-expert');
      });
      
      // Start recording
      await act(async () => {
        fireEvent.click(voiceButton);
      });
      
      await waitFor(() => {
        expect(getState().isRecording).toBe(true);
        expect(getState().status).toBe('recording');
      });
      
      // All components should reflect the same state
      expect(screen.getByText('Sync test')).toBeInTheDocument();
      expect(screen.getByText('Technical Mode')).toBeInTheDocument();
      
      // Voice button should show recording state
      expect(voiceButton).toHaveAttribute('aria-label', expect.stringContaining('Stop'));
    });
  });
});