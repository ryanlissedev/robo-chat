'use client';

import { AnimatePresence, motion } from 'motion/react';
import { memo, useCallback, useMemo, useState } from 'react';
import { PromptSuggestion } from '@/components/prompt-kit/prompt-suggestion';
import { SUGGESTIONS as SUGGESTIONS_CONFIG } from '@/lib/config';
import { TRANSITION_SUGGESTIONS } from '@/lib/motion';

type SuggestionsProps = {
  onValueChange: (value: string) => void;
  onSuggestion: (suggestion: string) => void;
  value?: string;
};

const MotionPromptSuggestion = motion.create(PromptSuggestion);

export const Suggestions = memo(function Suggestions({
  onValueChange,
  onSuggestion,
  value,
}: SuggestionsProps) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  if (!value && activeCategory !== null) {
    setActiveCategory(null);
  }

  // Derive active category from the external value when it matches a category prompt
  const derivedActiveCategory = useMemo(() => {
    if (value) {
      const matched = SUGGESTIONS_CONFIG.find(
        (group) => group.prompt === value
      );
      if (matched) return matched.label;
    }
    return activeCategory;
  }, [value, activeCategory]);

  const activeCategoryData = SUGGESTIONS_CONFIG.find(
    (group) => group.label === derivedActiveCategory
  );

  const showCategorySuggestions =
    activeCategoryData && activeCategoryData.items.length > 0;

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      setActiveCategory(null);
      onSuggestion(suggestion);
      onValueChange('');
    },
    [onSuggestion, onValueChange]
  );

  const handleCategoryClick = useCallback(
    (suggestion: { label: string; prompt: string }) => {
      setActiveCategory(suggestion.label);
      onValueChange(suggestion.prompt);
    },
    [onValueChange]
  );

  const suggestionsGrid = useMemo(
    () => (
      <motion.div
        animate="animate"
        className="flex w-full max-w-full flex-nowrap justify-start gap-2 overflow-x-auto px-2 md:mx-auto md:max-w-2xl md:flex-wrap md:justify-center md:pl-0"
        initial="initial"
        key="suggestions-grid"
        style={{
          scrollbarWidth: 'none',
        }}
        transition={TRANSITION_SUGGESTIONS}
        variants={{
          initial: { opacity: 0, y: 10, filter: 'blur(4px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
        }}
      >
        {SUGGESTIONS_CONFIG.map((suggestion, index) => (
          <MotionPromptSuggestion
            animate="animate"
            className="capitalize"
            initial="initial"
            key={suggestion.label}
            onClick={() => handleCategoryClick(suggestion)}
            transition={{
              ...TRANSITION_SUGGESTIONS,
              delay: index * 0.02,
            }}
            variants={{
              initial: { opacity: 0, scale: 0.8 },
              animate: { opacity: 1, scale: 1 },
            }}
          >
            <suggestion.icon className="size-4" />
            {suggestion.label}
          </MotionPromptSuggestion>
        ))}
      </motion.div>
    ),
    [handleCategoryClick]
  );

  const suggestionsList = useMemo(
    () => (
      <motion.div
        animate="animate"
        className="flex w-full flex-col space-y-1 px-2"
        initial="initial"
        key={activeCategoryData?.label}
        transition={TRANSITION_SUGGESTIONS}
        variants={{
          initial: { opacity: 0, y: 10, filter: 'blur(4px)' },
          animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
          exit: {
            opacity: 0,
            y: -10,
            filter: 'blur(4px)',
          },
        }}
      >
        {activeCategoryData?.items.map((suggestion: string, index: number) => (
          <MotionPromptSuggestion
            animate="animate"
            className="block h-full text-left"
            highlight={activeCategoryData.highlight}
            initial="initial"
            key={`${activeCategoryData?.label}-${suggestion}-${index}`}
            onClick={() => handleSuggestionClick(suggestion)}
            transition={{
              ...TRANSITION_SUGGESTIONS,
              delay: index * 0.05,
            }}
            type="button"
            variants={{
              initial: { opacity: 0, y: -10 },
              animate: { opacity: 1, y: 0 },
            }}
          >
            {suggestion}
          </MotionPromptSuggestion>
        ))}
      </motion.div>
    ),
    [
      handleSuggestionClick,
      activeCategoryData?.highlight,
      activeCategoryData?.items,
      activeCategoryData?.label,
    ]
  );

  return (
    <AnimatePresence mode="wait">
      {showCategorySuggestions ? suggestionsList : suggestionsGrid}
    </AnimatePresence>
  );
});
