import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, PUT } from '@/app/api/user-preferences/route';
import {
  createMockSupabaseClient,
  setupTestEnvironment,
  resetEnvironment,
  createMockAuthUser,
  createMockAuthResponse,
} from '../../utils/supabase-mocks';

// Hoisted mocks
const mockCreateClient = vi.hoisted(() => vi.fn());
const mockRateLimit = vi.hoisted(() => vi.fn());
const mockAuthenticateRequest = vi.hoisted(() => vi.fn());
const mockGetUserPreferences = vi.hoisted(() => vi.fn());
const mockUpdateUserPreferences = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
}));

vi.mock('@/lib/middleware/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateRequest: mockAuthenticateRequest,
  getUserPreferences: mockGetUserPreferences,
  updateUserPreferences: mockUpdateUserPreferences,
}));

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  aud: 'authenticated',
};

const mockUserPreferences = {
  user_id: 'user-123',
  layout: 'fullscreen',
  prompt_suggestions: true,
  show_tool_invocations: true,
  show_conversation_previews: true,
  multi_model_enabled: false,
  hidden_models: ['model-1', 'model-2'],
};

const defaultPreferences = {
  layout: 'fullscreen',
  prompt_suggestions: true,
  show_tool_invocations: true,
  show_conversation_previews: true,
  multi_model_enabled: false,
  hidden_models: [],
};

