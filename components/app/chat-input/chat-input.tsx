'use client';

import React from 'react';

import { ArrowUp, Send, Square } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ModelSelector } from '@/components/common/model-selector/base';
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/prompt-kit/prompt-input';
import { Button } from '@/components/ui/button';
import { getModelInfo } from '@/lib/models';
import {
  type ReasoningEffort,
  ReasoningEffortSelector,
} from '../chat/reasoning-effort-selector';
import { PromptSystem } from '../suggestions/prompt-system';
import { ButtonFileUpload } from './button-file-upload';
// Verbosity and summary controls removed - using defaults
// Search is always enabled; toggle removed
import { FileList } from './file-list';

type ChatInputProps = {
  value: string;
  onValueChange: (value: string) => void;
  onSend: () => void;
  isSubmitting?: boolean;
  hasMessages?: boolean;
  files: File[];
  onFileUpload: (files: File[]) => void;
  onFileRemove: (file: File) => void;
  onSuggestion: (suggestion: string) => void;
  hasSuggestions?: boolean;
  onSelectModel: (model: string) => void;
  selectedModel: string;
  isUserAuthenticated: boolean;
  userId?: string;
  stop: () => void;
  status?: 'submitted' | 'streaming' | 'ready' | 'error';
  setEnableSearch: (enabled: boolean) => void;
  enableSearch: boolean;
  quotedText?: { text: string; messageId: string } | null;
  reasoningEffort?: ReasoningEffort;
  onReasoningEffortChange?: (effort: ReasoningEffort) => void;
  verbosity?: 'low' | 'medium' | 'high';
  onVerbosityChange?: (v: 'low' | 'medium' | 'high') => void;
  reasoningSummary?: 'auto' | 'detailed';
  onReasoningSummaryChange?: (v: 'auto' | 'detailed') => void;
};

