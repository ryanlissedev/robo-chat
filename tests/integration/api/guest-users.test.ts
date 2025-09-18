import { describe, it, expect } from 'vitest';
import {
  isGuestUser,
  getGuestUserId,
  generateGuestUserId,
  isValidUUID,
  DEFAULT_GUEST_PREFERENCES
} from '@/lib/utils';

describe('Guest User Utility Functions', () => {
  describe('isGuestUser', () => {
    it('should detect guest user from x-guest-user header', () => {
      const request = new Request('http://localhost:3000/test', {
        headers: {
          'x-guest-user': 'true'
        }
      });

      expect(isGuestUser(request)).toBe(true);
    });

    it('should detect guest user from cookie', () => {
      const request = new Request('http://localhost:3000/test', {
        headers: {
          'cookie': 'guest-user-id=12345678-1234-4000-8000-123456789012'
        }
      });

      expect(isGuestUser(request)).toBe(true);
    });

    it('should return false for non-guest requests', () => {
      const request = new Request('http://localhost:3000/test');
      expect(isGuestUser(request)).toBe(false);
    });
  });

  describe('getGuestUserId', () => {
    it('should extract guest ID from header', () => {
      const guestId = '12345678-1234-4000-8000-123456789012';
      const request = new Request('http://localhost:3000/test', {
        headers: {
          'x-guest-user-id': guestId
        }
      });

      expect(getGuestUserId(request)).toBe(guestId);
    });

    it('should extract guest ID from cookie', () => {
      const guestId = '12345678-1234-4000-8000-123456789012';
      const request = new Request('http://localhost:3000/test', {
        headers: {
          'cookie': `guest-user-id=${guestId}; other=value`
        }
      });

      expect(getGuestUserId(request)).toBe(guestId);
    });

    it('should return null if no valid guest ID found', () => {
      const request = new Request('http://localhost:3000/test');
      expect(getGuestUserId(request)).toBeNull();
    });

    it('should return null for invalid UUID', () => {
      const request = new Request('http://localhost:3000/test', {
        headers: {
          'x-guest-user-id': 'invalid-uuid'
        }
      });

      expect(getGuestUserId(request)).toBeNull();
    });
  });

  describe('generateGuestUserId', () => {
    it('should generate a valid UUID', () => {
      const guestId = generateGuestUserId();
      expect(isValidUUID(guestId)).toBe(true);
    });

    it('should generate unique IDs', () => {
      const id1 = generateGuestUserId();
      const id2 = generateGuestUserId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('isValidUUID', () => {
    it('should validate correct UUIDs', () => {
      const validUUIDs = [
        '12345678-1234-4000-8000-123456789012',
        'abcdef12-3456-7890-abcd-ef1234567890',
        '00000000-0000-0000-0000-000000000000'
      ];

      validUUIDs.forEach(uuid => {
        expect(isValidUUID(uuid)).toBe(true);
      });
    });

    it('should reject invalid UUIDs', () => {
      const invalidUUIDs = [
        'not-a-uuid',
        '12345678-1234-4000-8000-12345678901',  // too short
        '12345678-1234-4000-8000-1234567890123', // too long
        '12345678_1234_4000_8000_123456789012',  // wrong separators
        '',
        null,
        undefined
      ];

      invalidUUIDs.forEach(uuid => {
        expect(isValidUUID(uuid)).toBe(false);
      });
    });
  });

  describe('DEFAULT_GUEST_PREFERENCES', () => {
    it('should have all required properties', () => {
      expect(DEFAULT_GUEST_PREFERENCES).toMatchObject({
        layout: 'fullscreen',
        prompt_suggestions: true,
        show_tool_invocations: true,
        show_conversation_previews: true,
        multi_model_enabled: false,
        hidden_models: [],
        favorite_models: ['gpt-5-mini'],
      });
    });

    it('should have correct types', () => {
      expect(typeof DEFAULT_GUEST_PREFERENCES.layout).toBe('string');
      expect(typeof DEFAULT_GUEST_PREFERENCES.prompt_suggestions).toBe('boolean');
      expect(typeof DEFAULT_GUEST_PREFERENCES.show_tool_invocations).toBe('boolean');
      expect(typeof DEFAULT_GUEST_PREFERENCES.show_conversation_previews).toBe('boolean');
      expect(typeof DEFAULT_GUEST_PREFERENCES.multi_model_enabled).toBe('boolean');
      expect(Array.isArray(DEFAULT_GUEST_PREFERENCES.hidden_models)).toBe(true);
      expect(Array.isArray(DEFAULT_GUEST_PREFERENCES.favorite_models)).toBe(true);
    });
  });
});