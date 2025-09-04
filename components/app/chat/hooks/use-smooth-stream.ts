import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Hook for smooth text streaming that decouples network streaming from visual streaming
 * Based on Upstash's smooth streaming pattern
 * Optimized for performance with memory management and reduced calculations
 */
export function useSmoothStream() {
  // Internal buffer of chunks as they arrive from the server
  const [parts, setParts] = useState<string[]>([]);

  // The currently visible text (animated character by character)
  const [stream, setStream] = useState('');

  const frame = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const streamIndexRef = useRef<number>(0);
  const isAnimatingRef = useRef(false);

  const addPart = useCallback((part: string) => {
    if (part) {
      setParts((prev) => [...prev, part]);
    }
  }, []);

  const reset = useCallback(() => {
    setParts([]);
    setStream('');
    streamIndexRef.current = 0;
    if (frame.current) {
      cancelAnimationFrame(frame.current);
    }
    frame.current = null;
    lastTimeRef.current = 0;
    isAnimatingRef.current = false;
  }, []);

  // Memoize full text to avoid recalculation on every render
  const fullText = useMemo(() => parts.join(''), [parts]);

  // Animation logic - runs whenever parts change
  useEffect(() => {
    if (isAnimatingRef.current) return;

    // Milliseconds per character - optimized for smooth performance
    const typewriterSpeed = 3; // Slightly faster for better responsiveness

    if (streamIndexRef.current >= fullText.length) {
      setStream(fullText);
      return;
    }

    isAnimatingRef.current = true;

    const animate = (time: number) => {
      if (streamIndexRef.current < fullText.length) {
        if (time - lastTimeRef.current > typewriterSpeed) {
          // Batch character updates for better performance
          const charsToAdd = Math.min(
            2,
            fullText.length - streamIndexRef.current
          );
          streamIndexRef.current += charsToAdd;
          setStream(fullText.slice(0, streamIndexRef.current));
          lastTimeRef.current = time;
        }
        frame.current = requestAnimationFrame(animate);
      } else {
        isAnimatingRef.current = false;
      }
    };

    frame.current = requestAnimationFrame(animate);

    return () => {
      if (frame.current) {
        cancelAnimationFrame(frame.current);
      }
      isAnimatingRef.current = false;
    };
  }, [fullText]);

  // Memoize the return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      stream,
      addPart,
      reset,
      isAnimating: isAnimatingRef.current,
    }),
    [stream, addPart, reset]
  );
}
