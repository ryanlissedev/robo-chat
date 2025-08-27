import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useMobile } from '@/app/hooks/use-mobile';

// Mock window.matchMedia
const mockMatchMedia = vi.fn();
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: mockMatchMedia,
});

describe('useMobile', () => {
  let mockMQL: {
    matches: boolean;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    addListener?: ReturnType<typeof vi.fn>;
    removeListener?: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockMQL = {
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };
    mockMatchMedia.mockReturnValue(mockMQL);
    vi.clearAllMocks();
  });

  it('should return false for desktop breakpoint (768px+)', () => {
    mockMQL.matches = false; // Not mobile

    const { result } = renderHook(() => useMobile());

    expect(result.current).toBe(false);
    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 767.98px)');
  });

  it('should return true for mobile breakpoint (<768px)', () => {
    mockMQL.matches = true; // Mobile

    const { result } = renderHook(() => useMobile());

    expect(result.current).toBe(true);
  });

  it('should set up event listener on mount', () => {
    renderHook(() => useMobile());

    expect(mockMQL.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
  });

  it('should clean up event listener on unmount', () => {
    const { unmount } = renderHook(() => useMobile());

    unmount();

    expect(mockMQL.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
  });

  it('should update when media query changes', () => {
    mockMQL.matches = false;

    const { result, rerender } = renderHook(() => useMobile());

    expect(result.current).toBe(false);

    // Simulate media query change
    act(() => {
      mockMQL.matches = true;
      const changeHandler = mockMQL.addEventListener.mock.calls[0][1];
      changeHandler();
    });

    // Force re-render to get updated value
    rerender();

    // The hook should return the current matches value
    expect(result.current).toBe(true);
  });

  it('should handle legacy browsers with addListener fallback', () => {
    const legacyMQL = {
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };
    mockMatchMedia.mockReturnValue(legacyMQL);

    renderHook(() => useMobile());

    expect(legacyMQL.addListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should clean up legacy listeners on unmount', () => {
    const legacyMQL = {
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };
    mockMatchMedia.mockReturnValue(legacyMQL);

    const { unmount } = renderHook(() => useMobile());

    unmount();

    expect(legacyMQL.removeListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should handle missing legacy methods gracefully', () => {
    const incompleteMQL = {
      matches: false,
      // No addListener/removeListener methods
    };
    mockMatchMedia.mockReturnValue(incompleteMQL);

    expect(() => {
      const { unmount } = renderHook(() => useMobile());
      unmount();
    }).not.toThrow();
  });

  it('should use correct mobile breakpoint query', () => {
    renderHook(() => useMobile());

    // Verify it uses the standard mobile breakpoint
    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 767.98px)');
  });

  it('should handle multiple instances independently', () => {
    const { result: result1 } = renderHook(() => useMobile());
    const { result: result2 } = renderHook(() => useMobile());

    // Both should have the same value initially
    expect(result1.current).toBe(result2.current);

    // Each should set up its own event listener (modern browsers check addListener too)
    expect(mockMQL.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(mockMQL.addEventListener.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('should return boolean type consistently', () => {
    mockMQL.matches = false;

    const { result: falseResult } = renderHook(() => useMobile());
    expect(typeof falseResult.current).toBe('boolean');
    expect(falseResult.current).toBe(false);

    mockMQL.matches = true;
    const { result: trueResult } = renderHook(() => useMobile());
    expect(typeof trueResult.current).toBe('boolean');
    expect(trueResult.current).toBe(true);
  });

  it('should handle window resize scenarios', () => {
    mockMQL.matches = false;

    const { result } = renderHook(() => useMobile());

    expect(result.current).toBe(false);

    // Simulate resize to mobile
    act(() => {
      mockMQL.matches = true;
      const changeHandler = mockMQL.addEventListener.mock.calls[0][1];
      changeHandler();
    });

    // The hook should respond to the change event without throwing
    expect(result.current).toBe(true);
  });
});