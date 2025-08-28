import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockedFunction,
  vi,
} from 'vitest';
import { GET, POST } from '@/app/api/feedback/route';
// Mock modules before importing
vi.mock('@/lib/langsmith/client', () => ({
  createFeedback: vi.fn()
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn()
}));

// Import after mocking
import * as langsmithModule from '@/lib/langsmith/client';
import * as supabaseServerModule from '@/lib/supabase/server';

describe('Feedback API Route', () => {
  const mockCreateClient =
    supabaseServerModule.createClient as MockedFunction<
      typeof supabaseServerModule.createClient
    >;
  const mockCreateLangSmithFeedback =
    langsmithModule.createFeedback as MockedFunction<
      typeof langsmithModule.createFeedback
    >;

  // Create a proper mock using the working pattern from debug test  
  const createMockSupabaseClient = (options: { singleResponse?: any } = {}) => {
    // Create completely fresh spies each time and assign to global variables
    upsertSpy = vi.fn().mockResolvedValue({ error: null });
    
    const defaultSingleResponse = {
      data: {
        message: 'upvote: Great response!',
        created_at: '2024-01-01T00:00:00Z',
      },
      error: null,
    };
    
    singleSpy = vi.fn().mockResolvedValue(
      options.singleResponse || defaultSingleResponse
    );
    
    selectSpy = vi.fn();
    eqSpy = vi.fn();
    orderSpy = vi.fn();
    limitSpy = vi.fn();

    const queryChainMock = {
      upsert: upsertSpy,
      select: selectSpy,
      eq: eqSpy,
      order: orderSpy,
      limit: limitSpy,
      single: singleSpy,
    };

    // Set up proper chaining for query methods
    selectSpy.mockReturnValue(queryChainMock);
    eqSpy.mockReturnValue(queryChainMock);
    orderSpy.mockReturnValue(queryChainMock);
    limitSpy.mockReturnValue(queryChainMock);

    fromSpy = vi.fn().mockReturnValue(queryChainMock);

    const mock: any = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-123' } },
          error: null,
        }),
      },
      from: fromSpy,
    };

    return mock;
  };

  // Helper function for creating valid requests - moved to top level
  const createValidRequest = (overrides = {}) => {
    const defaultBody = {
      messageId: 'msg-123',
      feedback: 'upvote',
      comment: 'Great response!',
      runId: 'run-456',
    };
    
    // Create the final body, handling undefined values properly
    const finalBody = { ...defaultBody };
    
    // Apply overrides and remove undefined values
    Object.keys(overrides).forEach(key => {
      const value = overrides[key];
      if (value === undefined) {
        delete finalBody[key];
      } else {
        finalBody[key] = value;
      }
    });

    return new Request('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalBody),
    });
  };

  let mockSupabaseClient: any;
  
  // Global spy variables for accessing in tests
  let upsertSpy: any;
  let selectSpy: any;
  let eqSpy: any;
  let orderSpy: any;
  let limitSpy: any;
  let singleSpy: any;
  let fromSpy: any;

  // Individual tests will handle their own mock setup to avoid conflicts

  describe('POST /api/feedback', () => {
    it('should successfully submit upvote feedback', async () => {
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockCreateLangSmithFeedback.mockResolvedValue({
        id: 'feedback-123',
      });
      
      const request = createValidRequest();
      const response = await POST(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Feedback submitted successfully');

      expect(mockSupabaseClient.auth.getUser).toHaveBeenCalled();
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('feedback');
      
      // Get the query chain returned by from()
      const upvoteQueryChain = mockSupabaseClient.from('feedback');
      expect(upvoteQueryChain.upsert).toHaveBeenCalledWith({
        message: 'upvote: Great response!',
        user_id: 'user-123',
      } as never);
    });

    it('should successfully submit downvote feedback', async () => {
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockCreateLangSmithFeedback.mockResolvedValue({
        id: 'feedback-123',
      });
      
      const request = createValidRequest({
        feedback: 'downvote',
        comment: 'Could be better',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Get the query chain returned by from()
      const downvoteQueryChain = mockSupabaseClient.from('feedback');
      expect(downvoteQueryChain.upsert).toHaveBeenCalledWith({
        message: 'downvote: Could be better',
        user_id: 'user-123',
      } as never);
    });

    it('should handle feedback without comment', async () => {
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockCreateLangSmithFeedback.mockResolvedValue({
        id: 'feedback-123',
      });
      
      const request = createValidRequest({
        comment: undefined,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Get the query chain returned by from()
      const noCommentQueryChain = mockSupabaseClient.from('feedback');
      expect(noCommentQueryChain.upsert).toHaveBeenCalledWith({
        message: 'upvote',
        user_id: 'user-123',
      } as never);
    });

    it('should validate required fields', async () => {
      const request = createValidRequest({
        messageId: undefined,
        runId: undefined, // No runId means validation should fail
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const errorData = await response.json();
      expect(errorData.error).toBe('Message ID and feedback are required');
    });

    it('should validate feedback type', async () => {
      const request = createValidRequest({
        feedback: 'invalid-feedback',
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const errorData = await response.json();
      expect(errorData.error).toBe('Invalid feedback type');
    });

    it('should allow null feedback type', async () => {
      const request = createValidRequest({
        feedback: null,
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should handle authentication failure', async () => {
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockCreateLangSmithFeedback.mockResolvedValue({ id: 'feedback-123' });
      
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const request = createValidRequest();
      const response = await POST(request);

      expect(response.status).toBe(200); // Should still succeed but without DB storage

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Feedback submitted successfully');
    });

    it('should handle user authentication error', async () => {
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockCreateLangSmithFeedback.mockResolvedValue({ id: 'feedback-123' });
      
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Auth failed'),
      });

      const request = createValidRequest();
      const response = await POST(request);

      expect(response.status).toBe(200); // Should still succeed without DB storage

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Feedback submitted successfully');
    });

    it('should handle database error', async () => {
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockCreateLangSmithFeedback.mockResolvedValue({ id: 'feedback-123' });
      
      // Get the query chain and mock its upsert to return an error
      const dbErrorQueryChain = mockSupabaseClient.from('feedback');
      dbErrorQueryChain.upsert.mockResolvedValueOnce({
        error: new Error('Database connection failed'),
      });

      const request = createValidRequest();
      const response = await POST(request);

      expect(response.status).toBe(200); // Should still succeed for LangSmith

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Feedback submitted successfully');
    });

    it('should send feedback to LangSmith when run ID is provided', async () => {
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockCreateLangSmithFeedback.mockResolvedValue({
        id: 'feedback-123',
      });
      
      const request = createValidRequest({
        runId: 'langsmith-run-123',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockCreateLangSmithFeedback).toHaveBeenCalledWith({
        runId: 'langsmith-run-123',
        feedback: 'upvote',
        score: 1,
        comment: 'Great response!',
        userId: 'user-123',
      });

      const responseData = await response.json();
      expect(responseData.langsmith).toEqual({ id: 'feedback-123' });
    });

    it('should handle LangSmith error silently', async () => {
      // Simple mock setup like the working debug test
      vi.clearAllMocks();
      
      // Create simple mocks without complex spy tracking
      const upsertSpy = vi.fn().mockResolvedValue({ error: null });
      const fromSpy = vi.fn().mockReturnValue({ upsert: upsertSpy });
      
      mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: fromSpy,
      };
      
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      
      // Set up LangSmith to reject - this is the key part being tested
      mockCreateLangSmithFeedback.mockRejectedValue(new Error('LangSmith API error'));

      const request = createValidRequest({
        runId: 'test-run-id',
        feedback: 'upvote',
        comment: 'Test comment',
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.langsmith).toBeNull();
      
      // Verify LangSmith was attempted
      expect(mockCreateLangSmithFeedback).toHaveBeenCalledWith({
        runId: 'test-run-id',
        feedback: 'upvote',
        score: 1,
        comment: 'Test comment',
        userId: 'user-123',
      });
    });

    it('should not send to LangSmith when run ID is missing', async () => {
      // Clear mocks and ensure fresh state
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      
      const request = createValidRequest({
        runId: undefined,
      });

      // Debug: Let's log what's actually in the request
      const requestBody = await request.clone().json();
      console.log('Request body for no runId test:', requestBody);

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockCreateLangSmithFeedback).not.toHaveBeenCalled();

      const responseData = await response.json();
      expect(responseData.langsmith).toBeNull();
    });

    it('should handle malformed JSON', async () => {
      const request = new Request('http://localhost:3000/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const errorData = await response.json();
      expect(errorData.error).toBe('Internal server error');
    });

    it('should handle missing user gracefully', async () => {
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockCreateLangSmithFeedback.mockResolvedValue({
        id: 'feedback-123',
      });
      
      // Mock auth.getUser to return null user (simulating no authentication)
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const request = createValidRequest();

      const response = await POST(request);
      expect(response.status).toBe(200); // Should still succeed for LangSmith

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
    });

    it('should map feedback scores correctly', async () => {
      // Simple mock setup like the working debug test
      vi.clearAllMocks();
      
      // Test upvote
      const upsertSpy1 = vi.fn().mockResolvedValue({ error: null });
      const fromSpy1 = vi.fn().mockReturnValue({ upsert: upsertSpy1 });
      
      mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: fromSpy1,
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockCreateLangSmithFeedback.mockResolvedValue({ id: 'feedback-123' });

      let request = createValidRequest({ feedback: 'upvote', runId: 'test-run-1' });
      await POST(request);
      expect(mockCreateLangSmithFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ score: 1, feedback: 'upvote', runId: 'test-run-1' })
      );

      // Test downvote - fresh mock setup
      vi.clearAllMocks();
      const upsertSpy2 = vi.fn().mockResolvedValue({ error: null });
      const fromSpy2 = vi.fn().mockReturnValue({ upsert: upsertSpy2 });
      
      mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: fromSpy2,
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockCreateLangSmithFeedback.mockResolvedValue({ id: 'feedback-123' });

      request = createValidRequest({ feedback: 'downvote', runId: 'test-run-2' });
      await POST(request);
      expect(mockCreateLangSmithFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ score: 0, feedback: 'downvote', runId: 'test-run-2' })
      );

      // Test null feedback - fresh mock setup
      vi.clearAllMocks();
      const upsertSpy3 = vi.fn().mockResolvedValue({ error: null });
      const fromSpy3 = vi.fn().mockReturnValue({ upsert: upsertSpy3 });
      
      mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: fromSpy3,
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockCreateLangSmithFeedback.mockResolvedValue({ id: 'feedback-123' });

      request = createValidRequest({ feedback: null, runId: 'test-run-3' });
      await POST(request);
      expect(mockCreateLangSmithFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ score: undefined, feedback: null, runId: 'test-run-3' })
      );
    });
  });

  describe('GET /api/feedback', () => {
    const createGetRequest = (messageId = 'msg-123') => {
      const url = new URL('http://localhost:3000/api/feedback');
      if (messageId) url.searchParams.set('messageId', messageId);

      return new Request(url.toString(), {
        method: 'GET',
      });
    };

    it('should successfully retrieve feedback', async () => {
      // Simple mock setup for GET request
      vi.clearAllMocks();
      
      // Set up successful auth response
      const getResponse = {
        message: 'upvote: Great response!',
        created_at: '2024-01-01T00:00:00Z',
      };

      // Create mock chain for GET request (.select().eq().order().limit().single())
      const singleSpy = vi.fn().mockResolvedValue({ data: getResponse, error: null });
      const limitSpy = vi.fn().mockReturnValue({ single: singleSpy });
      const orderSpy = vi.fn().mockReturnValue({ limit: limitSpy });
      const eqSpy = vi.fn().mockReturnValue({ order: orderSpy });
      const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      const fromSpy = vi.fn().mockReturnValue({ select: selectSpy });

      mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: fromSpy,
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);

      const request = new Request(
        'http://localhost:3000/api/feedback?messageId=msg-123',
        {
          method: 'GET',
        }
      );

      const response = await GET(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: true,
        feedback: 'upvote: Great response!',
        createdAt: '2024-01-01T00:00:00Z',
      });

      // Verify correct query chain
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('feedback');
      expect(selectSpy).toHaveBeenCalledWith('message, created_at');
      expect(eqSpy).toHaveBeenCalledWith('user_id', 'user-123');
      expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(limitSpy).toHaveBeenCalledWith(1);
      expect(singleSpy).toHaveBeenCalled();
    });

    it('should validate required parameters', async () => {
      const request = createGetRequest(''); // Missing messageId
      const response = await GET(request);

      expect(response.status).toBe(400);

      const errorData = await response.json();
      expect(errorData.error).toBe('Message ID is required');
    });

    it('should handle missing authentication', async () => {
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(401);

      const errorData = await response.json();
      expect(errorData.error).toBe('Unauthorized');
    });

    it('should handle authentication error', async () => {
      // Set up mocks properly for this test
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Auth failed'),
      });

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(401);

      const errorData = await response.json();
      expect(errorData.error).toBe('Unauthorized');
    });

    it('should handle supabase connection failure', async () => {
      mockCreateClient.mockResolvedValue(null);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(500);

      const errorData = await response.json();
      expect(errorData.error).toBe('Database connection failed');
    });

    it('should handle no feedback found (PGRST116)', async () => {
      // Simple mock setup for GET request with PGRST116 error
      vi.clearAllMocks();
      
      // Create mock chain for GET request that returns PGRST116 error
      const singleSpy = vi.fn().mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116', message: 'No rows found' } 
      });
      const limitSpy = vi.fn().mockReturnValue({ single: singleSpy });
      const orderSpy = vi.fn().mockReturnValue({ limit: limitSpy });
      const eqSpy = vi.fn().mockReturnValue({ order: orderSpy });
      const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      const fromSpy = vi.fn().mockReturnValue({ select: selectSpy });

      mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: fromSpy,
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);

      const request = new Request(
        'http://localhost:3000/api/feedback?messageId=msg-123',
        {
          method: 'GET',
        }
      );

      const response = await GET(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: true,
        feedback: null,
        createdAt: null,
      });
    });

    it('should handle database errors', async () => {
      // Simple mock setup for GET request with database error
      vi.clearAllMocks();
      
      // Create mock chain for GET request that returns database error (not PGRST116)
      const singleSpy = vi.fn().mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST001', message: 'Database error' } 
      });
      const limitSpy = vi.fn().mockReturnValue({ single: singleSpy });
      const orderSpy = vi.fn().mockReturnValue({ limit: limitSpy });
      const eqSpy = vi.fn().mockReturnValue({ order: orderSpy });
      const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      const fromSpy = vi.fn().mockReturnValue({ select: selectSpy });

      mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: fromSpy,
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(500);

      const errorData = await response.json();
      expect(errorData.error).toBe('Database error');
    });

    it('should handle unexpected errors', async () => {
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      
      mockSupabaseClient.auth.getUser.mockRejectedValue(
        new Error('Unexpected error')
      );

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(500);

      const errorData = await response.json();
      expect(errorData.error).toBe('Internal server error');
    });

    it('should query feedback with correct ordering', async () => {
      // Simple mock setup for GET request to verify ordering
      vi.clearAllMocks();
      
      // Create mock chain for GET request with spy tracking
      const getResponse = {
        message: 'upvote: Great response!',
        created_at: '2024-01-01T00:00:00Z',
      };
      const singleSpy = vi.fn().mockResolvedValue({ data: getResponse, error: null });
      const limitSpy = vi.fn().mockReturnValue({ single: singleSpy });
      const orderSpy = vi.fn().mockReturnValue({ limit: limitSpy });
      const eqSpy = vi.fn().mockReturnValue({ order: orderSpy });
      const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      const fromSpy = vi.fn().mockReturnValue({ select: selectSpy });

      mockSupabaseClient = {
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: { id: 'user-123' } },
            error: null,
          }),
        },
        from: fromSpy,
      };

      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      
      const request = createGetRequest();
      await GET(request);

      // Verify the query chain methods were called correctly
      expect(selectSpy).toHaveBeenCalledWith('message, created_at');
      expect(eqSpy).toHaveBeenCalledWith('user_id', 'user-123');
      expect(orderSpy).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(limitSpy).toHaveBeenCalledWith(1);
      expect(singleSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle concurrent feedback submissions', async () => {
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      mockCreateLangSmithFeedback.mockResolvedValue({
        id: 'feedback-123',
      });
      
      const request1 = createValidRequest({ messageId: 'msg-1' });
      const request2 = createValidRequest({ messageId: 'msg-2' });

      const [response1, response2] = await Promise.all([
        POST(request1),
        POST(request2),
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it('should handle very long comments', async () => {
      // Simple mock setup like the working debug test
      vi.clearAllMocks();
      
      const longComment = 'x'.repeat(10000); // Very long comment
      
      const upsertSpy = vi.fn().mockResolvedValue({ error: null });
      const fromSpy = vi.fn().mockReturnValue({ upsert: upsertSpy });
      
      mockSupabaseClient = {
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

      const request = createValidRequest({
        comment: longComment,
        feedback: 'upvote',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData.success).toBe(true);

      // Verify the upsert was called with the long comment
      expect(upsertSpy).toHaveBeenCalledWith({
        message: `upvote: ${longComment}`,
        user_id: 'user-123',
      } as never);
    });

    it('should handle special characters in comments', async () => {
      // Create fresh mock client for this test
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      
      const specialComment = 'Comment with émojis 🎉 and "quotes" & symbols!';
      const request = createValidRequest({ comment: specialComment, runId: undefined });

      const response = await POST(request);
      expect(response.status).toBe(200);

      // Get the fresh query chain and check upsert call
      const specialCommentQueryChain = mockSupabaseClient.from('feedback');
      expect(specialCommentQueryChain.upsert).toHaveBeenCalledWith({
        message: `upvote: ${specialComment}`,
        user_id: 'user-123',
      } as never);
    });

    it('should handle database constraint violations', async () => {
      // Reset mocks for this test
      vi.clearAllMocks();
      mockSupabaseClient = createMockSupabaseClient();
      mockCreateClient.mockResolvedValue(mockSupabaseClient);
      
      // Get the query chain and mock its upsert to return an error
      const constraintQueryChain = mockSupabaseClient.from('feedback');
      constraintQueryChain.upsert.mockResolvedValueOnce({
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint',
        },
      });

      const request = createValidRequest();
      const response = await POST(request);

      expect(response.status).toBe(200); // Should still succeed for LangSmith

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Feedback submitted successfully');
    });
  });
});