describe('User Preferences API Route', () => {
  let mockSupabaseClient: any;
  let mockQuery: any;

  // Helper function for creating mock requests
  const createMockRequest = (body: any, method: string = 'PUT') => {
    const config: RequestInit = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };

    if (method !== 'GET' && body) {
      config.body = JSON.stringify(body);
    }

    return new NextRequest('http://localhost:3000/api/user-preferences', config);
  };

  // Helper function for creating GET requests
  const createMockGetRequest = () => {
    return new NextRequest('http://localhost:3000/api/user-preferences', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock rate limiting to allow all requests
    mockRateLimit.mockResolvedValue(null);

    // Setup test environment
    setupTestEnvironment(true);

    // Create mock client with query chain
    mockSupabaseClient = createMockSupabaseClient();

    // Setup query chain
    mockQuery = {
      select: vi.fn(() => mockQuery),
      eq: vi.fn(() => mockQuery),
      single: vi.fn(),
      upsert: vi.fn(() => mockQuery),
    };

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    // Setup default auth response
    const mockAuthResponse = createMockAuthResponse(createMockAuthUser(mockUser.id));
    mockSupabaseClient.auth.getUser.mockResolvedValue(mockAuthResponse);

    // Setup client creation
    mockCreateClient.mockResolvedValue(mockSupabaseClient);

    // Setup default authentication
    mockAuthenticateRequest.mockResolvedValue({
      isGuest: false,
      userId: mockUser.id,
      supabase: mockSupabaseClient,
      user: mockUser,
    });

    // Setup default preferences responses (will be overridden in specific tests)
    mockGetUserPreferences.mockResolvedValue({
      preferences: defaultPreferences,
    });

    mockUpdateUserPreferences.mockResolvedValue({
      preferences: mockUserPreferences,
    });
  });

  afterEach(() => {
    resetEnvironment();
    vi.restoreAllMocks();
  });

  describe('GET /api/user-preferences', () => {
    describe('Authentication', () => {
      it('should return 503 when database connection fails', async () => {
        mockAuthenticateRequest.mockRejectedValue(new Error('Database connection failed'));

        const response = await GET(createMockGetRequest());
        const json = await response.json();

        expect(response.status).toBe(503);
        expect(json).toEqual({
          error: 'Service temporarily unavailable',
          code: 'SERVICE_UNAVAILABLE',
          timestamp: expect.any(String),
        });
      });

      it('should return default preferences when user is not authenticated (guest mode)', async () => {
        mockAuthenticateRequest.mockResolvedValue({
          isGuest: true,
          userId: 'guest-user-123',
          supabase: mockSupabaseClient,
          user: { id: 'guest-user-123', anonymous: true },
        });

        mockGetUserPreferences.mockResolvedValue({
          preferences: defaultPreferences,
        });

        const response = await GET(createMockGetRequest());
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data).toBeDefined();
        expect(json.data).toEqual(defaultPreferences);
      });

      it('should return 401 when auth error occurs', async () => {
        mockAuthenticateRequest.mockRejectedValue(new Error('Unauthorized'));

        const response = await GET(createMockGetRequest());
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json).toEqual({
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
          timestamp: expect.any(String),
        });
      });
    });

    describe('Successful Preference Retrieval', () => {
      it('should return user preferences when they exist', async () => {
        mockGetUserPreferences.mockResolvedValue({
          preferences: {
            layout: 'fullscreen',
            prompt_suggestions: true,
            show_tool_invocations: true,
            show_conversation_previews: true,
            multi_model_enabled: false,
            hidden_models: ['model-1', 'model-2'],
            favorite_models: [],
          },
        });

        const response = await GET(createMockGetRequest());
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data).toEqual({
          layout: 'fullscreen',
          prompt_suggestions: true,
          show_tool_invocations: true,
          show_conversation_previews: true,
          multi_model_enabled: false,
          hidden_models: ['model-1', 'model-2'],
        });
      });

      it('should return default preferences when none exist for user', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' },
        });

        const response = await GET(createMockGetRequest());
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data).toEqual(defaultPreferences);
      });

      it('should handle null hidden_models correctly', async () => {
        mockQuery.single.mockResolvedValue({
          data: {
            ...mockUserPreferences,
            hidden_models: null,
          },
          error: null,
        });

        const response = await GET(createMockGetRequest());
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.hidden_models).toEqual([]);
      });

      it('should handle undefined hidden_models correctly', async () => {
        mockQuery.single.mockResolvedValue({
          data: {
            ...mockUserPreferences,
            hidden_models: undefined,
          },
          error: null,
        });

        const response = await GET(createMockGetRequest());
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.hidden_models).toEqual([]);
      });
    });

    describe('Database Errors', () => {
      it('should return 500 when database query fails', async () => {
        mockGetUserPreferences.mockRejectedValue(new Error('Failed to fetch user preferences'));

        const response = await GET(createMockGetRequest());
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: expect.any(String),
        });
      });

      it('should handle timeout errors gracefully', async () => {
        mockGetUserPreferences.mockRejectedValue(new Error('Failed to fetch user preferences'));

        const response = await GET(createMockGetRequest());
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: expect.any(String),
        });
      });
    });

    describe('Exception Handling', () => {
      it('should return 500 when unexpected error occurs', async () => {
        mockGetUserPreferences.mockRejectedValue(
          new Error('Unexpected error')
        );

        const response = await GET(createMockGetRequest());
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: expect.any(String),
        });
      });

      it('should handle network errors gracefully', async () => {
        mockGetUserPreferences.mockRejectedValue(new Error('Network error'));

        const response = await GET(createMockGetRequest());
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: expect.any(String),
        });
      });
    });
  });

  describe('PUT /api/user-preferences', () => {
    describe('Authentication', () => {
      it('should return 503 when database connection fails', async () => {
        mockAuthenticateRequest.mockRejectedValue(new Error('Database connection failed'));
        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(503);
        expect(json).toEqual({
          error: 'Service temporarily unavailable',
          code: 'SERVICE_UNAVAILABLE',
          timestamp: expect.any(String),
        });
      });

      it('should update preferences for unauthenticated users (guest mode)', async () => {
        mockAuthenticateRequest.mockResolvedValue({
          isGuest: true,
          userId: 'guest-user-123',
          supabase: mockSupabaseClient,
          user: { id: 'guest-user-123', anonymous: true },
        });

        mockUpdateUserPreferences.mockResolvedValue({
          preferences: {
            ...defaultPreferences,
            layout: 'sidebar',
          },
        });

        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.layout).toBe('sidebar');
      });

      it('should return 401 when auth error occurs', async () => {
        mockAuthenticateRequest.mockRejectedValue(new Error('Unauthorized'));
        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json).toEqual({
          error: 'Authentication required',
          code: 'UNAUTHORIZED',
          timestamp: expect.any(String),
        });
      });
    });

    describe('Request Validation', () => {
      it('should return 400 when layout is not a string', async () => {
        const request = createMockRequest({ layout: 123 });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          timestamp: expect.any(String),
          details: expect.any(Array),
        });
      });

      it('should return 400 when hidden_models is not an array', async () => {
        const request = createMockRequest({ hidden_models: 'not-array' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          timestamp: expect.any(String),
          details: expect.any(Array),
        });
      });

      it('should allow boolean values for boolean fields', async () => {
        mockQuery.single.mockResolvedValue({
          data: {
            ...mockUserPreferences,
            prompt_suggestions: false,
            show_tool_invocations: false,
          },
          error: null,
        });

        const request = createMockRequest({
          prompt_suggestions: false,
          show_tool_invocations: false,
          show_conversation_previews: true,
          multi_model_enabled: true,
        });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
      });

      it('should handle empty request body gracefully', async () => {
        mockQuery.single.mockResolvedValue({
          data: mockUserPreferences,
          error: null,
        });

        const request = createMockRequest({});

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
      });
    });

    describe('Successful Updates', () => {
      beforeEach(() => {
        mockQuery.single.mockResolvedValue({
          data: mockUserPreferences,
          error: null,
        });
      });

      it('should update layout preference', async () => {
        mockUpdateUserPreferences.mockResolvedValue({
          preferences: {
            ...mockUserPreferences,
            layout: 'sidebar',
          },
        });

        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.data.layout).toBe('sidebar');

        expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ userId: 'user-123' }),
          { layout: 'sidebar' }
        );
      });

      it('should update boolean preferences', async () => {
        const updatedPrefs = {
          prompt_suggestions: false,
          show_tool_invocations: false,
          multi_model_enabled: true,
        };

        mockUpdateUserPreferences.mockResolvedValue({
          preferences: {
            ...mockUserPreferences,
            ...updatedPrefs,
          },
        });

        const request = createMockRequest(updatedPrefs);

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);

        expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ userId: 'user-123' }),
          updatedPrefs
        );
      });

      it('should update hidden_models array', async () => {
        const newHiddenModels = ['gpt-4', 'claude-3'];

        mockUpdateUserPreferences.mockResolvedValue({
          preferences: {
            ...mockUserPreferences,
            hidden_models: newHiddenModels,
          },
        });

        const request = createMockRequest({
          hidden_models: newHiddenModels,
        });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);

        expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ userId: 'user-123' }),
          { hidden_models: newHiddenModels }
        );
      });

      it('should update multiple preferences at once', async () => {
        const updateData = {
          layout: 'sidebar',
          prompt_suggestions: false,
          hidden_models: ['model-1'],
          multi_model_enabled: true,
        };

        mockUpdateUserPreferences.mockResolvedValue({
          preferences: {
            ...mockUserPreferences,
            ...updateData,
          },
        });

        const request = createMockRequest(updateData);

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);

        expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ userId: 'user-123' }),
          updateData
        );
      });

      it('should only update provided fields', async () => {
        mockUpdateUserPreferences.mockResolvedValue({
          preferences: {
            ...mockUserPreferences,
            layout: 'sidebar',
          },
        });

        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);

        expect(response.status).toBe(200);
        expect(mockUpdateUserPreferences).toHaveBeenCalledWith(
          expect.any(Object),
          expect.objectContaining({ userId: 'user-123' }),
          { layout: 'sidebar' }
        );
      });

      it('should handle empty hidden_models array', async () => {
        const request = createMockRequest({ hidden_models: [] });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
      });
    });

    describe('Database Errors', () => {
      it('should return 500 when upsert fails', async () => {
        mockUpdateUserPreferences.mockRejectedValue(new Error('Failed to update user preferences'));

        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: expect.any(String),
        });
      });

      it('should handle foreign key constraint errors', async () => {
        mockUpdateUserPreferences.mockRejectedValue(new Error('Failed to update user preferences'));

        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: expect.any(String),
        });
      });

      it('should handle database timeout errors', async () => {
        mockUpdateUserPreferences.mockRejectedValue(new Error('Failed to update user preferences'));

        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: expect.any(String),
        });
      });
    });

    describe('Exception Handling', () => {
      it('should return 400 when JSON parsing fails', async () => {
        const request = new NextRequest(
          'http://localhost:3000/api/user-preferences',
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: 'invalid-json',
          }
        );

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Invalid JSON in request body',
          code: 'INVALID_REQUEST',
          timestamp: expect.any(String),
        });
      });

      it('should handle unexpected errors gracefully', async () => {
        mockUpdateUserPreferences.mockRejectedValue(
          new Error('Unexpected error')
        );

        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: expect.any(String),
        });
      });

      it('should handle network errors during update', async () => {
        mockUpdateUserPreferences.mockRejectedValue(new Error('Network timeout'));

        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
          code: 'INTERNAL_ERROR',
          timestamp: expect.any(String),
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle null values in update data', async () => {
        const request = createMockRequest({
          layout: null,
          hidden_models: [],
        });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'Invalid request data',
          code: 'VALIDATION_ERROR',
          timestamp: expect.any(String),
          details: expect.any(Array),
        });
      });

      it('should handle very large hidden_models arrays', async () => {
        const largeArray = Array.from({ length: 1000 }, (_, i) => `model-${i}`);
        mockQuery.single.mockResolvedValue({
          data: {
            ...mockUserPreferences,
            hidden_models: largeArray,
          },
          error: null,
        });

        const request = createMockRequest({ hidden_models: largeArray });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
      });

      it('should handle special characters in layout string', async () => {
        const specialLayout = 'custom-layout-with-unicode-测试';
        mockQuery.single.mockResolvedValue({
          data: {
            ...mockUserPreferences,
            layout: specialLayout,
          },
          error: null,
        });

        const request = createMockRequest({ layout: specialLayout });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
      });

      it('should handle very long model names in hidden_models', async () => {
        const longModelNames = [
          'very-long-model-name-with-many-hyphens-and-descriptive-text-that-exceeds-normal-limits',
          'another-extremely-long-model-identifier-with-version-numbers-and-special-configurations-v2.1.3-beta',
        ];
        mockQuery.single.mockResolvedValue({
          data: {
            ...mockUserPreferences,
            hidden_models: longModelNames,
          },
          error: null,
        });

        const request = createMockRequest({ hidden_models: longModelNames });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
      });
    });

    describe('Concurrent Operations', () => {
      it('should handle concurrent preference updates', async () => {
        mockUpdateUserPreferences.mockResolvedValue({
          preferences: mockUserPreferences,
        });

        const requests = [
          createMockRequest({ layout: 'sidebar' }),
          createMockRequest({ prompt_suggestions: false }),
          createMockRequest({ multi_model_enabled: true }),
        ];

        const responses = await Promise.all(
          requests.map((request) => PUT(request))
        );

        responses.forEach((response) => {
          expect(response.status).toBe(200);
        });

        expect(mockUpdateUserPreferences).toHaveBeenCalledTimes(3);
      });

      it('should maintain data consistency during rapid updates', async () => {
        let callCount = 0;
        mockUpdateUserPreferences.mockImplementation(() => {
          callCount++;
          return Promise.resolve({
            preferences: {
              ...mockUserPreferences,
              layout: `update-${callCount}`,
            },
          });
        });

        const rapidRequests = Array.from({ length: 10 }, (_, i) =>
          createMockRequest({ layout: `layout-${i}` })
        );

        const responses = await Promise.all(
          rapidRequests.map((request) => PUT(request))
        );

        responses.forEach((response) => {
          expect(response.status).toBe(200);
        });

        expect(mockUpdateUserPreferences).toHaveBeenCalledTimes(10);
      });
    });

    describe('Performance', () => {
      it('should handle large preference objects efficiently', async () => {
        const largeHiddenModels = Array.from({ length: 500 }, (_, i) => `model-${i}`);

        mockUpdateUserPreferences.mockResolvedValue({
          preferences: {
            ...mockUserPreferences,
            hidden_models: largeHiddenModels,
          },
        });

        const request = createMockRequest({ hidden_models: largeHiddenModels });

        const startTime = Date.now();
        const response = await PUT(request);
        const endTime = Date.now();

        expect(response.status).toBe(200);
        expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      });

      it('should handle memory efficiently with large datasets', async () => {
        const initialMemory = process.memoryUsage().heapUsed;

        const requests = Array.from({ length: 100 }, (_, i) =>
          createMockRequest({
            hidden_models: Array.from(
              { length: 50 },
              (_, j) => `model-${i}-${j}`
            ),
          })
        );

        mockQuery.single.mockResolvedValue({
          data: mockUserPreferences,
          error: null,
        });

        await Promise.all(requests.map((request) => PUT(request)));

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        const finalMemory = process.memoryUsage().heapUsed;
        const memoryIncrease = finalMemory - initialMemory;

        // Memory increase should be reasonable (less than 50MB)
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
      });
    });
  });

  describe('Integration Scenarios', () => {
    it('should maintain preferences across GET and PUT operations', async () => {
      // First, update preferences with PUT
      const updateData = {
        layout: 'sidebar',
        prompt_suggestions: false,
        hidden_models: ['gpt-4'],
      };

      mockUpdateUserPreferences.mockResolvedValue({
        preferences: {
          ...mockUserPreferences,
          ...updateData,
        },
      });

      const updateRequest = createMockRequest(updateData);
      const putResponse = await PUT(updateRequest);
      expect(putResponse.status).toBe(200);

      // Then, retrieve preferences with GET
      mockGetUserPreferences.mockResolvedValue({
        preferences: {
          ...mockUserPreferences,
          ...updateData,
        },
      });

      const getResponse = await GET(createMockGetRequest());
      const getJson = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getJson.success).toBe(true);
      expect(getJson.data.layout).toBe('sidebar');
      expect(getJson.data.prompt_suggestions).toBe(false);
      expect(getJson.data.hidden_models).toContain('gpt-4');
    });

    it('should handle user switching and different user preferences', async () => {
      // First user preferences
      mockAuthenticateRequest.mockResolvedValueOnce({
        isGuest: false,
        userId: 'user-1',
        supabase: mockSupabaseClient,
        user: { id: 'user-1' },
      });

      mockGetUserPreferences.mockResolvedValueOnce({
        preferences: {
          ...mockUserPreferences,
          layout: 'fullscreen',
        },
      });

      const response1 = await GET(createMockGetRequest());
      const json1 = await response1.json();

      expect(json1.success).toBe(true);
      expect(json1.data.layout).toBe('fullscreen');

      // Second user preferences
      mockAuthenticateRequest.mockResolvedValueOnce({
        isGuest: false,
        userId: 'user-2',
        supabase: mockSupabaseClient,
        user: { id: 'user-2' },
      });

      mockGetUserPreferences.mockResolvedValueOnce({
        preferences: {
          ...mockUserPreferences,
          layout: 'sidebar',
        },
      });

      const response2 = await GET(createMockGetRequest());
      const json2 = await response2.json();

      expect(json2.success).toBe(true);
      expect(json2.data.layout).toBe('sidebar');
    });
  });
});
