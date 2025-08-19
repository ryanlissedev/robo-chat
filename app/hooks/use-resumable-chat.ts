'use client';

import { useChat as useAIChat } from '@ai-sdk/react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { UIMessage } from 'ai';

interface UseResumableChatOptions {
  id?: string;
  api?: string;
  onFinish?: (message: UIMessage) => void;
  onError?: (error: Error) => void;
}

interface ResumableChatReturn {
  // Core useChat return properties
  messages: UIMessage[];
  input: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSubmit: (e: React.FormEvent<HTMLFormElement>, chatRequestOptions?: Record<string, unknown>) => void;
  setInput: (input: string) => void;
  status: 'ready' | 'submitted' | 'streaming' | 'error';
  error: Error | undefined;
  reload: () => void;
  stop: () => void;
  append: (message: UIMessage) => Promise<string | null | undefined>;
  setMessages: (messages: UIMessage[]) => void;
  
  // Resumable chat specific properties
  isResuming: boolean;
  resumeError: Error | null;
  resumeStream: () => Promise<void>;
  hasActiveStream: boolean;
}

/**
 * Enhanced useChat hook with resumable streams functionality
 * Based on the chat-sdk.dev implementation pattern
 */
export function useResumableChat({
  id,
  api = '/api/chat',
  onFinish,
  onError,
  ...options
}: UseResumableChatOptions = {}): ResumableChatReturn {
  const [isResuming, setIsResuming] = useState(false);
  const [resumeError, setResumeError] = useState<Error | null>(null);
  const [hasActiveStream, setHasActiveStream] = useState(false);

  const chatHook = useAIChat({
    id,
    onFinish: (options: { message: UIMessage }) => {
      setHasActiveStream(false);
      onFinish?.(options.message);
    },
    onError: (error: Error) => {
      setHasActiveStream(false);
      setResumeError(error);
      onError?.(error);
    },
    ...options,
  });

  const { status, messages } = chatHook;

  // Track active stream status
  useEffect(() => {
    setHasActiveStream(status === 'streaming' || status === 'submitted');
  }, [status]);

  /**
   * Resume an interrupted chat stream
   * Makes a GET request to the chat endpoint with chatId to resume from last state
   */
  const resumeStream = useCallback(async () => {
    if (!id) {
      console.warn('Cannot resume stream without chat ID');
      return;
    }

    setIsResuming(true);
    setResumeError(null);

    try {
      // Make GET request to resume stream
      const response = await fetch(`${api}?chatId=${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Resume failed: ${response.status} ${response.statusText}`
        );
      }

      // Check if there's an active stream to resume
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('text/stream')) {
        // Stream is active, handle the resumption
        setHasActiveStream(true);
        toast.success('Chat stream resumed successfully');
      } else {
        // No active stream, resume completed silently
        console.log('No active stream to resume');
      }
    } catch (error) {
      const resumeErr =
        error instanceof Error ? error : new Error('Resume failed');
      setResumeError(resumeErr);
      toast.error('Failed to resume chat stream');
      console.error('Resume error:', resumeErr);
    } finally {
      setIsResuming(false);
    }
  }, [id, api]);

  /**
   * Auto-resume on component mount if chat ID is provided
   * This runs only once during component mount
   */
  useEffect(() => {
    if (id && !isResuming && !hasActiveStream) {
      resumeStream();
    }
  }, [hasActiveStream, id, isResuming, resumeStream]); // Include all dependencies

  /**
   * Resume on reconnection after network issues
   */
  useEffect(() => {
    const handleOnline = () => {
      if (id && status === 'ready' && messages.length > 0) {
        console.log('Network reconnected, attempting to resume chat');
        resumeStream();
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [id, status, messages.length, resumeStream]);

  /**
   * Auto-resume on page visibility change (user returns to tab)
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && id && status === 'ready' && messages.length > 0) {
        // Small delay to avoid rapid resume attempts
        setTimeout(() => {
          resumeStream();
        }, 1000);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [id, status, messages.length, resumeStream]);

  return {
    ...chatHook,
    isResuming,
    resumeError,
    resumeStream,
    hasActiveStream,
  } as unknown as ResumableChatReturn;
}

/**
 * Utility hook for managing resumable stream state
 */
export function useStreamResumption() {
  const [activeStreams, setActiveStreams] = useState<Set<string>>(new Set());

  const trackStream = useCallback((chatId: string) => {
    setActiveStreams((prev) => new Set(prev).add(chatId));
  }, []);

  const untrackStream = useCallback((chatId: string) => {
    setActiveStreams((prev) => {
      const next = new Set(prev);
      next.delete(chatId);
      return next;
    });
  }, []);

  const isStreamActive = useCallback(
    (chatId: string) => {
      return activeStreams.has(chatId);
    },
    [activeStreams]
  );

  return {
    activeStreams: Array.from(activeStreams),
    trackStream,
    untrackStream,
    isStreamActive,
  };
}
