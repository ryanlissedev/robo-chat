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

describe('Voice Store - Working Tests', () => {
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
      // Setup mock response
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
      const store = useVoiceStore.getState();

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

      const store = useVoiceStore.getState();

      // Start session (should fail)
      await act(async () => {
        await store.startSession();
      });

      // Get updated state after the failed action
      const store = useVoiceStore.getState();

      expect(store.status).toBe('error');
      expect(updatedStore.error).toEqual({
        code: 'SESSION_START_FAILED',
        message: expect.stringContaining('Failed to start session'),
        timestamp: expect.any(Number),
        details: expect.any(Object),
      });
      expect(updatedStore.sessionId).toBeNull();
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
  });

  describe('Vector Store Integration', () => {
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
  });
});
