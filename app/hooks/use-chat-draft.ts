import { useCallback, useState } from 'react';

export function useChatDraft(chatId: string | null) {
  const storageKey = chatId ? `chat-draft-${chatId}` : 'chat-draft-new';

  const [draftValue, setDraftValueState] = useState<string>(() => {
    if (typeof window === 'undefined') {
      return '';
    }
    try {
      const stored = localStorage.getItem(storageKey);
      // Clear any single character drafts (likely stuck values)
      if (stored && stored.length === 1 && stored !== ' ') {
        localStorage.removeItem(storageKey);
        return '';
      }
      return stored || '';
    } catch (error) {
      console.warn('Failed to read draft from localStorage:', error);
      return '';
    }
  });

  const setDraftValue = useCallback(
    (value: string) => {
      setDraftValueState(value);

      if (typeof window !== 'undefined') {
        try {
          if (value) {
            localStorage.setItem(storageKey, value);
          } else {
            localStorage.removeItem(storageKey);
          }
        } catch (error) {
          console.warn('Failed to save draft to localStorage:', error);
        }
      }
    },
    [storageKey]
  );

  const clearDraft = useCallback(() => {
    setDraftValueState('');
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.warn('Failed to clear draft from localStorage:', error);
      }
    }
  }, [storageKey]);

  return {
    draftValue,
    setDraftValue,
    clearDraft,
  };
}
