import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVoiceStore } from '@/components/app/voice/store/voice-store';

// Import timer test utilities
import { createTimerTestContext, safeRunPendingTimers } from '../utils/timer-test-utils';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Voice Store', () => {
  const timerContext = createTimerTestContext();

  beforeEach(() => {
    timerContext.setupTimers();
    
    // Reset store state before each test
    act(() => {
      useVoiceStore.getState().reset();
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
    
    // Handle timer cleanup safely
    safeRunPendingTimers();
    timerContext.cleanupTimers();
    
    // Cleanup any remaining subscriptions or effects
    act(() => {
      useVoiceStore.getState().reset();
    });
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ sessionId: 'test-session-123' }),
      });

      const { result } = renderHook(() => useVoiceStore());

      await act(async () => {
        await result.current.startSession();
      });

      act(() => {
        expect(result.current.sessionId).toBe('test-session-123');
        expect(result.current.status).toBe('connected');
        expect(result.current.error).toBeNull();
      });
    });

    it('should handle session start failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
        text: async () => 'Server error details',
      });

      const { result } = renderHook(() => useVoiceStore());

      await act(async () => {
        try {
          await result.current.startSession();
        } catch (_error) {}
      });

      act(() => {
        expect(result.current.status).toBe('error');
        expect(result.current.error).toEqual({
          code: 'SESSION_START_FAILED',
          message: expect.stringContaining('Failed to start session'),
          timestamp: expect.any(Number),
          details: expect.any(Object),
        });
      });
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
      const { result } = renderHook(() => useVoiceStore());

      act(() => {
        expect(result.current.status).toBe('idle');

        result.current.startRecording();

        expect(result.current.isRecording).toBe(false);
        expect(result.current.status).toBe('idle');
      });
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
      const { result } = renderHook(() => useVoiceStore());

      act(() => {
        result.current.updateCurrentTranscript('Final transcript');
      });

      await act(async () => {
        await result.current.finalizeTranscript();
      });

      act(() => {
        expect(result.current.finalTranscript).toBe('Final transcript');
        expect(result.current.currentTranscript).toBe('');
        // Should not make API call without userId
        expect(mockFetch).not.toHaveBeenCalled();
      });
    });

    it('should finalize transcript with auto-indexing when enabled', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          vectorStoreId: 'vs-123',
          fileId: 'file-456',
        }),
      });

      const { result } = renderHook(() => useVoiceStore());

      // Set up state for auto-indexing
      act(() => {
        result.current.setUserId('test-user');
        result.current.updateCurrentTranscript('Auto-indexed transcript');
        useVoiceStore.setState({
          sessionId: 'test-session',
          config: {
            ...result.current.config,
            autoIndexTranscripts: true,
          },
        });
      });

      await act(async () => {
        await result.current.finalizeTranscript();
      });

      act(() => {
        expect(result.current.finalTranscript).toBe('Auto-indexed transcript');
        expect(result.current.currentTranscript).toBe('');
        // Verify the API call was made
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledWith('/api/voice/transcripts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: expect.any(String),
        });

        // Verify the request body content separately
        const callArgs = mockFetch.mock.calls[0];
        const requestBody = JSON.parse(callArgs[1].body);

        expect(requestBody.transcript).toBe('Auto-indexed transcript');
        expect(requestBody.userId).toBe('test-user');
        expect(requestBody.sessionId).toBe('test-session');
        expect(requestBody.metadata.sessionId).toBe('test-session');
        expect(requestBody.metadata.personalityMode).toBe('safety-focused');
        expect(requestBody.metadata.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );
        expect(requestBody.metadata.language).toBe('en-US');
        expect(requestBody.metadata.voice).toBe('nova');
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
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          vectorStoreId: 'vs-abc123',
          fileId: 'file-def456',
          message: 'Transcript indexed successfully',
        }),
      });

      const { result } = renderHook(() => useVoiceStore());

      act(() => {
        result.current.setUserId('test-user');
        useVoiceStore.setState({ sessionId: 'test-session' });
      });

      await act(async () => {
        await result.current.indexTranscript('Test transcript', {
          custom: 'metadata',
        });
      });

      act(() => {
        expect(result.current.indexingStatus).toBe('completed');
        expect(result.current.vectorStoreId).toBe('vs-abc123');

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
    });

    it('should handle transcript indexing failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        statusText: 'Bad Request',
        text: async () => 'Invalid request data',
      });

      const { result } = renderHook(() => useVoiceStore());

      act(() => {
        result.current.setUserId('test-user');
      });

      await act(async () => {
        try {
          await result.current.indexTranscript('Test transcript');
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toMatch(
            /Failed to index transcript.*Invalid request data/
          );
        }
      });

      act(() => {
        expect(result.current.indexingStatus).toBe('failed');
      });
    });

    it('should require userId for transcript indexing', async () => {
      const { result } = renderHook(() => useVoiceStore());

      await expect(async () => {
        await act(async () => {
          await result.current.indexTranscript('Test transcript');
        });
      }).rejects.toThrow('Valid User ID required for transcript indexing');

      act(() => {
        expect(result.current.indexingStatus).toBe('failed');
      });
    });
  });

  describe('Error Handling', () => {
    it('should set error state', () => {
      const { result } = renderHook(() => useVoiceStore());

      const error = {
        code: 'TEST_ERROR',
        message: 'Test error message',
        timestamp: Date.now(),
      };

      act(() => {
        result.current.setError(error);
      });

      act(() => {
        expect(result.current.error).toEqual(error);
        expect(result.current.status).toBe('error');
      });
    });

    it('should clear error state', () => {
      const { result } = renderHook(() => useVoiceStore());

      // Set error first
      act(() => {
        result.current.setError({
          code: 'TEST_ERROR',
          message: 'Test error',
          timestamp: Date.now(),
        });
        useVoiceStore.setState({ status: 'connected' });
      });

      act(() => {
        result.current.setError(null);
      });

      act(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.lastErrorTime).toBe(0);
      });
    });
  });

  describe('Audio Levels and Visualization', () => {
    it('should update audio levels', () => {
      const { result } = renderHook(() => useVoiceStore());

      act(() => {
        result.current.updateAudioLevels(0.8, 0.6);
      });

      act(() => {
        expect(result.current.inputLevel).toBe(0.8);
        expect(result.current.outputLevel).toBe(0.6);
      });
    });

    it('should update visualization data', () => {
      const { result } = renderHook(() => useVoiceStore());

      const testData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);

      act(() => {
        result.current.updateVisualizationData(testData);
      });

      act(() => {
        expect(result.current.visualizationData).toBe(testData);
      });
    });
  });

  describe('Personality Management', () => {
    it('should set personality mode', () => {
      const { result } = renderHook(() => useVoiceStore());

      act(() => {
        result.current.setPersonalityMode('technical-expert');
      });

      act(() => {
        expect(result.current.personalityMode).toBe('technical-expert');
      });
    });

    it('should set safety protocols', () => {
      const { result } = renderHook(() => useVoiceStore());

      act(() => {
        result.current.setSafetyProtocols(false);
      });

      act(() => {
        expect(result.current.safetyProtocols).toBe(false);
      });
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
