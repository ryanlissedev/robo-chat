import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetch at the module level before any imports
const mockFetch = vi.fn();
Object.defineProperty(globalThis, 'fetch', {
  value: mockFetch,
  writable: true,
});

// Import after setting up the mock
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
  json: async () => ({ error: message }),
});

// Helper function to avoid nesting issues
const attemptIndexTranscript = async (
  store: any,
  transcript = 'Test transcript'
) => {
  await act(async () => {
    await store.indexTranscript(transcript);
  });
};

describe('Voice Store - Final Tests', () => {
  beforeEach(async () => {
    // Reset all mocks
    vi.clearAllMocks();
    mockFetch.mockReset();

    // Reset store state using the reset method, then wait
    await act(async () => {
      useVoiceStore.getState().reset();
    });

    // Wait a bit to ensure state is fully reset
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Ensure global fetch is properly mocked
    global.fetch = mockFetch;
    globalThis.fetch = mockFetch;
  });

  describe('Session Management', () => {
    it('should start session successfully', async () => {
      // Setup mock response with proper async handling
      const mockResponse = buildSuccessResponse(sessionResponseData);
      mockFetch.mockResolvedValueOnce(mockResponse);

      // Get initial store state
      let store = useVoiceStore.getState();

      // Verify initial state
      expect(store.sessionId).toBeNull();
      expect(store.status).toBe('idle');

      // Start session with proper await
      await act(async () => {
        await store.startSession();
      });

      // Get updated state after the action
      store = useVoiceStore.getState();

      // Verify final state
      expect(store.sessionId).toBe('test-session-123');
      expect(store.status).toBe('connected');
      expect(store.error).toBeNull();

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

      // Ensure clean state
      let store = useVoiceStore.getState();
      expect(store.status).toBe('idle');
      expect(store.sessionId).toBeNull();

      // Start session (should fail)
      await act(async () => {
        await store.startSession();
      });

      // Get updated state after the failed action
      store = useVoiceStore.getState();

      expect(store.status).toBe('error');
      expect(store.error).toEqual({
        code: 'SESSION_START_FAILED',
        message: expect.stringContaining('Failed to start session'),
        timestamp: expect.any(Number),
        details: expect.any(Object),
      });
      expect(store.sessionId).toBeNull();
    });

    it('should not start session when already connected', async () => {
      // Set up connected state
      await act(async () => {
        useVoiceStore.setState({
          status: 'connected',
          sessionId: 'existing-session',
        });
      });

      // Verify state was set correctly
      let store = useVoiceStore.getState();
      expect(store.status).toBe('connected');
      expect(store.sessionId).toBe('existing-session');

      // Try to start session - should be ignored due to status check
      await act(async () => {
        await store.startSession();
      });

      // Refresh store reference after potential changes
      store = useVoiceStore.getState();

      // Should not make any API calls
      expect(mockFetch).not.toHaveBeenCalled();
      expect(store.sessionId).toBe('existing-session');
      expect(store.status).toBe('connected');
    });
  });

  describe('Recording Management', () => {
    it('should start recording when connected', () => {
      // Set connected state first
      act(() => {
        useVoiceStore.setState({ status: 'connected' });
      });

      const store = useVoiceStore.getState();

      act(() => {
        store.startRecording();
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.isRecording).toBe(true);
      expect(updatedStore.status).toBe('recording');
      expect(updatedStore.currentTranscript).toBe('');
    });

    it('should not start recording when not connected', () => {
      // Ensure we start with completely clean idle state
      act(() => {
        useVoiceStore.setState({
          status: 'idle',
          isRecording: false,
          sessionId: null,
        });
      });

      const store = useVoiceStore.getState();

      // Verify clean state
      expect(store.status).toBe('idle');
      expect(store.isRecording).toBe(false);

      act(() => {
        store.startRecording();
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.isRecording).toBe(false);
      expect(updatedStore.status).toBe('idle');
    });

    it('should stop recording', () => {
      // Set recording state first
      act(() => {
        useVoiceStore.setState({
          status: 'recording',
          isRecording: true,
        });
      });

      const store = useVoiceStore.getState();

      act(() => {
        store.stopRecording();
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.isRecording).toBe(false);
      expect(updatedStore.status).toBe('connected');
    });
  });

  describe('Vector Store Integration', () => {
    it('should index transcript successfully', async () => {
      mockFetch.mockResolvedValueOnce(
        buildSuccessResponse(transcriptResponseData)
      );

      // Set up required state and ensure clean start
      await act(async () => {
        useVoiceStore.setState({
          userId: 'test-user',
          sessionId: 'test-session',
          indexingStatus: 'idle',
        });
      });

      const store = useVoiceStore.getState();
      expect(store.userId).toBe('test-user');
      expect(store.indexingStatus).toBe('idle');

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

    it('should require userId for transcript indexing', async () => {
      // Ensure clean state with no userId
      await act(async () => {
        useVoiceStore.setState({
          userId: undefined,
          indexingStatus: 'idle',
        });
      });

      const store = useVoiceStore.getState();
      expect(store.userId).toBeUndefined();

      // Don't mock fetch for this test as it should fail before reaching fetch
      await expect(() => attemptIndexTranscript(store)).rejects.toThrow(
        'Valid User ID required for transcript indexing'
      );

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.indexingStatus).toBe('failed');
    });

    it('should handle transcript indexing failure', async () => {
      mockFetch.mockResolvedValueOnce(
        buildErrorResponse(400, 'Invalid request')
      );

      // Set up required state
      await act(async () => {
        useVoiceStore.setState({
          userId: 'test-user',
          sessionId: 'test-session',
          indexingStatus: 'idle',
        });
      });

      const store = useVoiceStore.getState();
      expect(store.userId).toBe('test-user');

      await expect(() => attemptIndexTranscript(store)).rejects.toThrow(
        'Failed to index transcript'
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
      // Set error state first
      act(() => {
        useVoiceStore.setState({
          error: {
            code: 'TEST_ERROR',
            message: 'Test error',
            timestamp: Date.now(),
          },
          status: 'error',
        });
      });

      const store = useVoiceStore.getState();

      act(() => {
        store.setError(null);
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.error).toBeNull();
      expect(updatedStore.lastErrorTime).toBe(0);
    });
  });

  describe('Transcript Management', () => {
    it('should add transcription entry', () => {
      const entry = {
        id: 'test-1',
        timestamp: Date.now(),
        text: 'Hello world',
        confidence: 0.95,
        isInterim: false,
      };

      const store = useVoiceStore.getState();

      act(() => {
        store.addTranscription(entry);
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.transcriptions).toEqual([entry]);
    });

    it('should update current transcript', () => {
      const store = useVoiceStore.getState();

      act(() => {
        store.updateCurrentTranscript('Current text');
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.currentTranscript).toBe('Current text');
    });

    it('should clear transcriptions', () => {
      // Add some transcriptions first
      act(() => {
        useVoiceStore.setState({
          transcriptions: [
            {
              id: 'test-1',
              timestamp: Date.now(),
              text: 'Test',
              confidence: 0.9,
              isInterim: false,
            },
          ],
          currentTranscript: 'Current',
          finalTranscript: 'Final',
        });
      });

      const store = useVoiceStore.getState();

      act(() => {
        store.clearTranscriptions();
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.transcriptions).toEqual([]);
      expect(updatedStore.currentTranscript).toBe('');
      expect(updatedStore.finalTranscript).toBe('');
    });
  });

  describe('Configuration Management', () => {
    it('should update config', () => {
      const store = useVoiceStore.getState();
      const newConfig = { voice: 'echo' as const };

      act(() => {
        store.updateConfig(newConfig);
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.config.voice).toBe('echo');
    });

    it('should set personality mode', () => {
      const store = useVoiceStore.getState();

      act(() => {
        store.setPersonalityMode('technical-expert');
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.personalityMode).toBe('technical-expert');
    });

    it('should toggle safety protocols', () => {
      const store = useVoiceStore.getState();

      act(() => {
        store.setSafetyProtocols(false);
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.safetyProtocols).toBe(false);
    });

    it('should set user ID', () => {
      const store = useVoiceStore.getState();

      act(() => {
        store.setUserId('user-123');
      });

      const updatedStore = useVoiceStore.getState();
      expect(updatedStore.userId).toBe('user-123');
    });
  });
});
