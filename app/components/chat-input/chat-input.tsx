'use client';

import { ArrowUpIcon, StopIcon, Plus, Mic } from 'lucide-react';
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
import { VoiceInput } from '../chat/voice-input';
import { VoiceAgent } from '../chat/voice-agent';
import { RealtimeVoice, useRealtimeVoice } from '../chat/realtime-voice';
import { ChatGPTVoiceInput } from '../chat/chatgpt-voice-input';

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
  chatId?: string;
  onToggleVoice?: () => void;
  useModernVoiceInput?: boolean;
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
  chatId,
  onToggleVoice,
  useModernVoiceInput = false,
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
        {useModernVoiceInput ? (
          /* Modern ChatGPT-style Voice Input */
          <div className="relative">
            <ChatGPTVoiceInput
              value={value}
              onValueChange={onValueChange}
              onSend={handleSend}
              chatId={chatId}
              disabled={isSubmitting}
              placeholder="Ask about RoboRail..."
              className="w-full"
            />
            
            {/* Files display above input when present */}
            {files.length > 0 && (
              <div className="mb-3">
                <FileList files={files} onFileRemove={onFileRemove} />
              </div>
            )}

            {/* Traditional action buttons below for additional functionality */}
            <div className="flex items-center justify-between mt-3 px-2">
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
                {hasSearchSupport && (
                  <ButtonSearch
                    isAuthenticated={isUserAuthenticated}
                    isSelected={enableSearch}
                    onToggle={setEnableSearch}
                  />
                )}
                {isGPT5Model && (
                  <ReasoningEffortCompact
                    className="ml-1"
                    onChange={handleReasoningEffortChange}
                    value={currentReasoningEffort}
                  />
                )}
              </div>
              
              {/* Send Button */}
              <Button
                aria-label={status === 'streaming' ? 'Stop' : 'Send message'}
                className="h-8 px-4 rounded-full transition-all duration-300 ease-out bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium"
                data-testid="send-button"
                disabled={isDisabled}
                onClick={handleSend}
                size="sm"
                type="button"
              >
                {status === 'streaming' ? 'Stop' : 'Send'}
              </Button>
            </div>
          </div>
        ) : (
          /* Clean Minimal Input */
          <div className="relative">
            {files.length > 0 && (
              <div className="mb-3">
                <FileList files={files} onFileRemove={onFileRemove} />
              </div>
            )}
            <div className="flex items-center gap-3 px-6 py-3 bg-gray-50 dark:bg-gray-900 rounded-full border border-gray-200 dark:border-gray-800">
              {/* Plus Icon - triggers file upload */}
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 0) {
                      onFileUpload(files);
                    }
                    e.target.value = '';
                  }}
                  className="hidden"
                />
                <Plus className="size-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" />
              </label>
              
              {/* Input Field */}
              <input
                ref={textareaRef}
                type="text"
                value={value}
                onChange={(e) => onValueChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Ask anything"
                className="flex-1 bg-transparent outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 text-base"
                data-testid="chat-input"
              />
              
              {/* Right Side Actions */}
              <div className="flex items-center gap-2">
                {/* Microphone Button */}
                {onToggleVoice && (
                  <button
                    type="button"
                    onClick={onToggleVoice}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    aria-label="Voice input"
                  >
                    <Mic className="size-5" />
                  </button>
                )}
                
                {/* Audio Waveform Icon - visible when no text */}
                {!value && (
                  <div className="text-gray-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v20M6 8v8M18 8v8M3 12v0M21 12v0M9 5v14M15 5v14" />
                    </svg>
                  </div>
                )}
                
                {/* Send Button - visible when text is entered */}
                {value && (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={isDisabled}
                    className="size-9 rounded-full bg-orange-500 hover:bg-orange-600 text-white flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={status === 'streaming' ? 'Stop' : 'Send message'}
                    data-testid="send-button"
                  >
                    {status === 'streaming' ? (
                      <StopIcon className="size-4" />
                    ) : (
                      <ArrowUpIcon className="size-4" />
                    )}
                  </button>
                )}
              </div>
            </div>
            
            {/* Hidden controls for advanced features */}
            <div className="hidden">
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
              {hasSearchSupport && (
                <ButtonSearch
                  isAuthenticated={isUserAuthenticated}
                  isSelected={enableSearch}
                  onToggle={setEnableSearch}
                />
              )}
              {isGPT5Model && (
                <ReasoningEffortCompact
                  className="ml-1"
                  onChange={handleReasoningEffortChange}
                  value={currentReasoningEffort}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
