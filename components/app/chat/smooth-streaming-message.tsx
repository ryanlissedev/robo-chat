import { memo, useEffect, useRef } from 'react';
import { useSmoothStream } from './hooks/use-smooth-stream';

interface SmoothStreamingMessageProps {
  text: string;
  animate?: boolean;
  onComplete?: () => void;
}

/**
 * Component that provides smooth text streaming animation
 * Buffers chunks and displays them character-by-character for natural reading experience
 */
export const SmoothStreamingMessage = memo(
  ({ text, animate = false, onComplete }: SmoothStreamingMessageProps) => {
    const contentRef = useRef('');
    const { stream, addPart, reset, isAnimating } = useSmoothStream();

    useEffect(() => {
      if (!text || !animate) return;

      if (contentRef.current !== text) {
        const delta = text.slice(contentRef.current.length);
        if (delta) {
          addPart(delta);
        }
        contentRef.current = text;
      }
    }, [text, animate, addPart]);

    // Call onComplete when animation finishes
    useEffect(() => {
      if (!isAnimating && text && animate && stream === text && onComplete) {
        onComplete();
      }
    }, [isAnimating, text, animate, stream, onComplete]);

    // Reset when text changes completely
    useEffect(() => {
      if (!text) {
        reset();
        contentRef.current = '';
      }
    }, [text, reset]);

    if (!animate) return <>{text}</>;

    return <>{stream || text || ''}</>;
  }
);
