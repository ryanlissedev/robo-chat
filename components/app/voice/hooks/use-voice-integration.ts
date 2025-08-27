'use client';

import { useEffect } from 'react';
import { useVoiceStore } from '../store/voice-store';

interface UseVoiceIntegrationProps {
  userId?: string;
  autoIndexTranscripts?: boolean;
  onTranscriptIndexed?: (result: {
    vectorStoreId: string;
    fileId: string;
  }) => void;
  onIndexError?: (error: Error) => void;
}

export function useVoiceIntegration({
  userId,
  autoIndexTranscripts = true,
  onTranscriptIndexed,
  onIndexError,
}: UseVoiceIntegrationProps = {}) {
  const {
    setUserId,
    updateConfig,
    indexTranscript,
    indexingStatus,
    vectorStoreId,
  } = useVoiceStore();

  // Initialize user ID and auto-indexing preference
  useEffect(() => {
    if (userId) {
      setUserId(userId);
    }

    updateConfig({ autoIndexTranscripts });
  }, [userId, autoIndexTranscripts, setUserId, updateConfig]);

  // Manual transcript indexing
  const indexTranscriptManually = async (
    transcript: string,
    metadata?: Record<string, unknown>
  ) => {
    try {
      await indexTranscript(transcript, metadata);

      if (onTranscriptIndexed && vectorStoreId) {
        onTranscriptIndexed({
          vectorStoreId,
          fileId: 'indexed', // API returns actual fileId
        });
      }
    } catch (error) {
      if (onIndexError) {
        onIndexError(
          error instanceof Error ? error : new Error('Unknown indexing error')
        );
      }
    }
  };

  // Search transcripts
  const searchTranscripts = async (query: string) => {
    if (!userId) {
      throw new Error('User ID required for transcript search');
    }
    const response = await fetch(
      `/api/voice/transcripts?userId=${encodeURIComponent(userId)}&query=${encodeURIComponent(query)}`
    );

    if (!response.ok) {
      throw new Error(`Failed to search transcripts: ${response.statusText}`);
    }

    return await response.json();
  };

  return {
    indexTranscriptManually,
    searchTranscripts,
    indexingStatus,
    vectorStoreId,
    isIndexingEnabled: autoIndexTranscripts,
  };
}
