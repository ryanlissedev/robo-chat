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

vi.mock('@/lib/supabase/server', () => ({
  createClient: mockCreateClient,
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
  const createMockRequest = (body: any) => {
    return new NextRequest('http://localhost:3000/api/user-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  };

  beforeEach(async () => {
    vi.clearAllMocks();

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
  });

  afterEach(() => {
    resetEnvironment();
    vi.restoreAllMocks();
  });

  describe('GET /api/user-preferences', () => {
    describe('Authentication', () => {
      it('should return 500 when database connection fails', async () => {
        mockCreateClient.mockResolvedValue(null);

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Database connection failed',
        });
      });

      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json).toEqual({ error: 'Unauthorized' });
      });

      it('should return 401 when auth error occurs', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token', status: 401 },
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json).toEqual({ error: 'Unauthorized' });
      });
    });

    describe('Successful Preference Retrieval', () => {
      it('should return user preferences when they exist', async () => {
        mockQuery.single.mockResolvedValue({
          data: mockUserPreferences,
          error: null,
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual({
          layout: 'fullscreen',
          prompt_suggestions: true,
          show_tool_invocations: true,
          show_conversation_previews: true,
          multi_model_enabled: false,
          hidden_models: ['model-1', 'model-2'],
        });

        expect(mockSupabaseClient.from).toHaveBeenCalledWith(
          'user_preferences'
        );
        expect(mockQuery.select).toHaveBeenCalledWith('*');
        expect(mockQuery.eq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(mockQuery.single).toHaveBeenCalled();
      });

      it('should return default preferences when none exist for user', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows returned' },
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json).toEqual(defaultPreferences);
      });

      it('should handle null hidden_models correctly', async () => {
        mockQuery.single.mockResolvedValue({
          data: {
            ...mockUserPreferences,
            hidden_models: null,
          },
          error: null,
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.hidden_models).toEqual([]);
      });

      it('should handle undefined hidden_models correctly', async () => {
        mockQuery.single.mockResolvedValue({
          data: {
            ...mockUserPreferences,
            hidden_models: undefined,
          },
          error: null,
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.hidden_models).toEqual([]);
      });
    });

    describe('Database Errors', () => {
      it('should return 500 when database query fails', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST500', message: 'Database error' },
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Failed to fetch user preferences',
        });
      });

      it('should handle timeout errors gracefully', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST301', message: 'Timeout' },
        });

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Failed to fetch user preferences',
        });
      });
    });

    describe('Exception Handling', () => {
      it('should return 500 when unexpected error occurs', async () => {
        mockSupabaseClient.auth.getUser.mockRejectedValue(
          new Error('Unexpected error')
        );

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
        });
      });

      it('should handle network errors gracefully', async () => {
        mockCreateClient.mockRejectedValue(new Error('Network error'));

        const response = await GET();
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
        });
      });
    });
  });

  describe('PUT /api/user-preferences', () => {
    describe('Authentication', () => {
      it('should return 500 when database connection fails', async () => {
        mockCreateClient.mockResolvedValue(null);
        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Database connection failed',
        });
      });

      it('should return 401 when user is not authenticated', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });
        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json).toEqual({ error: 'Unauthorized' });
      });

      it('should return 401 when auth error occurs', async () => {
        mockSupabaseClient.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Invalid token', status: 401 },
        });
        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(401);
        expect(json).toEqual({ error: 'Unauthorized' });
      });
    });

    describe('Request Validation', () => {
      it('should return 400 when layout is not a string', async () => {
        const request = createMockRequest({ layout: 123 });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'layout must be a string',
        });
      });

      it('should return 400 when hidden_models is not an array', async () => {
        const request = createMockRequest({ hidden_models: 'not-array' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(400);
        expect(json).toEqual({
          error: 'hidden_models must be an array',
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
        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
        expect(json.layout).toBe('fullscreen'); // From mocked return

        expect(mockQuery.upsert).toHaveBeenCalledWith(
          {
            user_id: 'user-123',
            layout: 'sidebar',
          },
          { onConflict: 'user_id' }
        );
      });

      it('should update boolean preferences', async () => {
        const request = createMockRequest({
          prompt_suggestions: false,
          show_tool_invocations: false,
          multi_model_enabled: true,
        });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);

        expect(mockQuery.upsert).toHaveBeenCalledWith(
          {
            user_id: 'user-123',
            prompt_suggestions: false,
            show_tool_invocations: false,
            multi_model_enabled: true,
          },
          { onConflict: 'user_id' }
        );
      });

      it('should update hidden_models array', async () => {
        const newHiddenModels = ['gpt-4', 'claude-3'];
        const request = createMockRequest({
          hidden_models: newHiddenModels,
        });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);

        expect(mockQuery.upsert).toHaveBeenCalledWith(
          {
            user_id: 'user-123',
            hidden_models: newHiddenModels,
          },
          { onConflict: 'user_id' }
        );
      });

      it('should update multiple preferences at once', async () => {
        const updateData = {
          layout: 'sidebar',
          prompt_suggestions: false,
          hidden_models: ['model-1'],
          multi_model_enabled: true,
        };
        const request = createMockRequest(updateData);

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);

        expect(mockQuery.upsert).toHaveBeenCalledWith(
          {
            user_id: 'user-123',
            ...updateData,
          },
          { onConflict: 'user_id' }
        );
      });

      it('should only update provided fields', async () => {
        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);

        expect(response.status).toBe(200);
        expect(mockQuery.upsert).toHaveBeenCalledWith(
          {
            user_id: 'user-123',
            layout: 'sidebar',
          },
          { onConflict: 'user_id' }
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
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { message: 'Database constraint violation' },
        });

        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Failed to update user preferences',
        });
      });

      it('should handle foreign key constraint errors', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: '23503', message: 'Foreign key violation' },
        });

        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Failed to update user preferences',
        });
      });

      it('should handle database timeout errors', async () => {
        mockQuery.single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST301', message: 'Request timeout' },
        });

        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Failed to update user preferences',
        });
      });
    });

    describe('Exception Handling', () => {
      it('should return 500 when JSON parsing fails', async () => {
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

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
        });
      });

      it('should handle unexpected errors gracefully', async () => {
        mockSupabaseClient.auth.getUser.mockRejectedValue(
          new Error('Unexpected error')
        );

        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
        });
      });

      it('should handle network errors during update', async () => {
        mockQuery.single.mockRejectedValue(new Error('Network timeout'));

        const request = createMockRequest({ layout: 'sidebar' });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(500);
        expect(json).toEqual({
          error: 'Internal server error',
        });
      });
    });

    describe('Edge Cases', () => {
      it('should handle null values in update data', async () => {
        mockQuery.single.mockResolvedValue({
          data: mockUserPreferences,
          error: null,
        });

        const request = createMockRequest({
          layout: null,
          hidden_models: [],
        });

        const response = await PUT(request);
        const json = await response.json();

        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
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
        mockQuery.single.mockResolvedValue({
          data: mockUserPreferences,
          error: null,
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

        expect(mockQuery.upsert).toHaveBeenCalledTimes(3);
      });

      it('should maintain data consistency during rapid updates', async () => {
        let callCount = 0;
        mockQuery.single.mockImplementation(() => {
          callCount++;
          return Promise.resolve({
            data: {
              ...mockUserPreferences,
              layout: `update-${callCount}`,
            },
            error: null,
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

        expect(mockQuery.upsert).toHaveBeenCalledTimes(10);
      });
    });

    describe('Performance', () => {
      it('should handle large preference objects efficiently', async () => {
        const largeHiddenModels = Array.from({ length: 500 }, (_, i) => ({
          id: `model-${i}`,
          name: `Model ${i}`,
          provider: `Provider ${i % 10}`,
        }));

        mockQuery.single.mockResolvedValue({
          data: {
            ...mockUserPreferences,
            hidden_models: largeHiddenModels,
          },
          error: null,
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
      // First, create preferences with PUT
      const updateRequest = createMockRequest({
        layout: 'sidebar',
        prompt_suggestions: false,
        hidden_models: ['gpt-4'],
      });

      mockQuery.single.mockResolvedValue({
        data: {
          ...mockUserPreferences,
          layout: 'sidebar',
          prompt_suggestions: false,
          hidden_models: ['gpt-4'],
        },
        error: null,
      });

      const putResponse = await PUT(updateRequest);
      expect(putResponse.status).toBe(200);

      // Then, retrieve preferences with GET
      const getResponse = await GET();
      const getJson = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getJson.layout).toBe('sidebar');
      expect(getJson.prompt_suggestions).toBe(false);
      expect(getJson.hidden_models).toContain('gpt-4');
    });

    it('should handle user switching and different user preferences', async () => {
      // Mock different users
      const user1 = { ...mockUser, id: 'user-1' };
      const user2 = { ...mockUser, id: 'user-2' };

      // First user preferences
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: user1 },
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({
        data: {
          ...mockUserPreferences,
          user_id: 'user-1',
          layout: 'fullscreen',
        },
        error: null,
      });

      const response1 = await GET();
      const json1 = await response1.json();

      expect(json1.layout).toBe('fullscreen');

      // Second user preferences
      mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
        data: { user: user2 },
        error: null,
      });

      mockQuery.single.mockResolvedValueOnce({
        data: { ...mockUserPreferences, user_id: 'user-2', layout: 'sidebar' },
        error: null,
      });

      const response2 = await GET();
      const json2 = await response2.json();

      expect(json2.layout).toBe('sidebar');
    });
  });
});