export function ChatInput({
  value,
  onValueChange,
  onSend,
  isSubmitting,
  files,
  onFileUpload,
  onFileRemove,
  onSuggestion,
  hasSuggestions,
  onSelectModel,
  selectedModel,
  isUserAuthenticated,
  userId: _userId,
  stop,
  status,
  setEnableSearch,
  quotedText,
  reasoningEffort,
  onReasoningEffortChange,
  verbosity: _verbosity,
  onVerbosityChange: _onVerbosityChange,
  reasoningSummary: _reasoningSummary,
  onReasoningSummaryChange: _onReasoningSummaryChange,
}: ChatInputProps) {
  // Search is always enabled regardless of model webSearch capability
  const isOnlyWhitespace = useCallback(
    (text: string) => !/[^\s]/.test(text),
    []
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Always show reasoning effort selector
  const [localReasoningEffort, setLocalReasoningEffort] =
    useState<ReasoningEffort>('medium');
  const currentReasoningEffort = reasoningEffort || localReasoningEffort;

  const handleReasoningEffortChange = useCallback(
    (effort: ReasoningEffort) => {
      setLocalReasoningEffort(effort);
      onReasoningEffortChange?.(effort);
    },
    [onReasoningEffortChange]
  );

  const handleVoiceTranscript = useCallback(
    (transcript: string) => {
      const newValue = value ? `${value}\n${transcript}` : transcript;
      onValueChange(newValue);

      // Focus textarea after transcript input
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    },
    [value, onValueChange]
  );

  const handleSend = useCallback(() => {
    if (isSubmitting) {
      return;
    }

    if (status === 'streaming') {
      stop();
      return;
    }

    onSend();
  }, [isSubmitting, onSend, status, stop]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isSubmitting) {
        e.preventDefault();
        return;
      }

      if (e.key === 'Enter' && status === 'streaming') {
        e.preventDefault();
        return;
      }

      if (e.key === 'Enter' && !e.shiftKey) {
        if (isOnlyWhitespace(value)) {
          return;
        }

        e.preventDefault();
        onSend();
      }
    },
    [isSubmitting, onSend, status, value, isOnlyWhitespace]
  );

  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) {
        return;
      }

      const hasImageContent = Array.from(items).some((item) =>
        item.type.startsWith('image/')
      );

      if (!isUserAuthenticated && hasImageContent) {
        e.preventDefault();
        return;
      }

      if (isUserAuthenticated && hasImageContent) {
        const imageFiles: File[] = [];

        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              const newFile = new File(
                [file],
                `pasted-image-${Date.now()}.${file.type.split('/')[1]}`,
                { type: file.type }
              );
              imageFiles.push(newFile);
            }
          }
        }

        if (imageFiles.length > 0) {
          onFileUpload(imageFiles);
        }
      }
      // Text pasting will work by default for everyone
    },
    [isUserAuthenticated, onFileUpload]
  );

  useEffect(() => {
    if (quotedText) {
      const quoted = quotedText.text
        .split('\n')
        .map((line) => `> ${line}`)
        .join('\n');
      onValueChange(value ? `${value}\n\n${quoted}\n\n` : `${quoted}\n\n`);

      requestAnimationFrame(() => {
        textareaRef.current?.focus();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotedText, onValueChange, value]);

  // Force-enable vector store search
  useEffect(() => {
    setEnableSearch?.(true);
  }, [setEnableSearch]);

  // Determine if selected model supports reasoning
  const selectedModelInfo = getModelInfo(selectedModel);
  const showReasoningEffort = Boolean(selectedModelInfo?.reasoningText);
  const _showVerbosity = showReasoningEffort;

  return (
    <div className="relative flex w-full flex-col gap-4">
      {hasSuggestions && (
        <PromptSystem
          onSuggestion={onSuggestion}
          onValueChange={onValueChange}
          value={value}
        />
      )}
      <div className="relative order-2 px-2 pb-3 sm:pb-4 md:order-1">
        <PromptInput
          className="relative z-10 bg-popover p-0 pt-1 shadow-xs backdrop-blur-xl"
          maxHeight={200}
          onValueChange={onValueChange}
          value={value}
        >
          <FileList files={files} onFileRemove={onFileRemove} />
          <PromptInputTextarea
            className="min-h-[48px] pt-3 pl-4 text-lg leading-[1.4] sm:text-lg md:text-lg"
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask anything…"
            ref={textareaRef}
          />
          <PromptInputActions className="mt-3 w-full justify-between p-2">
            <div className="flex gap-2">
              <ButtonFileUpload
                isUserAuthenticated={isUserAuthenticated}
                model={selectedModel}
                onFileUpload={onFileUpload}
              />
              <ModelSelector
                className="rounded-full"
                selectedModelId={selectedModel}
                setSelectedModelId={onSelectModel}
              />
              {/* Search toggle removed: vector-store search is always enabled */}
              {showReasoningEffort && (
                <ReasoningEffortSelector
                  className="rounded-full"
                  onChange={handleReasoningEffortChange}
                  value={currentReasoningEffort}
                />
              )}
              {/* Verbosity and summary controls removed - using defaults: low verbosity and auto summaries */}
            </div>
            <div className="flex items-center gap-2">
              {status === 'streaming' || (value && !isOnlyWhitespace(value)) ? (
                <PromptInputAction
                  tooltip={status === 'streaming' ? 'Stop' : 'Send'}
                >
                  <Button
                    aria-label={
                      status === 'streaming' ? 'Stop' : 'Send message'
                    }
                    className="size-10 rounded-full transition-all duration-300 ease-out"
                    disabled={
                      status !== 'streaming' &&
                      !!value &&
                      (isSubmitting || isOnlyWhitespace(value))
                    }
                    onClick={handleSend}
                    size="sm"
                    type="button"
                  >
                    {status === 'streaming' ? (
                      <Square className="size-5" />
                    ) : (
                      <ArrowUp className="size-5" />
                    )}
                  </Button>
                </PromptInputAction>
              ) : (
                <Button
                  aria-label="Open realtime audio modal"
                  className="size-10 rounded-full transition-all duration-300 ease-out"
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  <Send className="size-5" />
                </Button>
              )}
            </div>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}
