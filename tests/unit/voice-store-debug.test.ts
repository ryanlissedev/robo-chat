import { act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock fetch BEFORE importing the store
const mockFetch = vi.fn();
global.fetch = mockFetch;
vi.stubGlobal('fetch', mockFetch);

import { useVoiceStore } from '@/components/app/voice/store/voice-store';

describe('Voice Store - Debug Tests', () => {
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    mockFetch.mockReset();

    // Setup global fetch mock
    global.fetch = mockFetch;
    vi.stubGlobal('fetch', mockFetch);

    // Reset store
    const store = useVoiceStore.getState();
    store.reset();
  });

  it('should have clean state after reset', () => {
    const store = useVoiceStore.getState();
    console.log('Store state after reset:', {
      sessionId: store.sessionId,
      status: store.status,
      isRecording: store.isRecording,
    });

    expect(store.sessionId).toBeNull();
    expect(store.status).toBe('idle');
    expect(store.isRecording).toBe(false);
  });

  it('should call fetch when starting session', async () => {
    // Setup mock response
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ sessionId: 'test-123' }),
    });

    const store = useVoiceStore.getState();

    console.log('Store state before startSession:', {
      sessionId: store.sessionId,
      status: store.status,
    });

    await act(async () => {
      await store.startSession();
    });

    console.log('Mock fetch called times:', mockFetch.mock.calls.length);
    console.log('Mock fetch calls:', mockFetch.mock.calls);

    const updatedStore = useVoiceStore.getState();
    console.log('Store state after startSession:', {
      sessionId: updatedStore.sessionId,
      status: updatedStore.status,
      error: updatedStore.error,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(updatedStore.sessionId).toBe('test-123');
  });
});
