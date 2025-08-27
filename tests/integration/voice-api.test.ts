import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/voice/transcripts/route';

// Mock decryptApiKey
vi.mock('@/lib/security/encryption', () => ({
  decryptApiKey: vi.fn(() => 'test-openai-key'),
}));

// Mock Supabase client
const mockSupabaseQuery = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  single: vi.fn(),
  insert: vi.fn().mockReturnThis(),
  ilike: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
};

const mockSupabase = {
  from: vi.fn(() => mockSupabaseQuery),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabase,
}));

// Mock OpenAI SDK
const mockOpenAI = {
  beta: {
    vectorStores: {
      list: vi.fn(),
      create: vi.fn(),
      files: {
        create: vi.fn(),
        list: vi.fn(),
      },
    },
  },
  files: {
    create: vi.fn(),
  },
};

vi.mock('openai', () => ({
  default: class OpenAI {
    beta = mockOpenAI.beta;
    files = mockOpenAI.files;
  },
}));

// Mock Next.js request objects
function createMockRequest(
  method: string,
  body?: any,
  searchParams?: URLSearchParams
) {
  const mockRequest = {
    method,
    json: () => Promise.resolve(body),
    url: searchParams
      ? `http://localhost:3000/api/voice/transcripts?${searchParams.toString()}`
      : 'http://localhost:3000/api/voice/transcripts',
    nextUrl: {
      searchParams: searchParams || new URLSearchParams(),
    },
  };
  return mockRequest as any;
}

