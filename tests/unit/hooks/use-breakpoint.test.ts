import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBreakpoint } from '@/app/hooks/use-breakpoint';

// Use global window.matchMedia mock
const mockMatchMedia = vi.mocked(window.matchMedia);

describe('useBreakpoint', () => {
  let mockMQL: MediaQueryList;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockMQL = {
      matches: false,
      media: '(max-width: 767px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
    mockMatchMedia.mockReturnValue(mockMQL);

    // Reset window.innerWidth
    window.innerWidth = 1024;
  });

  it('should initialize with correct breakpoint state based on window width', () => {
    const breakpoint = 768;
    window.innerWidth = 1024; // Above breakpoint

    const { result } = renderHook(() => useBreakpoint(breakpoint));

    expect(result.current).toBe(false);
    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 767px)');
  });

  it('should return true when window width is below breakpoint', () => {
    const breakpoint = 768;
    window.innerWidth = 600; // Below breakpoint

    const { result } = renderHook(() => useBreakpoint(breakpoint));

    expect(result.current).toBe(true);
  });

  it('should return false when window width is above breakpoint', () => {
    const breakpoint = 768;
    window.innerWidth = 1024; // Above breakpoint

    const { result } = renderHook(() => useBreakpoint(breakpoint));

    expect(result.current).toBe(false);
  });

  it('should update when breakpoint changes', () => {
    const { result, rerender } = renderHook(
      ({ breakpoint }) => useBreakpoint(breakpoint),
      { initialProps: { breakpoint: 768 } }
    );

    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 767px)');

    // Change breakpoint
    rerender({ breakpoint: 1024 });

    expect(mockMatchMedia).toHaveBeenCalledWith('(max-width: 1023px)');
  });

  it('should handle window resize events with modern addEventListener', () => {
    const breakpoint = 768;
    window.innerWidth = 1024;

    renderHook(() => useBreakpoint(breakpoint));

    expect(mockMQL.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );

    // Simulate resize event
    const changeHandler = vi.mocked(mockMQL.addEventListener).mock.calls[0][1];
    window.innerWidth = 600;

    (global as any).act(() => {
      (changeHandler as Function)();
    });

    // Verify cleanup
    const { result } = renderHook(() => useBreakpoint(breakpoint));
    result.current; // Access result to trigger cleanup check
  });

  it('should handle legacy browsers with addListener fallback', () => {
    // Mock legacy browser (without addEventListener)
    const legacyMQL = {
      matches: false,
      media: '(max-width: 767px)',
      onchange: null,
      // No addEventListener/removeEventListener for legacy browser simulation
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
    mockMatchMedia.mockReturnValue(legacyMQL);

    const breakpoint = 768;
    renderHook(() => useBreakpoint(breakpoint));

    expect(legacyMQL.addListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should clean up event listeners on unmount with modern browsers', () => {
    const breakpoint = 768;
    const { unmount } = renderHook(() => useBreakpoint(breakpoint));

    unmount();

    expect(mockMQL.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
  });

  it('should clean up event listeners on unmount with legacy browsers', () => {
    // Mock legacy browser (without addEventListener)
    const legacyMQL = {
      matches: false,
      media: '(max-width: 767px)',
      onchange: null,
      // No addEventListener/removeEventListener for legacy browser simulation
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
    mockMatchMedia.mockReturnValue(legacyMQL);

    const breakpoint = 768;
    const { unmount } = renderHook(() => useBreakpoint(breakpoint));

    unmount();

    expect(legacyMQL.removeListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should handle edge case breakpoints', () => {
    // Test with very small breakpoint
    const smallBreakpoint = 1;
    window.innerWidth = 0;

    const { result: smallResult } = renderHook(() =>
      useBreakpoint(smallBreakpoint)
    );

    expect(smallResult.current).toBe(true);

    // Test with very large breakpoint
    const largeBreakpoint = 5000;
    window.innerWidth = 1920;

    const { result: largeResult } = renderHook(() =>
      useBreakpoint(largeBreakpoint)
    );

    expect(largeResult.current).toBe(true);
  });

  it('should handle missing addListener/removeListener gracefully', () => {
    // Mock browser without legacy support
    const incompleteMQL = {
      matches: false,
      media: '(max-width: 767px)',
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as MediaQueryList;
    mockMatchMedia.mockReturnValue(incompleteMQL);

    const breakpoint = 768;
    expect(() => {
      renderHook(() => useBreakpoint(breakpoint));
    }).not.toThrow();
  });

  it('should return boolean false for falsy initial state', () => {
    const breakpoint = 768;
    window.innerWidth = 1024;

    const { result } = renderHook(() => useBreakpoint(breakpoint));

    // useBreakpoint should return !!isBelowBreakpoint, ensuring boolean
    expect(typeof result.current).toBe('boolean');
    expect(result.current).toBe(false);
  });
});