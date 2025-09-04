import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules BEFORE importing the route
vi.mock('@/lib/langsmith/client', () => ({
  createFeedback: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { POST } from '@/app/api/feedback/route';

import * as langsmithModule from '@/lib/langsmith/client';
import * as supabaseServerModule from '@/lib/supabase/server';

describe('Debug Mock Chain', () => {
  const mockCreateClient = supabaseServerModule.createClient as any;
  const mockCreateLangSmithFeedback = langsmithModule.createFeedback as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should debug the actual mock chain behavior', async () => {
    // Create a simple spy-based mock
    const upsertSpy = vi.fn().mockResolvedValue({ error: null });
    const fromSpy = vi.fn().mockReturnValue({ upsert: upsertSpy });

    const mockSupabaseClient = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: fromSpy,
    };

    mockCreateClient.mockResolvedValue(mockSupabaseClient);
    mockCreateLangSmithFeedback.mockResolvedValue({ id: 'feedback-123' });

    // Create request
    const request = new Request('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messageId: 'msg-123',
        feedback: 'upvote',
        comment: 'Test comment',
        runId: 'run-123',
      }),
    });

    // Make the call
    const response = await POST(request);

    // Debug the calls
    console.log('Response status:', response.status);
    console.log('from() calls:', fromSpy.mock.calls);
    console.log('upsert() calls:', upsertSpy.mock.calls);
    console.log('LangSmith calls:', mockCreateLangSmithFeedback.mock.calls);

    // Basic assertions
    expect(response.status).toBe(200);
    expect(fromSpy).toHaveBeenCalledWith('feedback');
    expect(upsertSpy).toHaveBeenCalledWith({
      message: 'upvote: Test comment',
      user_id: 'user-123',
    });
  });
});