describe('Voice Transcripts API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset Supabase mocks
    mockSupabaseQuery.select.mockReturnThis();
    mockSupabaseQuery.eq.mockReturnThis();
    mockSupabaseQuery.single.mockClear();
    mockSupabaseQuery.insert.mockReturnThis();
    mockSupabaseQuery.ilike.mockReturnThis();
    mockSupabaseQuery.order.mockReturnThis();
    mockSupabaseQuery.limit.mockClear();
    mockSupabase.from.mockReturnValue(mockSupabaseQuery);
  });

  describe('POST /api/voice/transcripts', () => {
    it('should create new vector store and index transcript successfully', async () => {
      // Mock Supabase query for API key retrieval
      mockSupabaseQuery.single.mockResolvedValueOnce({
        data: {
          encrypted_key: 'test-encrypted-key',
          iv: 'test-iv',
        },
        error: null,
      });

      // Mock file creation
      mockOpenAI.files.create.mockResolvedValueOnce({
        id: 'file-abc123',
        object: 'file',
        bytes: 1024,
        created_at: Date.now(),
        filename: 'transcript_test-session_20241224.txt',
        purpose: 'assistants',
      });

      // Mock successful database insert for voice_transcripts
      mockSupabaseQuery.insert.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const requestBody = {
        transcript: 'This is a test transcript for voice indexing',
        userId: 'test-user',
        sessionId: 'test-session',
        metadata: {
          sessionId: 'test-session',
          personalityMode: 'safety-focused',
          timestamp: '2024-12-24T12:00:00Z',
          language: 'en-US',
          voice: 'nova',
        },
      };

      const request = createMockRequest('POST', requestBody);
      const response = await POST(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: true,
        fileId: 'file-abc123',
        message: 'Transcript stored successfully',
      });

      // Verify Supabase calls
      expect(mockSupabase.from).toHaveBeenCalledWith('user_keys');
      expect(mockSupabaseQuery.select).toHaveBeenCalledWith(
        'encrypted_key, iv'
      );
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('user_id', 'test-user');
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith('provider', 'openai');
      expect(mockSupabaseQuery.single).toHaveBeenCalled();

      // Verify database insert call
      expect(mockSupabase.from).toHaveBeenCalledWith('voice_transcripts');
      expect(mockSupabaseQuery.insert).toHaveBeenCalledWith({
        user_id: 'test-user',
        session_id: 'test-session',
        transcript: 'This is a test transcript for voice indexing',
        file_id: 'file-abc123',
        metadata: {
          sessionId: 'test-session',
          personalityMode: 'safety-focused',
          timestamp: '2024-12-24T12:00:00Z',
          language: 'en-US',
          voice: 'nova',
        },
        created_at: expect.any(String),
      });

      // Verify OpenAI file creation
      expect(mockOpenAI.files.create).toHaveBeenCalledWith({
        file: expect.any(File),
        purpose: 'assistants',
      });
    });

    it('should use existing vector store if found', async () => {
      // Mock Supabase query for API key retrieval
      mockSupabaseQuery.single.mockResolvedValueOnce({
        data: {
          encrypted_key: 'test-encrypted-key',
          iv: 'test-iv',
        },
        error: null,
      });

      // Mock file creation
      mockOpenAI.files.create.mockResolvedValueOnce({
        id: 'file-existing456',
        object: 'file',
        bytes: 512,
        created_at: Date.now(),
        filename: 'transcript_existing-session_20241224.txt',
        purpose: 'assistants',
      });

      // Mock successful database insert for voice_transcripts
      mockSupabaseQuery.insert.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const requestBody = {
        transcript: 'Another test transcript',
        userId: 'test-user',
        sessionId: 'existing-session',
        metadata: {
          sessionId: 'existing-session',
          personalityMode: 'technical-expert',
          timestamp: '2024-12-24T13:00:00Z',
        },
      };

      const request = createMockRequest('POST', requestBody);
      const response = await POST(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData).toEqual({
        success: true,
        fileId: 'file-existing456',
        message: 'Transcript stored successfully',
      });

      // Verify Supabase calls
      expect(mockSupabase.from).toHaveBeenCalledWith('user_keys');
      expect(mockSupabase.from).toHaveBeenCalledWith('voice_transcripts');
      expect(mockSupabaseQuery.insert).toHaveBeenCalledWith({
        user_id: 'test-user',
        session_id: 'existing-session',
        transcript: 'Another test transcript',
        file_id: 'file-existing456',
        metadata: {
          sessionId: 'existing-session',
          personalityMode: 'technical-expert',
          timestamp: '2024-12-24T13:00:00Z',
        },
        created_at: expect.any(String),
      });

      // Verify OpenAI file creation
      expect(mockOpenAI.files.create).toHaveBeenCalledWith({
        file: expect.any(File),
        purpose: 'assistants',
      });
    });

    it('should handle missing required fields', async () => {
      const requestBody = {
        transcript: 'Test transcript',
        // Missing userId
      };

      const request = createMockRequest('POST', requestBody);
      const response = await POST(request);

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData.error).toBe('Transcript and userId are required');
    });

    it('should handle missing OpenAI API key', async () => {
      // Mock Supabase returning no API key
      mockSupabaseQuery.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'No rows found' },
      });

      const requestBody = {
        transcript: 'Test transcript',
        userId: 'test-user',
        sessionId: 'test-session',
      };

      const request = createMockRequest('POST', requestBody);
      const response = await POST(request);

      expect(response.status).toBe(401);

      const responseData = await response.json();
      expect(responseData.error).toBe('OpenAI API key not found');
    });

    it('should handle OpenAI API errors', async () => {
      // Mock Supabase query for API key retrieval
      mockSupabaseQuery.single.mockResolvedValueOnce({
        data: {
          encrypted_key: 'test-encrypted-key',
          iv: 'test-iv',
        },
        error: null,
      });

      // Mock file creation to fail with invalid response
      mockOpenAI.files.create.mockResolvedValueOnce({
        // Missing id field to trigger our error handling
        object: 'file',
        bytes: 1024,
        created_at: Date.now(),
        filename: 'transcript.txt',
        purpose: 'assistants',
      });

      const requestBody = {
        transcript: 'Test transcript',
        userId: 'test-user',
        sessionId: 'test-session',
      };

      const request = createMockRequest('POST', requestBody);
      const response = await POST(request);

      expect(response.status).toBe(500);

      const responseData = await response.json();
      expect(responseData.error).toBe('Failed to upload transcript file');
      expect(responseData.details).toContain(
        'invalid response or missing file ID'
      );
    });
  });

  describe('GET /api/voice/transcripts', () => {
    it('should search transcripts successfully', async () => {
      // Mock successful database search for voice_transcripts
      mockSupabaseQuery.select.mockReturnThis();
      mockSupabaseQuery.eq.mockReturnThis();
      mockSupabaseQuery.ilike.mockReturnThis();
      mockSupabaseQuery.order.mockReturnThis();
      mockSupabaseQuery.limit.mockResolvedValueOnce({
        data: [
          {
            id: 'transcript-1',
            user_id: 'search-user',
            session_id: 'session-1',
            transcript: 'This is a technical discussion about APIs',
            file_id: 'file-1',
            metadata: {
              sessionId: 'session-1',
              personalityMode: 'technical-expert',
            },
            created_at: '2024-12-24T10:00:00Z',
          },
          {
            id: 'transcript-2',
            user_id: 'search-user',
            session_id: 'session-2',
            transcript: 'Another technical discussion about databases',
            file_id: 'file-2',
            metadata: {
              sessionId: 'session-2',
              personalityMode: 'technical-expert',
            },
            created_at: '2024-12-24T11:00:00Z',
          },
        ],
        error: null,
      });

      const searchParams = new URLSearchParams({
        userId: 'search-user',
        query: 'technical discussion',
      });

      const request = createMockRequest('GET', null, searchParams);
      const response = await GET(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData).toEqual({
        results: [
          {
            id: 'transcript-1',
            user_id: 'search-user',
            session_id: 'session-1',
            transcript: 'This is a technical discussion about APIs',
            file_id: 'file-1',
            metadata: {
              sessionId: 'session-1',
              personalityMode: 'technical-expert',
            },
            created_at: '2024-12-24T10:00:00Z',
          },
          {
            id: 'transcript-2',
            user_id: 'search-user',
            session_id: 'session-2',
            transcript: 'Another technical discussion about databases',
            file_id: 'file-2',
            metadata: {
              sessionId: 'session-2',
              personalityMode: 'technical-expert',
            },
            created_at: '2024-12-24T11:00:00Z',
          },
        ],
        message: 'Found 2 matching transcripts',
        total: 2,
      });

      // Verify Supabase calls
      expect(mockSupabase.from).toHaveBeenCalledWith('voice_transcripts');
      expect(mockSupabaseQuery.select).toHaveBeenCalledWith('*');
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith(
        'user_id',
        'search-user'
      );
      expect(mockSupabaseQuery.ilike).toHaveBeenCalledWith(
        'transcript',
        '%technical discussion%'
      );
      expect(mockSupabaseQuery.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockSupabaseQuery.limit).toHaveBeenCalledWith(10);
    });

    it('should handle missing query parameter', async () => {
      const searchParams = new URLSearchParams({
        userId: 'search-user',
        // Missing query parameter
      });

      const request = createMockRequest('GET', null, searchParams);
      const response = await GET(request);

      expect(response.status).toBe(400);

      const responseData = await response.json();
      expect(responseData.error).toBe('userId and query are required');
    });

    it('should handle no vector store found', async () => {
      // Mock database search returning no results
      mockSupabaseQuery.select.mockReturnThis();
      mockSupabaseQuery.eq.mockReturnThis();
      mockSupabaseQuery.ilike.mockReturnThis();
      mockSupabaseQuery.order.mockReturnThis();
      mockSupabaseQuery.limit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const searchParams = new URLSearchParams({
        userId: 'no-store-user',
        query: 'test query',
      });

      const request = createMockRequest('GET', null, searchParams);
      const response = await GET(request);

      expect(response.status).toBe(200);

      const responseData = await response.json();
      expect(responseData).toEqual({
        results: [],
        message: 'Found 0 matching transcripts',
        total: 0,
      });

      // Verify Supabase calls
      expect(mockSupabase.from).toHaveBeenCalledWith('voice_transcripts');
      expect(mockSupabaseQuery.select).toHaveBeenCalledWith('*');
      expect(mockSupabaseQuery.eq).toHaveBeenCalledWith(
        'user_id',
        'no-store-user'
      );
      expect(mockSupabaseQuery.ilike).toHaveBeenCalledWith(
        'transcript',
        '%test query%'
      );
      expect(mockSupabaseQuery.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockSupabaseQuery.limit).toHaveBeenCalledWith(10);
    });
  });
});
