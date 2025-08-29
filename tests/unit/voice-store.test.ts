import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '@/components/app/voice/store/voice-store';

// Mock fetch globally
const mockFetch = vi.fn();

describe('Voice Store', () => {
  beforeEach(() => {
    // Clear all mocks first
    vi.clearAllMocks();
    mockFetch.mockClear();
    mockFetch.mockReset();
    
    // Set up global fetch mock
    global.fetch = mockFetch;
    vi.stubGlobal('fetch', mockFetch);

    // Setup default successful mock implementation
    mockFetch.mockImplementation(async (url, options) => {
      const method = options?.method || 'GET';
      
      if (url === '/api/voice/session' && method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ sessionId: 'test-session-123' }),
          text: async () => '{"sessionId":"test-session-123"}',
        });
      }
      
      if (url === '/api/voice/session' && method === 'DELETE') {
        return Promise.resolve({ 
          ok: true, 
          status: 200,
          json: async () => ({ success: true }),
        });
      }
      
      if (url === '/api/voice/transcripts' && method === 'POST') {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            success: true,
            vectorStoreId: 'vs-test123',
            fileId: 'file-test456',
          }),
        });
      }
      
      // Default fallback
      return Promise.resolve({ 
        ok: true, 
        status: 200,
        json: async () => ({}),
      });
    });

    // Reset store to initial state - call reset twice to ensure it works
    useVoiceStore.getState().reset();
    
    // Wait a tick for any async operations
    return new Promise(resolve => setTimeout(resolve, 0));
  });

  afterEach(() => {
    // Clean up store state after each test
    useVoiceStore.getState().reset();
  });

  describe('Initial State', () => {
    it.concurrent('should have correct initial state', () => {
      const { result } = renderHook(() => useVoiceStore());

      // Wrap all state reads in act() to prevent warnings
      act(() => {
        const state = result.current;

        expect(state.status).toBe('idle');
        expect(state.isRecording).toBe(false);
        expect(state.sessionId).toBeNull();
        expect(state.transcriptions).toEqual([]);
        expect(state.currentTranscript).toBe('');
        expect(state.finalTranscript).toBe('');
        expect(state.error).toBeNull();
        expect(state.vectorStoreId).toBeNull();
        expect(state.indexingStatus).toBe('idle');
      });
    });

    it.concurrent('should have correct default configuration', () => {
      const { result } = renderHook(() => useVoiceStore());

      act(() => {
        const { config } = result.current;

        expect(config).toEqual({
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
  });

  describe('Configuration Updates', () => {
    it('should update configuration partially', () => {
      const { result } = renderHook(() => useVoiceStore());

      act(() => {
        result.current.updateConfig({ voice: 'alloy', enableVAD: false });
      });

      act(() => {
        expect(result.current.config.voice).toBe('alloy');
        expect(result.current.config.enableVAD).toBe(false);
        expect(result.current.config.model).toBe('gpt-4o-realtime-preview'); // Should remain unchanged
      });
    });
  });

  describe('Session Management', () => {
    it('should start session successfully', async () => {
      const store = useVoiceStore.getState();

      // Ensure store is in initial state
      expect(store.sessionId).toBeNull();
      expect(store.status).toBe('idle');

      // Call startSession and wait for completion
      await store.startSession();

      // Verify the mock was called correctly
      expect(mockFetch).toHaveBeenCalledWith('/api/voice/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: expect.stringContaining('personalityMode'),
      });

      // Get fresh state after action
      const newState = useVoiceStore.getState();
      
      // Verify final state
      expect(newState.sessionId).toBe('test-session-123');
      expect(newState.status).toBe('connected');
      expect(newState.error).toBeNull();
    });

    it('should handle session start failure', async () => {
      // Override default mock for this test to simulate failure
      mockFetch.mockImplementation(async (url, options) => {
        const method = options?.method || 'GET';
        if (url === '/api/voice/session' && method === 'POST') {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            text: async () => 'Server error details',
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      });

      const store = useVoiceStore.getState();

      // Ensure store is in initial state
      expect(store.status).toBe('idle');

      await store.startSession();

      // Get fresh state after action
      const newState = useVoiceStore.getState();

      // Verify final error state
      expect(newState.status).toBe('error');
      expect(newState.error).toEqual({
        code: 'SESSION_START_FAILED',
        message: expect.stringContaining('Failed to start session'),
        timestamp: expect.any(Number),
        details: expect.any(Object),
      });
      expect(newState.sessionId).toBeNull();
    });

    it('should stop session and clean up state', () => {
      const { result } = renderHook(() => useVoiceStore());

      // Set up session state
      act(() => {
        result.current.setUserId('test-user');
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
        result.current.stopSession();
      });

      act(() => {
        expect(result.current.sessionId).toBeNull();
        expect(result.current.status).toBe('idle');
        expect(result.current.isRecording).toBe(false);
        expect(result.current.currentTranscript).toBe('');
      });
    });
  });

  describe('Recording Management', () => {
    it('should start recording when connected', () => {
      const { result } = renderHook(() => useVoiceStore());

      // Set connected state
      act(() => {
        useVoiceStore.setState({ status: 'connected' });
      });

      act(() => {
        result.current.startRecording();
      });

      act(() => {
        expect(result.current.isRecording).toBe(true);
        expect(result.current.status).toBe('recording');
        expect(result.current.currentTranscript).toBe('');
      });
    });

    it('should not start recording when not connected', () => {
      const store = useVoiceStore.getState();
      
      // Ensure we're in idle state initially
      expect(store.status).toBe('idle');
      expect(store.isRecording).toBe(false);

      // Try to start recording
      store.startRecording();

      // Get fresh state - should not change when not connected
      const newState = useVoiceStore.getState();
      expect(newState.isRecording).toBe(false);
      expect(newState.status).toBe('idle');
    });

    it('should stop recording', () => {
      const { result } = renderHook(() => useVoiceStore());

      // Set recording state
      act(() => {
        useVoiceStore.setState({
          status: 'recording',
          isRecording: true,
        });
      });

      act(() => {
        result.current.stopRecording();
      });

      act(() => {
        expect(result.current.isRecording).toBe(false);
        expect(result.current.status).toBe('connected');
      });
    });
  });

  describe('Transcription Management', () => {
    it('should update current transcript', () => {
      const { result } = renderHook(() => useVoiceStore());

      act(() => {
        result.current.updateCurrentTranscript('Hello world');
      });

      act(() => {
        expect(result.current.currentTranscript).toBe('Hello world');
      });
    });

    it('should add transcription entry', () => {
      const { result } = renderHook(() => useVoiceStore());

      const entry = {
        id: 'test-1',
        timestamp: Date.now(),
        text: 'Test transcription',
        confidence: 0.95,
        isInterim: false,
      };

      act(() => {
        result.current.addTranscription(entry);
      });

      act(() => {
        expect(result.current.transcriptions).toContain(entry);
      });
    });

    it('should finalize transcript without auto-indexing when user not set', async () => {
      const store = useVoiceStore.getState();

      // Set current transcript first
      store.updateCurrentTranscript('Final transcript');
      
      // Verify current transcript is set
      expect(useVoiceStore.getState().currentTranscript).toBe('Final transcript');

      // Finalize the transcript
      await store.finalizeTranscript();

      // Check final state
      const finalState = useVoiceStore.getState();
      expect(finalState.finalTranscript).toBe('Final transcript');
      expect(finalState.currentTranscript).toBe('');
      // Should not make API call without userId
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should finalize transcript with auto-indexing when enabled', async () => {
      const store = useVoiceStore.getState();

      // Set up state for auto-indexing
      store.setUserId('test-user');
      store.updateCurrentTranscript('Auto-indexed transcript');
      store.updateConfig({ autoIndexTranscripts: true });
      useVoiceStore.setState({ sessionId: 'test-session' });

      // Verify setup
      const setupState = useVoiceStore.getState();
      expect(setupState.userId).toBe('test-user');
      expect(setupState.currentTranscript).toBe('Auto-indexed transcript');
      expect(setupState.config.autoIndexTranscripts).toBe(true);

      await store.finalizeTranscript();

      const finalState = useVoiceStore.getState();
      expect(finalState.finalTranscript).toBe('Auto-indexed transcript');
      expect(finalState.currentTranscript).toBe('');
      
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
      const { result } = renderHook(() => useVoiceStore());

      // Add some transcriptions
      act(() => {
        result.current.updateCurrentTranscript('Current');
        result.current.addTranscription({
          id: 'test-1',
          timestamp: Date.now(),
          text: 'Test',
          confidence: 0.9,
          isInterim: false,
        });
        useVoiceStore.setState({ finalTranscript: 'Final' });
      });

      act(() => {
        result.current.clearTranscriptions();
      });

      act(() => {
        expect(result.current.transcriptions).toEqual([]);
        expect(result.current.currentTranscript).toBe('');
        expect(result.current.finalTranscript).toBe('');
      });
    });
  });

  describe('Vector Store Integration', () => {
    it('should set userId', () => {
      const { result } = renderHook(() => useVoiceStore());

      act(() => {
        result.current.setUserId('test-user-123');
      });

      act(() => {
        expect(result.current.userId).toBe('test-user-123');
      });
    });

    it('should index transcript successfully', async () => {
      const store = useVoiceStore.getState();

      store.setUserId('test-user');
      useVoiceStore.setState({ sessionId: 'test-session' });

      await store.indexTranscript('Test transcript', {
        custom: 'metadata',
      });

      const finalState = useVoiceStore.getState();
      expect(finalState.indexingStatus).toBe('completed');
      expect(finalState.vectorStoreId).toBe('vs-test123');

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
      mockFetch.mockImplementation(async (url, options) => {
        const method = options?.method || 'GET';
        if (url === '/api/voice/transcripts' && method === 'POST') {
          return Promise.resolve({
            ok: false,
            status: 400,
            statusText: 'Bad Request',
            text: async () => 'Invalid request data',
          });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
      });

      const store = useVoiceStore.getState();

      store.setUserId('test-user');

      try {
        await store.indexTranscript('Test transcript');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(
          /Failed to index transcript.*Invalid request data/
        );
      }

      const finalState = useVoiceStore.getState();
      expect(finalState.indexingStatus).toBe('failed');
    });

    it('should require userId for transcript indexing', async () => {
      const store = useVoiceStore.getState();

      await expect(async () => {
        await store.indexTranscript('Test transcript');
      }).rejects.toThrow('Valid User ID required for transcript indexing');

      const finalState = useVoiceStore.getState();
      expect(finalState.indexingStatus).toBe('failed');
    });
  });

  describe('Error Handling', () => {
    it('should set error state', () => {
      const store = useVoiceStore.getState();

      const error = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: Date.now(),
      };

      store.setError(error);

      const state = useVoiceStore.getState();
      expect(state.error).toEqual(error);
      expect(state.status).toBe('error');
    });

    it('should clear error state', () => {
      const store = useVoiceStore.getState();

      // Set error first
      store.setError({
        code: 'TEST_ERROR',
        message: 'Test error',
        timestamp: Date.now(),
      });
      useVoiceStore.setState({ status: 'connected' });

      store.setError(null);

      const state = useVoiceStore.getState();
      expect(state.error).toBeNull();
      expect(state.lastErrorTime).toBe(0);
    });
  });

  describe('Audio Levels and Visualization', () => {
    it('should update audio levels', () => {
      const store = useVoiceStore.getState();

      store.updateAudioLevels(0.8, 0.6);

      const state = useVoiceStore.getState();
      expect(state.inputLevel).toBe(0.8);
      expect(state.outputLevel).toBe(0.6);
    });

    it('should update visualization data', () => {
      const store = useVoiceStore.getState();

      const testData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);

      store.updateVisualizationData(testData);

      const state = useVoiceStore.getState();
      expect(state.visualizationData).toBe(testData);
    });
  });

  describe('Personality Management', () => {
    it('should set personality mode', () => {
      const store = useVoiceStore.getState();

      store.setPersonalityMode('technical-expert');

      const state = useVoiceStore.getState();
      expect(state.personalityMode).toBe('technical-expert');
    });

    it('should set safety protocols', () => {
      const store = useVoiceStore.getState();

      store.setSafetyProtocols(false);

      const state = useVoiceStore.getState();
      expect(state.safetyProtocols).toBe(false);
    });
  });

  describe('Store Reset', () => {
    it('should reset store to initial state', () => {
      const { result } = renderHook(() => useVoiceStore());

      // Modify state
      act(() => {
        result.current.setUserId('test-user');
        result.current.updateCurrentTranscript('Test');
        result.current.setPersonalityMode('friendly-assistant');
        useVoiceStore.setState({
          status: 'connected',
          sessionId: 'test-session',
          isRecording: true,
        });
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      // Check initial state
      act(() => {
        expect(result.current.status).toBe('idle');
        expect(result.current.sessionId).toBeNull();
        expect(result.current.isRecording).toBe(false);
        expect(result.current.currentTranscript).toBe('');
        expect(result.current.userId).toBeUndefined();
        expect(result.current.personalityMode).toBe('safety-focused');
      });
    });
  });
});
