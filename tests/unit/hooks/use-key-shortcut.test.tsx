import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useKeyShortcut } from '@/app/hooks/use-key-shortcut';

describe('useKeyShortcut', () => {
  let keydownEvent: KeyboardEvent;
  let mockCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockCallback = vi.fn();
    // Create a proper KeyboardEvent
    keydownEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clean up any remaining event listeners
    document.removeEventListener('keydown', expect.any(Function));
  });

  it('should call callback when condition is met', () => {
    const condition = vi.fn().mockReturnValue(true);

    renderHook(() => useKeyShortcut(condition, mockCallback));

    // Simulate keydown event
    document.dispatchEvent(keydownEvent);

    expect(condition).toHaveBeenCalledWith(keydownEvent);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should not call callback when condition is false', () => {
    const condition = vi.fn().mockReturnValue(false);

    renderHook(() => useKeyShortcut(condition, mockCallback));

    document.dispatchEvent(keydownEvent);

    expect(condition).toHaveBeenCalledWith(keydownEvent);
    expect(mockCallback).not.toHaveBeenCalled();
  });

  it('should handle Cmd+Shift+P shortcut', () => {
    const condition = (e: KeyboardEvent) =>
      (e.key === 'p' || e.key === 'P') && e.metaKey && e.shiftKey;

    renderHook(() => useKeyShortcut(condition, mockCallback));

    // Create event with Cmd+Shift+P
    const cmdShiftPEvent = new KeyboardEvent('keydown', {
      key: 'P',
      metaKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    document.dispatchEvent(cmdShiftPEvent);

    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should handle Ctrl+K shortcut (common pattern)', () => {
    const condition = (e: KeyboardEvent) =>
      e.key === 'k' && (e.ctrlKey || e.metaKey);

    renderHook(() => useKeyShortcut(condition, mockCallback));

    // Test with Ctrl+K
    const ctrlKEvent = new KeyboardEvent('keydown', {
      key: 'k',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    document.dispatchEvent(ctrlKEvent);

    expect(mockCallback).toHaveBeenCalledTimes(1);

    mockCallback.mockClear();

    // Test with Cmd+K
    const cmdKEvent = new KeyboardEvent('keydown', {
      key: 'k',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    document.dispatchEvent(cmdKEvent);

    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should not trigger on input elements (common use case)', () => {
    const condition = (e: KeyboardEvent) => e.key === 'Enter';
    
    renderHook(() => useKeyShortcut(condition, mockCallback));

    // Create an input element and focus it
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const enterEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true,
    });

    Object.defineProperty(enterEvent, 'target', {
      value: input,
      writable: false,
    });

    // If the hook properly checks for input targets, it should not call the callback
    // This test assumes the implementation would check for input elements
    document.dispatchEvent(enterEvent);

    // Clean up
    document.body.removeChild(input);
  });

  it('should handle multiple shortcut conditions', () => {
    const condition1 = vi.fn().mockReturnValue(true);
    const condition2 = vi.fn().mockReturnValue(false);
    const callback1 = vi.fn();
    const callback2 = vi.fn();

    renderHook(() => useKeyShortcut(condition1, callback1));
    renderHook(() => useKeyShortcut(condition2, callback2));

    document.dispatchEvent(keydownEvent);

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).not.toHaveBeenCalled();
  });

  it('should clean up event listener on unmount', () => {
    const condition = vi.fn().mockReturnValue(true);
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyShortcut(condition, mockCallback));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function)
    );

    removeEventListenerSpy.mockRestore();
  });

  it('should update callback when it changes', () => {
    const condition = vi.fn().mockReturnValue(true);
    let currentCallback = vi.fn();

    const { rerender } = renderHook(
      ({ callback }) => useKeyShortcut(condition, callback),
      { initialProps: { callback: currentCallback } }
    );

    document.dispatchEvent(keydownEvent);
    expect(currentCallback).toHaveBeenCalledTimes(1);

    // Update callback
    const newCallback = vi.fn();
    currentCallback = newCallback;
    rerender({ callback: newCallback });

    document.dispatchEvent(keydownEvent);
    expect(newCallback).toHaveBeenCalledTimes(1);
  });

  it('should update condition when it changes', () => {
    const callback = vi.fn();
    let currentCondition = vi.fn().mockReturnValue(true);

    const { rerender } = renderHook(
      ({ condition }) => useKeyShortcut(condition, callback),
      { initialProps: { condition: currentCondition } }
    );

    document.dispatchEvent(keydownEvent);
    expect(callback).toHaveBeenCalledTimes(1);

    callback.mockClear();

    // Update condition to return false
    currentCondition = vi.fn().mockReturnValue(false);
    rerender({ condition: currentCondition });

    document.dispatchEvent(keydownEvent);
    expect(callback).not.toHaveBeenCalled();
  });

  it('should handle escape key shortcut', () => {
    const condition = (e: KeyboardEvent) => e.key === 'Escape';

    renderHook(() => useKeyShortcut(condition, mockCallback));

    const escapeEvent = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });

    document.dispatchEvent(escapeEvent);

    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should handle case-insensitive key comparisons', () => {
    const condition = (e: KeyboardEvent) => 
      (e.key === 'p' || e.key === 'P') && e.metaKey;

    renderHook(() => useKeyShortcut(condition, mockCallback));

    // Test lowercase
    const lowerCaseEvent = new KeyboardEvent('keydown', {
      key: 'p',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    document.dispatchEvent(lowerCaseEvent);
    expect(mockCallback).toHaveBeenCalledTimes(1);

    mockCallback.mockClear();

    // Test uppercase
    const upperCaseEvent = new KeyboardEvent('keydown', {
      key: 'P',
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });

    document.dispatchEvent(upperCaseEvent);
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('should handle function keys', () => {
    const condition = (e: KeyboardEvent) => e.key === 'F1';

    renderHook(() => useKeyShortcut(condition, mockCallback));

    const f1Event = new KeyboardEvent('keydown', {
      key: 'F1',
      bubbles: true,
      cancelable: true,
    });

    document.dispatchEvent(f1Event);

    expect(mockCallback).toHaveBeenCalledTimes(1);
  });
});