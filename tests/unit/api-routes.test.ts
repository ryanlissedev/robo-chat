import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies before imports
vi.mock('@/lib/server/api');
vi.mock('@/lib/langsmith/client');
vi.mock('@/lib/supabase/server');
vi.mock('@/lib/providers/index', () => ({
  PROVIDERS: [
    { id: 'openai', name: 'OpenAI', available: true, icon: () => null },
    { id: 'anthropic', name: 'Anthropic', available: true, icon: () => null },
  ],
}));

// Import the functions we're testing
import {
  GET as feedbackGET,
  POST as feedbackPOST,
} from '@/app/api/feedback/route';
import { GET as healthGet } from '@/app/api/health/route';
import { GET as userKeyStatusGET } from '@/app/api/user-key-status/route';
import {
  GET as favoriteModelsGet,
  POST as favoriteModelsPost,
} from '@/app/api/user-preferences/favorite-models/route';

describe('API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('/api/feedback', () => {
    describe('POST', () => {
      it('should return 400 if messageId is missing', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            feedback: 'upvote',
            userId: 'test-user-id',
          }),
        } as unknown as Request;

        const response = await feedbackPOST(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toBe('Message ID and feedback are required');
      });

      it('should return 400 if feedback is missing', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            messageId: 'test-message-id',
            userId: 'test-user-id',
          }),
        } as unknown as Request;

        const response = await feedbackPOST(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toBe('Message ID and feedback are required');
      });

      it('should return 400 for invalid feedback type', async () => {
        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            messageId: 'test-message-id',
            feedback: 'invalid-feedback',
            userId: 'test-user-id',
          }),
        } as unknown as Request;

        const response = await feedbackPOST(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toBe('Invalid feedback type');
      });

      it('should return 200 even if user authentication fails', async () => {
        // Mock createClient to return null (auth fails)
        const { createClient } = await import('@/lib/supabase/server');
        vi.mocked(createClient).mockResolvedValue(null);

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            messageId: 'test-message-id',
            feedback: 'upvote',
            userId: 'test-user-id',
          }),
        } as unknown as Request;

        const response = await feedbackPOST(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.message).toBe('Feedback submitted successfully');
      });

      it('should return 200 even if getUser fails', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: new Error('Auth error'),
            }),
          },
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            messageId: 'test-message-id',
            feedback: 'upvote',
            userId: 'test-user-id',
          }),
        } as unknown as Request;

        const response = await feedbackPOST(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.message).toBe('Feedback submitted successfully');
      });

      it('should return 200 even if database insert fails', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
          from: vi.fn().mockReturnValue({
            upsert: vi.fn().mockResolvedValue({
              error: new Error('Database error'),
            }),
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            messageId: 'test-message-id',
            feedback: 'upvote',
            userId: 'test-user-id',
          }),
        } as unknown as Request;

        const response = await feedbackPOST(mockRequest);
        const json = await response.json();

        // Should still succeed for LangSmith even if DB fails
        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.message).toBe('Feedback submitted successfully');
      });

      it('should successfully submit feedback without runId', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
          from: vi.fn().mockReturnValue({
            upsert: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            messageId: 'test-message-id',
            feedback: 'upvote',
            comment: 'Great response!',
            userId: 'test-user-id',
          }),
        } as unknown as Request;

        const response = await feedbackPOST(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.message).toBe('Feedback submitted successfully');
        expect(json.langsmith).toBe(null);
      });

      it('should successfully submit feedback with runId and call LangSmith', async () => {
        // Mock createClient for Supabase
        const { createClient } = await import('@/lib/supabase/server');
        const { createFeedback } = await import('@/lib/langsmith/client');

        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
          from: vi.fn().mockReturnValue({
            upsert: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
        vi.mocked(createFeedback).mockResolvedValue({
          success: true,
          runId: 'test-run-id',
          feedback: 'upvote',
          score: 1,
        });

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            messageId: 'test-message-id',
            feedback: 'upvote',
            comment: 'Great response!',
            runId: 'test-run-id',
            userId: 'test-user-id',
          }),
        } as unknown as Request;

        const response = await feedbackPOST(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.message).toBe('Feedback submitted successfully');
        expect(json.langsmith).toEqual({
          success: true,
          runId: 'test-run-id',
          feedback: 'upvote',
          score: 1,
        });
        expect(createFeedback).toHaveBeenCalledWith({
          runId: 'test-run-id',
          feedback: 'upvote',
          score: 1,
          comment: 'Great response!',
          userId: 'test-user-id',
        });
      });

      it('should handle LangSmith failure gracefully', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        const { createFeedback } = await import('@/lib/langsmith/client');

        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
          from: vi.fn().mockReturnValue({
            upsert: vi.fn().mockResolvedValue({
              error: null,
            }),
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);
        vi.mocked(createFeedback).mockRejectedValue(
          new Error('LangSmith error')
        );

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            messageId: 'test-message-id',
            feedback: 'upvote',
            runId: 'test-run-id',
            userId: 'test-user-id',
          }),
        } as unknown as Request;

        const response = await feedbackPOST(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.message).toBe('Feedback submitted successfully');
      });

      it('should handle unexpected errors', async () => {
        const mockRequest = {
          json: vi.fn().mockRejectedValue(new Error('JSON parse error')),
        } as unknown as Request;

        const response = await feedbackPOST(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json.error).toBe('Internal server error');
      });
    });

    describe('GET', () => {
      it('should return 400 if messageId is missing', async () => {
        const mockRequest = {
          url: 'http://localhost/api/feedback?userId=test-user-id',
        } as Request;

        const response = await feedbackGET(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toBe('Message ID is required');
      });

      it('should return 500 if createClient fails', async () => {
        const mockRequest = {
          url: 'http://localhost/api/feedback?messageId=test-message-id',
        } as Request;

        // Mock createClient to throw
        const { createClient } = await import('@/lib/supabase/server');
        vi.mocked(createClient).mockImplementation(async () => {
          throw new Error('Supabase error');
        });

        const response = await feedbackGET(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json.error).toBe('Database connection failed');
      });

      it('should return 401 if user authentication fails', async () => {
        const { createClient } = await import('@/lib/supabase/server');

        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: new Error('Auth error'),
            }),
          },
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const mockRequest = {
          url: 'http://localhost/api/feedback?messageId=test-message-id',
        } as Request;

        const response = await feedbackGET(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json.error).toBe('Unauthorized');
      });

      it('should return feedback successfully', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: {
                        message: 'upvote: Great response!',
                        created_at: '2023-01-01T00:00:00Z',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const mockRequest = {
          url: 'http://localhost/api/feedback?messageId=test-message-id',
        } as Request;

        const response = await feedbackGET(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.feedback).toBe('upvote: Great response!');
        expect(json.createdAt).toBe('2023-01-01T00:00:00Z');
      });

      it('should handle no feedback found', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: null,
                      error: { code: 'PGRST116' }, // No rows found
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const mockRequest = {
          url: 'http://localhost/api/feedback?messageId=test-message-id',
        } as Request;

        const response = await feedbackGET(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.feedback).toBe(null);
        expect(json.createdAt).toBe(null);
      });
    });
  });

  describe('/api/user-key-status', () => {
    describe('GET', () => {
      it('should return 500 when Supabase is not configured', async () => {
        const { createClient } = await import('@/lib/supabase/server');

        vi.mocked(createClient).mockResolvedValue(null);

        const response = await userKeyStatusGET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json.error).toBe('Supabase not available');
      });

      it('should return 401 when user is not authenticated', async () => {
        const { createClient } = await import('@/lib/supabase/server');

        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const response = await userKeyStatusGET();
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json.error).toBe('Unauthorized');
      });

      it('should return provider status based on user keys', async () => {
        const { createClient } = await import('@/lib/supabase/server');

        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: [{ provider: 'openai' }],
                error: null,
              }),
            }),
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const response = await userKeyStatusGET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({
          openai: true,
          anthropic: false,
        });
      });

      it('should return 500 if database query fails', async () => {
        const { createClient } = await import('@/lib/supabase/server');

        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const response = await userKeyStatusGET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json.error).toBe('Database error');
      });

      it('should handle unexpected errors', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        vi.mocked(createClient).mockRejectedValue(
          new Error('Unexpected error')
        );

        const response = await userKeyStatusGET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json.error).toBe('Internal server error');
      });
    });
  });

  describe('/api/user-preferences/favorite-models', () => {
    describe('GET', () => {
      it('should return 500 when Supabase is not configured', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        vi.mocked(createClient).mockResolvedValue(null);

        const response = await favoriteModelsGet();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json.error).toBe('Database connection failed');
      });

      it('should return 401 when user is not authenticated', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: null },
              error: null,
            }),
          },
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const response = await favoriteModelsGet();
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json.error).toBe('Unauthorized');
      });

      it('should return user favorite models', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { favorite_models: ['gpt-4', 'claude-3-opus'] },
                  error: null,
                }),
              }),
            }),
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const response = await favoriteModelsGet();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({
          favorite_models: ['gpt-4', 'claude-3-opus'],
        });
      });

      it('should handle database error', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
          from: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database error' },
                }),
              }),
            }),
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const response = await favoriteModelsGet();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json.error).toBe('Failed to fetch favorite models');
      });
    });

    describe('POST', () => {
      it('should return 500 when Supabase is not configured', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        vi.mocked(createClient).mockResolvedValue(null);

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            favorite_models: ['gpt-4'],
          }),
        } as unknown as NextRequest;

        const response = await favoriteModelsPost(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json.error).toBe('Database connection failed');
      });

      it('should return 400 if favorite_models is not an array', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            favorite_models: 'not-an-array',
          }),
        } as unknown as NextRequest;

        const response = await favoriteModelsPost(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toBe('favorite_models must be an array');
      });

      it('should return 400 if favorite_models contains non-string values', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            favorite_models: ['gpt-4', 123, 'claude-3-opus'],
          }),
        } as unknown as NextRequest;

        const response = await favoriteModelsPost(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json.error).toBe('All favorite_models must be strings');
      });

      it('should successfully update favorite models', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
          from: vi.fn().mockReturnValue({
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: { favorite_models: ['gpt-4', 'claude-3-opus'] },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            favorite_models: ['gpt-4', 'claude-3-opus'],
          }),
        } as unknown as NextRequest;

        const response = await favoriteModelsPost(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({
          success: true,
          favorite_models: ['gpt-4', 'claude-3-opus'],
        });
      });

      it('should handle database update error', async () => {
        const { createClient } = await import('@/lib/supabase/server');
        const mockSupabase = {
          auth: {
            getUser: vi.fn().mockResolvedValue({
              data: { user: { id: 'test-user-id' } },
              error: null,
            }),
          },
          from: vi.fn().mockReturnValue({
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { message: 'Update failed' },
                  }),
                }),
              }),
            }),
          }),
        };
        vi.mocked(createClient).mockResolvedValue(mockSupabase as any);

        const mockRequest = {
          json: vi.fn().mockResolvedValue({
            favorite_models: ['gpt-4'],
          }),
        } as unknown as NextRequest;

        const response = await favoriteModelsPost(mockRequest);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json.error).toBe('Failed to update favorite models');
      });
    });
  });

  describe('/api/health', () => {
    describe('GET', () => {
      it('should return health status', async () => {
        // Mock process.uptime() to return a consistent value
        const originalUptime = process.uptime;
        process.uptime = vi.fn().mockReturnValue(123.45);

        const response = await healthGet();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.status).toBe('ok');
        expect(json.uptime).toBe(123.45);
        expect(json.timestamp).toMatch(
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/
        );

        // Restore original uptime function
        process.uptime = originalUptime;
      });

      it('should always return status ok', async () => {
        const response1 = await healthGet();
        const json1 = await response1.json();

        const response2 = await healthGet();
        const json2 = await response2.json();

        expect(response1.status).toBe(200);
        expect(response2.status).toBe(200);
        expect(json1.status).toBe('ok');
        expect(json2.status).toBe('ok');
      });

      it('should return current timestamp', async () => {
        const beforeTest = new Date();

        const response = await healthGet();
        const json = await response.json();

        const afterTest = new Date();
        const responseTime = new Date(json.timestamp);

        expect(responseTime.getTime()).toBeGreaterThanOrEqual(
          beforeTest.getTime()
        );
        expect(responseTime.getTime()).toBeLessThanOrEqual(afterTest.getTime());
      });
    });
  });
});
