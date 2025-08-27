import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ChatInput } from '@/components/app/chat-input/chat-input';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/lib/models', async () => {
  return {
    getModelInfo: vi.fn(),
  };
});

vi.mock('@/components/common/model-selector/base', () => {
  return {
    ModelSelector: () => <div data-testid="model-selector" />,
  };
});

const { getModelInfo } = await import('@/lib/models');

function renderChatInput(selectedModel: string) {
  return render(
    <TooltipProvider>
      <ChatInput
        value=""
        onValueChange={() => {}}
        onSend={() => {}}
        files={[]}
        onFileUpload={() => {}}
        onFileRemove={() => {}}
        onSuggestion={() => {}}
        hasSuggestions={false}
        onSelectModel={() => {}}
        selectedModel={selectedModel}
        isUserAuthenticated={true}
        userId="u1"
        stop={() => {}}
        setEnableSearch={() => {}}
        enableSearch
      />
    </TooltipProvider>
  );
}

describe('ChatInput reasoning selector gating', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows ReasoningEffortSelector when model has reasoningText', () => {
    (getModelInfo as any).mockReturnValue({ id: 'model-x', reasoningText: true });

    renderChatInput('model-x');

    // The selector renders a trigger with the current label (default Medium)
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('hides ReasoningEffortSelector when model lacks reasoningText', () => {
    (getModelInfo as any).mockReturnValue({ id: 'model-y', reasoningText: false });

    renderChatInput('model-y');

    // Ensure the default label is not present
    expect(screen.queryByText('Medium')).toBeNull();
  });
});
