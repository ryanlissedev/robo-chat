import { describe, it, expect, vi, beforeEach, afterEach, type MockedFunction } from 'vitest';
import { POST, GET } from '@/app/api/feedback/route';
import * as langsmithModule from '@/lib/langsmith/client';
import * as serverApiModule from '@/lib/server/api';

// Mock modules
vi.mock('@/lib/langsmith/client');
vi.mock('@/lib/server/api');

describe('Feedback API Route', () => {
  const mockValidateUserIdentity = serverApiModule.validateUserIdentity as MockedFunction<typeof serverApiModule.validateUserIdentity>;
  const mockCreateLangSmithFeedback = langsmithModule.createFeedback as MockedFunction<typeof langsmithModule.createFeedback>;


  // Create a proper mock that returns itself for chaining
  const createMockSupabaseClient = () => {
    const mock: any = {};
    
    // First define all the methods that don't return mock
    mock.upsert = vi.fn().mockResolvedValue({ error: null });
    mock.single = vi.fn().mockResolvedValue({ 
      data: { message: 'upvote: Great response!', created_at: '2024-01-01T00:00:00Z' },
      error: null 
    });
    mock.maybeSingle = vi.fn().mockResolvedValue({ 
      data: { message: 'upvote: Great response!', created_at: '2024-01-01T00:00:00Z' },
      error: null 
    });
    mock.auth = {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-123' } },
        error: null
      })
    };
    
    // Then define the methods that return mock for chaining
    mock.from = vi.fn().mockReturnValue(mock);
    mock.select = vi.fn().mockReturnValue(mock);
    mock.eq = vi.fn().mockReturnValue(mock);
    mock.order = vi.fn().mockReturnValue(mock);
    mock.limit = vi.fn().mockReturnValue(mock);
    
    return mock;
  };

  // Helper function for creating valid requests - moved to top level
  const createValidRequest = (overrides = {}) => {
    const defaultBody = {
      messageId: 'msg-123',
      feedback: 'upvote',
      comment: 'Great response!',
      runId: 'run-456',
      userId: 'user-123',
      ...overrides
    };

    return new Request('http://localhost:3000/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(defaultBody)
    });
  };

  let mockSupabaseClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient = createMockSupabaseClient();
    mockValidateUserIdentity.mockResolvedValue(mockSupabaseClient);
    mockCreateLangSmithFeedback.mockResolvedValue({ 
      id: 'feedback-123'
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /api/feedback', () => {

    it('should successfully submit upvote feedback', async () => {
      const request = createValidRequest();
      const response = await POST(request);

      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.message).toBe('Feedback submitted successfully');

      expect(mockValidateUserIdentity).toHaveBeenCalledWith('user-123', true);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('feedback');
      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith({
        message: 'upvote: Great response!',
        user_id: 'user-123'
      });
    });

    it('should successfully submit downvote feedback', async () => {
      const request = createValidRequest({
        feedback: 'downvote',
        comment: 'Could be better'
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith({
        message: 'downvote: Could be better',
        user_id: 'user-123'
      });
    });

    it('should handle feedback without comment', async () => {
      const request = createValidRequest({
        comment: undefined
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith({
        message: 'upvote',
        user_id: 'user-123'
      });
    });

    it('should validate required fields', async () => {
      const request = createValidRequest({
        messageId: undefined
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const errorData = await response.json();
      expect(errorData.error).toBe('Message ID and feedback are required');
    });

    it('should validate feedback type', async () => {
      const request = createValidRequest({
        feedback: 'invalid-feedback'
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const errorData = await response.json();
      expect(errorData.error).toBe('Invalid feedback type');
    });

    it('should allow null feedback type', async () => {
      const request = createValidRequest({
        feedback: null
      });

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('should handle authentication failure', async () => {
      mockValidateUserIdentity.mockResolvedValue(null);

      const request = createValidRequest();
      const response = await POST(request);

      expect(response.status).toBe(401);
      
      const errorData = await response.json();
      expect(errorData.error).toBe('User authentication required');
    });

    it('should handle user authentication error', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Auth failed')
      });

      const request = createValidRequest();
      const response = await POST(request);

      expect(response.status).toBe(401);
      
      const errorData = await response.json();
      expect(errorData.error).toBe('Failed to authenticate user');
    });

    it('should handle database error', async () => {
      mockSupabaseClient.upsert.mockResolvedValue({
        error: new Error('Database connection failed')
      });

      const request = createValidRequest();
      const response = await POST(request);

      expect(response.status).toBe(500);
      
      const errorData = await response.json();
      expect(errorData.error).toBe('Failed to save feedback');
    });

    it('should send feedback to LangSmith when run ID is provided', async () => {
      const request = createValidRequest({
        runId: 'langsmith-run-123'
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockCreateLangSmithFeedback).toHaveBeenCalledWith({
        runId: 'langsmith-run-123',
        feedback: 'upvote',
        score: 1,
        comment: 'Great response!',
        userId: 'user-123'
      });

      const responseData = await response.json();
      expect(responseData.langsmith).toEqual({ id: 'feedback-123' });
    });

    it('should handle LangSmith error silently', async () => {
      mockCreateLangSmithFeedback.mockRejectedValue(new Error('LangSmith API failed'));

      const request = createValidRequest({
        runId: 'langsmith-run-123'
      });

      const response = await POST(request);
      expect(response.status).toBe(200); // Should still succeed

      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.langsmith).toBeNull();
    });

    it('should not send to LangSmith when run ID is missing', async () => {
      const request = createValidRequest({
        runId: undefined
      });

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
        body: 'invalid json'
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const errorData = await response.json();
      expect(errorData.error).toBe('Internal server error');
    });

    it('should handle missing userId gracefully', async () => {
      // Mock validateUserIdentity to return null for empty userId (simulating validation failure)
      mockValidateUserIdentity.mockResolvedValueOnce(null);
      
      const request = createValidRequest({
        userId: undefined
      });

      const response = await POST(request);
      expect(response.status).toBe(401); // Should fail validation

      expect(mockValidateUserIdentity).toHaveBeenCalledWith('', true);
    });

    it('should map feedback scores correctly', async () => {
      // Test upvote mapping
      let request = createValidRequest({ feedback: 'upvote' });
      await POST(request);
      expect(mockCreateLangSmithFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ score: 1 })
      );

      // Test downvote mapping
      request = createValidRequest({ feedback: 'downvote' });
      await POST(request);
      expect(mockCreateLangSmithFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ score: 0 })
      );

      // Test null feedback mapping  
      request = createValidRequest({ feedback: null });
      await POST(request);
      expect(mockCreateLangSmithFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ 
          feedback: null,
          score: undefined 
        })
      );
    });
  });

  describe('GET /api/feedback', () => {
    const createGetRequest = (messageId = 'msg-123', userId = 'user-123') => {
      const url = new URL('http://localhost:3000/api/feedback');
      if (messageId) url.searchParams.set('messageId', messageId);
      if (userId) url.searchParams.set('userId', userId);
      
      return new Request(url.toString(), {
        method: 'GET'
      });
    };

    it('should successfully retrieve feedback', async () => {
      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.feedback).toBe('upvote: Great response!');
      expect(responseData.createdAt).toBe('2024-01-01T00:00:00Z');

      expect(mockValidateUserIdentity).toHaveBeenCalledWith('user-123', true);
      expect(mockSupabaseClient.select).toHaveBeenCalledWith('message, created_at');
      expect(mockSupabaseClient.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should validate required parameters', async () => {
      const request = createGetRequest('', 'user-123'); // Missing messageId
      const response = await GET(request);

      expect(response.status).toBe(400);
      
      const errorData = await response.json();
      expect(errorData.error).toBe('Message ID and user ID are required');
    });

    it('should validate userId parameter', async () => {
      const request = createGetRequest('msg-123', ''); // Missing userId
      const response = await GET(request);

      expect(response.status).toBe(400);
      
      const errorData = await response.json();
      expect(errorData.error).toBe('Message ID and user ID are required');
    });

    it('should handle authentication failure', async () => {
      mockValidateUserIdentity.mockResolvedValue(null);

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(401);
      
      const errorData = await response.json();
      expect(errorData.error).toBe('User authentication required');
    });

    it('should handle user authentication error', async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new Error('Auth failed')
      });

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(401);
      
      const errorData = await response.json();
      expect(errorData.error).toBe('Failed to authenticate user');
    });

    it('should handle no feedback found (PGRST116)', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(200);
      
      const responseData = await response.json();
      expect(responseData.success).toBe(true);
      expect(responseData.feedback).toBeNull();
      expect(responseData.createdAt).toBeNull();
    });

    it('should handle database errors', async () => {
      mockSupabaseClient.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST001', message: 'Database error' }
      });

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(500);
      
      const errorData = await response.json();
      expect(errorData.error).toBe('Database error');
    });

    it('should handle unexpected errors', async () => {
      mockSupabaseClient.auth.getUser.mockRejectedValue(new Error('Unexpected error'));

      const request = createGetRequest();
      const response = await GET(request);

      expect(response.status).toBe(500);
      
      const errorData = await response.json();
      expect(errorData.error).toBe('Internal server error');
    });

    it('should query feedback with correct ordering', async () => {
      const request = createGetRequest();
      await GET(request);

      expect(mockSupabaseClient.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(mockSupabaseClient.limit).toHaveBeenCalledWith(1);
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle concurrent feedback submissions', async () => {
      const request1 = createValidRequest({ messageId: 'msg-1' });
      const request2 = createValidRequest({ messageId: 'msg-2' });

      const [response1, response2] = await Promise.all([
        POST(request1),
        POST(request2)
      ]);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
    });

    it('should handle very long comments', async () => {
      const longComment = 'a'.repeat(10000);
      const request = createValidRequest({ comment: longComment });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith({
        message: `upvote: ${longComment}`,
        user_id: 'user-123'
      });
    });

    it('should handle special characters in comments', async () => {
      const specialComment = 'Comment with émojis 🎉 and "quotes" & symbols!';
      const request = createValidRequest({ comment: specialComment });

      const response = await POST(request);
      expect(response.status).toBe(200);

      expect(mockSupabaseClient.upsert).toHaveBeenCalledWith({
        message: `upvote: ${specialComment}`,
        user_id: 'user-123'
      });
    });

    it('should handle database constraint violations', async () => {
      mockSupabaseClient.upsert.mockResolvedValue({
        error: { 
          code: '23505',
          message: 'duplicate key value violates unique constraint'
        }
      });

      const request = createValidRequest();
      const response = await POST(request);

      expect(response.status).toBe(500);
      
      const errorData = await response.json();
      expect(errorData.error).toBe('Failed to save feedback');
    });
  });
});