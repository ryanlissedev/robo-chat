import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetch globally BEFORE importing the store
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { useVoiceStore } from '@/components/app/voice/store/voice-store';

// Mock response data
const sessionResponseData = { sessionId: 'test-session-123' };
const transcriptResponseData = {
  success: true,
  vectorStoreId: 'vs-test123',
  fileId: 'file-test456',
};

// Response builders
const buildSuccessResponse = (data: any) => ({
  ok: true,
  status: 200,
  json: async () => data,
  text: async () => JSON.stringify(data),
});

const buildErrorResponse = (status: number, message: string) => ({
  ok: false,
  status,
  statusText: message,
  text: async () => message,
});

// Helper function to avoid nesting issues
const attemptIndexWithoutUser = async (store: any) => {
  await act(async () => {
    await store.indexTranscript('Test transcript');
  });
};

describe('Voice Store', () => {
  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    mockFetch.mockReset();

    // Reset store state using the reset method, then wait
    await act(async () => {
      useVoiceStore.getState().reset();
    });

    // Wait a bit to ensure state is fully reset
    await new Promise(resolve => setTimeout(resolve, 10));

    // Ensure global fetch is properly mocked
    global.fetch = mockFetch;
    globalThis.fetch = mockFetch;

    // Setup default successful mock implementation
    mockFetch.mockImplementation(async (url: string, options?: any) => {
      const method = options?.method || 'GET';

      if (url === '/api/voice/session' && method === 'POST') {
        return buildSuccessResponse(sessionResponseData);
      }

      if (url === '/api/voice/session' && method === 'DELETE') {
        return buildSuccessResponse({ success: true });
      }

      if (url === '/api/voice/transcripts' && method === 'POST') {
        return buildSuccessResponse(transcriptResponseData);
      }

      return buildSuccessResponse({});
    });
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const store = useVoiceStore.getState();

      expect(store.status).toBe('idle');
      expect(store.isRecording).toBe(false);
      expect(store.sessionId).toBeNull();
      expect(store.transcriptions).toEqual([]);
      expect(store.currentTranscript).toBe('');
      expect(store.finalTranscript).toBe('');
      expect(store.error).toBeNull();
      expect(store.vectorStoreId).toBeNull();
      expect(store.indexingStatus).toBe('idle');
    });

    it('should have correct default configuration', () => {
      const store = useVoiceStore.getState();

      expect(store.config).toEqual({
        model: 'gpt-4o-realtime-preview',
        voice: 'nova',
        language: 'en-US',
        enableVAD: true,
        noiseSuppressionLevel: 'medium',
        echoReduction: true,
        autoIndexTranscripts: true,
      });
    });
  });

  describe('Configuration Updates', () => {
    it('should update configuration partially', () => {
      const store = useVoiceStore.getState();

      act(() => {
        store.updateConfig({ voice: 'alloy', enableVAD: false });
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.config.voice).toBe('alloy');
      expect(updatedStore.config.enableVAD).toBe(false);
      expect(updatedStore.config.model).toBe('gpt-4o-realtime-preview'); // Should remain unchanged
    });
  });

  describe('Session Management', () => {
    it('should start session successfully', async () => {
      mockFetch.mockResolvedValueOnce(
        buildSuccessResponse(sessionResponseData)
      );

      const store = useVoiceStore.getState();

      // Verify initial state
      expect(store.sessionId).toBeNull();
      expect(store.status).toBe('idle');

      // Start session
      await act(async () => {
        await store.startSession();
      });

      // Get updated state after the action
      const updatedStore = useVoiceStore.getState();

      // Verify final state
      expect(updatedStore.sessionId).toBe('test-session-123');
      expect(updatedStore.status).toBe('connected');
      expect(updatedStore.error).toBeNull();

      // Verify fetch was called correctly
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith('/api/voice/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: expect.stringContaining('personalityMode'),
      });
    });

    it('should handle session start failure', async () => {
      // Setup error response
      mockFetch.mockResolvedValueOnce(buildErrorResponse(500, 'Server error'));

      const store = useVoiceStore.getState();

      // Start session (should fail)
      await act(async () => {
        await store.startSession();
      });

      // Get updated state after the failed action
      const updatedStore = useVoiceStore.getState();

      expect(updatedStore.status).toBe('error');
      expect(updatedStore.error).toEqual({
        code: 'SESSION_START_FAILED',
        message: expect.stringContaining('Failed to start session'),
        timestamp: expect.any(Number),
        details: expect.any(Object),
      });
      expect(updatedStore.sessionId).toBeNull();
    });

    it('should stop session and clean up state', () => {
      const store = useVoiceStore.getState();

      // Set up session state
      act(() => {
        store.setUserId('test-user');
        useVoiceStore.setState({
          sessionId: 'test-session',
          status: 'connected',
          isRecording: true,
          currentTranscript: 'test transcript',
        });
      });

      // Mock fetch for session cleanup
      mockFetch.mockResolvedValueOnce({ ok: true });

      act(() => {
        store.stopSession();
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.sessionId).toBeNull();
      expect(updatedStore.status).toBe('idle');
      expect(updatedStore.isRecording).toBe(false);
      expect(updatedStore.currentTranscript).toBe('');
    });
  });

  describe('Recording Management', () => {
    it('should start recording when connected', () => {
      const store = useVoiceStore.getState();

      // Set connected state first
      act(() => {
        useVoiceStore.setState({ status: 'connected' });
      });

      // Start recording
      act(() => {
        store.startRecording();
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.isRecording).toBe(true);
      expect(updatedStore.status).toBe('recording');
      expect(updatedStore.currentTranscript).toBe('');
    });

    it('should not start recording when not connected', () => {
      const store = useVoiceStore.getState();

      // Ensure we start with idle state
      expect(store.status).toBe('idle');
      expect(store.isRecording).toBe(false);

      // Try to start recording (should not work)
      act(() => {
        store.startRecording();
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.isRecording).toBe(false);
      expect(updatedStore.status).toBe('idle');
    });

    it('should stop recording', () => {
      const store = useVoiceStore.getState();

      // Set recording state
      act(() => {
        useVoiceStore.setState({
          status: 'recording',
          isRecording: true,
        });
      });

      act(() => {
        store.stopRecording();
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.isRecording).toBe(false);
      expect(updatedStore.status).toBe('connected');
    });
  });

  describe('Transcription Management', () => {
    it('should update current transcript', () => {
      const store = useVoiceStore.getState();

      act(() => {
        store.updateCurrentTranscript('Hello world');
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.currentTranscript).toBe('Hello world');
    });

    it('should add transcription entry', () => {
      const store = useVoiceStore.getState();

      const entry = {
        id: 'test-1',
        timestamp: Date.now(),
        text: 'Test transcription',
        confidence: 0.95,
        isInterim: false,
      };

      act(() => {
        store.addTranscription(entry);
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.transcriptions).toContain(entry);
    });

    it('should finalize transcript without auto-indexing when user not set', async () => {
      const store = useVoiceStore.getState();

      // Set current transcript first
      act(() => {
        store.updateCurrentTranscript('Final transcript');
      });

      // Verify current transcript is set
      expect(useVoiceStore.getState().currentTranscript).toBe('Final transcript');

      // Finalize the transcript
      await act(async () => {
        await store.finalizeTranscript();
      });

      // Check final state
      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.finalTranscript).toBe('Final transcript');
      expect(updatedStore.currentTranscript).toBe('');
      // Should not make API call without userId
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should finalize transcript with auto-indexing when enabled', async () => {
      const store = useVoiceStore.getState();

      // Set up state for auto-indexing
      act(() => {
        store.setUserId('test-user');
        store.updateCurrentTranscript('Auto-indexed transcript');
        store.updateConfig({ autoIndexTranscripts: true });
        useVoiceStore.setState({ sessionId: 'test-session' });
      });

      // Verify setup
      const setupStore = useVoiceStore.getState();
      expect(setupStore.userId).toBe('test-user');
      expect(setupStore.currentTranscript).toBe('Auto-indexed transcript');
      expect(setupStore.config.autoIndexTranscripts).toBe(true);

      await act(async () => {
        await store.finalizeTranscript();
      });

      // Check final state
      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.finalTranscript).toBe('Auto-indexed transcript');
      expect(updatedStore.currentTranscript).toBe('');

      // Verify the API call was made
      expect(mockFetch).toHaveBeenCalledWith('/api/voice/transcripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: expect.stringContaining('Auto-indexed transcript'),
      });
    });

    it('should clear transcriptions', () => {
      const store = useVoiceStore.getState();

      // Add some transcriptions
      act(() => {
        store.updateCurrentTranscript('Current');
        store.addTranscription({
          id: 'test-1',
          timestamp: Date.now(),
          text: 'Test',
          confidence: 0.9,
          isInterim: false,
        });
        useVoiceStore.setState({ finalTranscript: 'Final' });
      });

      act(() => {
        store.clearTranscriptions();
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.transcriptions).toEqual([]);
      expect(updatedStore.currentTranscript).toBe('');
      expect(updatedStore.finalTranscript).toBe('');
    });
  });

  describe('Vector Store Integration', () => {
    it('should set userId', () => {
      const store = useVoiceStore.getState();

      act(() => {
        store.setUserId('test-user-123');
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.userId).toBe('test-user-123');
    });

    it('should index transcript successfully', async () => {
      mockFetch.mockResolvedValueOnce(
        buildSuccessResponse(transcriptResponseData)
      );

      // Set up required state
      act(() => {
        useVoiceStore.setState({
          userId: 'test-user',
          sessionId: 'test-session',
        });
      });

      const store = useVoiceStore.getState();

      await act(async () => {
        await store.indexTranscript('Test transcript', { custom: 'metadata' });
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.indexingStatus).toBe('completed');
      expect(updatedStore.vectorStoreId).toBe('vs-test123');

      expect(mockFetch).toHaveBeenCalledWith('/api/voice/transcripts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          transcript: 'Test transcript',
          userId: 'test-user',
          sessionId: 'test-session',
          metadata: { custom: 'metadata' },
        }),
      });
    });

    it('should handle transcript indexing failure', async () => {
      // Override mock for this test to simulate failure
      mockFetch.mockResolvedValueOnce(buildErrorResponse(400, 'Invalid request data'));

      const store = useVoiceStore.getState();

      act(() => {
        store.setUserId('test-user');
      });

      try {
        await act(async () => {
          await store.indexTranscript('Test transcript');
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(
          /Failed to index transcript.*Invalid request data/
        );
      }

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.indexingStatus).toBe('failed');
    });

    it('should require userId for transcript indexing', async () => {
      const store = useVoiceStore.getState();

      await expect(() => attemptIndexWithoutUser(store)).rejects.toThrow(
        'Valid User ID required for transcript indexing'
      );

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.indexingStatus).toBe('failed');
    });
  });

  describe('Error Handling', () => {
    it('should set error state', () => {
      const error = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: Date.now(),
      };

      const store = useVoiceStore.getState();

      act(() => {
        store.setError(error);
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.error).toEqual(error);
      expect(updatedStore.status).toBe('error');
    });

    it('should clear error state', () => {
      const store = useVoiceStore.getState();

      // Set error first
      act(() => {
        store.setError({
          code: 'TEST_ERROR',
          message: 'Test error',
          timestamp: Date.now(),
        });
        useVoiceStore.setState({ status: 'connected' });
      });

      act(() => {
        store.setError(null);
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.error).toBeNull();
      expect(updatedStore.lastErrorTime).toBe(0);
    });
  });

  describe('Audio Levels and Visualization', () => {
    it('should update audio levels', () => {
      const store = useVoiceStore.getState();

      act(() => {
        store.updateAudioLevels(0.8, 0.6);
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.inputLevel).toBe(0.8);
      expect(updatedStore.outputLevel).toBe(0.6);
    });

    it('should update visualization data', () => {
      const store = useVoiceStore.getState();

      const testData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);

      act(() => {
        store.updateVisualizationData(testData);
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.visualizationData).toBe(testData);
    });
  });

  describe('Personality Management', () => {
    it('should set personality mode', () => {
      const store = useVoiceStore.getState();

      act(() => {
        store.setPersonalityMode('technical-expert');
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.personalityMode).toBe('technical-expert');
    });

    it('should set safety protocols', () => {
      const store = useVoiceStore.getState();

      act(() => {
        store.setSafetyProtocols(false);
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.safetyProtocols).toBe(false);
    });
  });

  describe('Store Reset', () => {
    it('should reset store to initial state', () => {
      const store = useVoiceStore.getState();

      // Modify state
      act(() => {
        store.setUserId('test-user');
        store.updateCurrentTranscript('Test');
        store.setPersonalityMode('friendly-assistant');
        useVoiceStore.setState({
          status: 'connected',
          sessionId: 'test-session',
          isRecording: true,
        });
      });

      // Reset
      act(() => {
        store.reset();
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.status).toBe('idle');
      expect(updatedStore.sessionId).toBeNull();
      expect(updatedStore.isRecording).toBe(false);
      expect(updatedStore.currentTranscript).toBe('');
      expect(updatedStore.userId).toBeUndefined();
      expect(updatedStore.personalityMode).toBe('safety-focused');
    });
  });
});