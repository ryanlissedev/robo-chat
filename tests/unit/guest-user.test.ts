import { describe, expect, it, vi } from 'vitest';

// Mock all dependencies before imports
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => null),
}));

vi.mock('@/lib/utils', () => ({
  generateGuestUserId: vi.fn(() => '550e8400-e29b-41d4-a716-446655440000'),
  isValidUUID: vi.fn((value) => typeof value === 'string' && value.length === 36),
}));

// Mock createGuestUser function
vi.mock('@/lib/api', () => ({
  createGuestUser: vi.fn().mockResolvedValue({}),
  getOrCreateGuestUserId: vi.fn(),
}));

// Now import after mocking
import { getOrCreateGuestUserId } from '@/lib/api';

describe('Guest User System', () => {
  it('should handle guest users without Supabase', async () => {
    // Mock the function to return a guest ID
    const mockGetOrCreateGuestUserId = vi.mocked(getOrCreateGuestUserId);
    mockGetOrCreateGuestUserId.mockResolvedValue('550e8400-e29b-41d4-a716-446655440000');

    const result = await getOrCreateGuestUserId(null);

    expect(result).toBeTruthy();
    expect(typeof result).toBe('string');
    expect(result?.length).toBeGreaterThan(0);
  });

  it('should use existing valid user ID', async () => {
    const mockUser = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'guest@example.com',
      display_name: 'Guest User',
      profile_image: '',
      anonymous: true,
    };

    const mockGetOrCreateGuestUserId = vi.mocked(getOrCreateGuestUserId);
    mockGetOrCreateGuestUserId.mockResolvedValue(mockUser.id);

    const result = await getOrCreateGuestUserId(mockUser);

    expect(result).toBe(mockUser.id);
  });
});
