import { render, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useClickOutside from '@/app/hooks/use-click-outside';

// Test component to help test the hook
function TestComponent({
  onClickOutside,
}: {
  onClickOutside: (event: MouseEvent | TouchEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, onClickOutside);

  return (
    <div>
      <div ref={ref} data-testid="inside-element">
        Inside Element
        <button type="button" data-testid="nested-button">
          Nested Button
        </button>
      </div>
      <div data-testid="outside-element">Outside Element</div>
    </div>
  );
}

describe('useClickOutside', () => {
  let mockHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockHandler = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should call handler when clicking outside the element', () => {
    const { getByTestId } = render(
      <TestComponent onClickOutside={mockHandler} />
    );

    const outsideElement = getByTestId('outside-element');

    // Simulate mousedown on outside element
    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    Object.defineProperty(mouseEvent, 'target', {
      value: outsideElement,
      writable: false,
    });

    outsideElement.dispatchEvent(mouseEvent);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(mouseEvent);
  });

  it('should not call handler when clicking inside the element', () => {
    const { getByTestId } = render(
      <TestComponent onClickOutside={mockHandler} />
    );

    const insideElement = getByTestId('inside-element');

    // Simulate mousedown on inside element
    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    Object.defineProperty(mouseEvent, 'target', {
      value: insideElement,
      writable: false,
    });

    insideElement.dispatchEvent(mouseEvent);

    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should not call handler when clicking nested elements inside', () => {
    const { getByTestId } = render(
      <TestComponent onClickOutside={mockHandler} />
    );

    const nestedButton = getByTestId('nested-button');

    // Simulate mousedown on nested element
    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    Object.defineProperty(mouseEvent, 'target', {
      value: nestedButton,
      writable: false,
    });

    nestedButton.dispatchEvent(mouseEvent);

    expect(mockHandler).not.toHaveBeenCalled();
  });

  it('should handle touchstart events', () => {
    const { getByTestId } = render(
      <TestComponent onClickOutside={mockHandler} />
    );

    const outsideElement = getByTestId('outside-element');

    // Simulate touchstart on outside element
    const touchEvent = new TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
    });

    Object.defineProperty(touchEvent, 'target', {
      value: outsideElement,
      writable: false,
    });

    outsideElement.dispatchEvent(touchEvent);

    expect(mockHandler).toHaveBeenCalledTimes(1);
    expect(mockHandler).toHaveBeenCalledWith(touchEvent);
  });

  it('should handle null ref gracefully', () => {
    const mockHandlerForNull = vi.fn();

    renderHook(() => {
      const nullRef = { current: null };
      useClickOutside(nullRef, mockHandlerForNull);
    });

    // Click anywhere on document
    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    document.dispatchEvent(mouseEvent);

    // Should not call handler when ref is null
    expect(mockHandlerForNull).not.toHaveBeenCalled();
  });

  it('should clean up event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = render(<TestComponent onClickOutside={mockHandler} />);

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'mousedown',
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'touchstart',
      expect.any(Function)
    );

    removeEventListenerSpy.mockRestore();
  });

  it('should update handler when it changes', () => {
    const initialHandler = vi.fn();
    const updatedHandler = vi.fn();

    let currentHandler = initialHandler;

    const { rerender, getByTestId } = render(
      <TestComponent onClickOutside={currentHandler} />
    );

    const outsideElement = getByTestId('outside-element');
    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    Object.defineProperty(mouseEvent, 'target', {
      value: outsideElement,
      writable: false,
    });

    // Initial handler should be called
    outsideElement.dispatchEvent(mouseEvent);
    expect(initialHandler).toHaveBeenCalledTimes(1);
    expect(updatedHandler).not.toHaveBeenCalled();

    // Update handler
    currentHandler = updatedHandler;
    rerender(<TestComponent onClickOutside={currentHandler} />);

    // Clear previous calls
    initialHandler.mockClear();
    updatedHandler.mockClear();

    // New handler should be called
    outsideElement.dispatchEvent(mouseEvent);
    expect(initialHandler).not.toHaveBeenCalled();
    expect(updatedHandler).toHaveBeenCalledTimes(1);
  });

  it('should handle document as event target', () => {
    const { getByTestId } = render(
      <TestComponent onClickOutside={mockHandler} />
    );

    // Simulate click directly on document
    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    Object.defineProperty(mouseEvent, 'target', {
      value: document,
      writable: false,
    });

    document.dispatchEvent(mouseEvent);

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('should handle body as event target', () => {
    const { getByTestId } = render(
      <TestComponent onClickOutside={mockHandler} />
    );

    // Simulate click on body
    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    Object.defineProperty(mouseEvent, 'target', {
      value: document.body,
      writable: false,
    });

    document.dispatchEvent(mouseEvent);

    expect(mockHandler).toHaveBeenCalledTimes(1);
  });

  it('should handle ref changes', () => {
    const currentRef = {
      current: null as HTMLDivElement | null,
    } as React.RefObject<HTMLDivElement>;

    const { rerender } = renderHook(
      ({ ref }) => useClickOutside(ref, mockHandler),
      { initialProps: { ref: currentRef } }
    );

    // Create a new ref
    const element = document.createElement('div');
    document.body.appendChild(element);
    const newRef = { current: element } as React.RefObject<HTMLDivElement>;

    rerender({ ref: newRef });

    // Click outside the new element
    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    Object.defineProperty(mouseEvent, 'target', {
      value: document.body,
      writable: false,
    });

    document.dispatchEvent(mouseEvent);

    expect(mockHandler).toHaveBeenCalledTimes(1);

    // Clean up
    document.body.removeChild(element);
  });

  it('should handle events with no target', () => {
    renderHook(() => {
      const ref = { current: document.createElement('div') };
      useClickOutside(ref, mockHandler);
    });

    // Create event without target
    const mouseEvent = new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
    });

    // Don't set target property
    document.dispatchEvent(mouseEvent);

    // Should handle gracefully and not throw
    expect(() => {
      document.dispatchEvent(mouseEvent);
    }).not.toThrow();
  });
});
