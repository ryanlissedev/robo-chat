'use client';

import { ArrowUpIcon, StopIcon } from '@phosphor-icons/react';
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
  ReasoningEffortCompact,
} from '../chat/reasoning-effort-selector';
import { PromptSystem } from '../suggestions/prompt-system';
import { ButtonFileUpload } from './button-file-upload';
import { ButtonSearch } from './button-search';
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
  stop: () => void;
  status?: 'submitted' | 'streaming' | 'ready' | 'error';
  setEnableSearch: (enabled: boolean) => void;
  enableSearch: boolean;
  quotedText?: { text: string; messageId: string } | null;
  reasoningEffort?: ReasoningEffort;
  onReasoningEffortChange?: (effort: ReasoningEffort) => void;
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
  stop,
  status,
  setEnableSearch,
  enableSearch,
  quotedText,
  reasoningEffort,
  onReasoningEffortChange,
}: ChatInputProps) {
  const selectModelConfig = getModelInfo(selectedModel);
  const hasSearchSupport = Boolean(selectModelConfig?.webSearch);
  const isOnlyWhitespace = (text: string) => !/[^\s]/.test(text);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fix hydration mismatch by ensuring consistent disabled state
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const isDisabled = isHydrated
    ? !value || isSubmitting || isOnlyWhitespace(value)
    : true;

  // Ensure textarea retains focus when suggestions mount and on initial render
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  // Show reasoning effort selector only for GPT-5 models
  const isGPT5Model = selectedModel.startsWith('gpt-5');
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
    [isSubmitting, onSend, status, value]
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
            className="min-h-[44px] pt-3 pl-4 text-base leading-[1.3] sm:text-base md:text-base"
            data-testid="chat-input"
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
                isUserAuthenticated={isUserAuthenticated}
                selectedModelId={selectedModel}
                setSelectedModelId={onSelectModel}
              />
              {hasSearchSupport ? (
                <ButtonSearch
                  isAuthenticated={isUserAuthenticated}
                  isSelected={enableSearch}
                  onToggle={setEnableSearch}
                />
              ) : null}
              {isGPT5Model && (
                <ReasoningEffortCompact
                  className="ml-1"
                  onChange={handleReasoningEffortChange}
                  value={currentReasoningEffort}
                />
              )}
            </div>
            <PromptInputAction
              tooltip={status === 'streaming' ? 'Stop' : 'Send'}
            >
              <Button
                aria-label={status === 'streaming' ? 'Stop' : 'Send message'}
                className="size-9 rounded-full transition-all duration-300 ease-out"
                data-testid="send-button"
                disabled={isDisabled}
                onClick={handleSend}
                size="sm"
                type="button"
              >
                {status === 'streaming' ? (
                  <StopIcon className="size-4" />
                ) : (
                  <ArrowUpIcon className="size-4" />
                )}
              </Button>
            </PromptInputAction>
          </PromptInputActions>
        </PromptInput>
      </div>
    </div>
  );
}
