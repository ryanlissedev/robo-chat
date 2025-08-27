import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook for smooth text streaming that decouples network streaming from visual streaming
 * Based on Upstash's smooth streaming pattern
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

  // Animation logic - runs whenever parts change
  useEffect(() => {
    if (isAnimatingRef.current) return;

    // Milliseconds per character - 5ms works well for readable speed
    const typewriterSpeed = 5;
    const fullText = parts.join('');

    if (streamIndexRef.current >= fullText.length) {
      setStream(fullText);
      return;
    }

    isAnimatingRef.current = true;

    const animate = (time: number) => {
      if (streamIndexRef.current < fullText.length) {
        if (time - lastTimeRef.current > typewriterSpeed) {
          streamIndexRef.current++;
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
  }, [parts]);

  return { stream, addPart, reset, isAnimating: isAnimatingRef.current };
}
