import { render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatInput } from '@/components/app/chat-input/chat-input';
import * as modelSelectorModule from '@/components/common/model-selector/base';
import { TooltipProvider } from '@/components/ui/tooltip';
import * as modelsModule from '@/lib/models';

// Create mock functions after vi is available
let mockGetModelInfo: ReturnType<typeof vi.fn>;
let _mockModelSelector: ReturnType<typeof vi.fn>;

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
    // Set up mocks using spyOn
    mockGetModelInfo = vi.spyOn(modelsModule, 'getModelInfo');
    _mockModelSelector = vi
      .spyOn(modelSelectorModule, 'ModelSelector')
      .mockImplementation(() =>
        React.createElement('div', { 'data-testid': 'model-selector' })
      );
    vi.clearAllMocks();
  });

  it('shows ReasoningEffortSelector when model has reasoningText', () => {
    mockGetModelInfo.mockReturnValue({ id: 'model-x', reasoningText: true });

    renderChatInput('model-x');

    // The selector renders a trigger with the current label (default Medium)
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('hides ReasoningEffortSelector when model lacks reasoningText', () => {
    mockGetModelInfo.mockReturnValue({ id: 'model-y', reasoningText: false });

    renderChatInput('model-y');

    // Ensure the default label is not present
    expect(screen.queryByText('Medium')).toBeNull();
  });
});
