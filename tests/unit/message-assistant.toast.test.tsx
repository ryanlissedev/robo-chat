import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@/tests/test-utils';

// Mock streamdown (which pulls in katex CSS) BEFORE importing MessageAssistant
vi.mock('streamdown', () => ({
  Streamdown: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

// Mock the Response wrapper that uses Streamdown
vi.mock('@/components/ai-elements/response', () => ({
  Response: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

// Mock the UI toast module to capture calls and provide a render callback
vi.mock('@/components/ui/toast', () => {
  const state: { cb?: (id: number) => React.ReactElement; dismiss: any } = {
    cb: undefined,
    dismiss: vi.fn(),
  };
  function toast(opts: any) {
    // mirror the actual behavior: return sonner.custom(cb)
    state.cb = (id: number) => (
      <div>
        <div>File search failed</div>
        {opts?.button ? (
          <button onClick={() => { opts.button.onClick(); state.dismiss(id); }}>
            {opts.button.label}
          </button>
        ) : null}
      </div>
    );
    return 1; // fake toast id
  }
  return {
    toast,
    __mock: state,
  };
});

import { MessageAssistant } from '@/components/app/chat/message-assistant';

// Mock user preferences hook to avoid needing real provider
vi.mock('@/lib/user-preference-store/provider', () => ({
  useUserPreferences: () => ({
    preferences: {
      showToolInvocations: true,
      multiModelEnabled: false,
    },
  }),
}));


// Helpers to build a tool part for fileSearch failure
function buildFileSearchFailurePart(message: string) {
  return {
    type: 'tool-fileSearch',
    toolCallId: 'call_1',
    toolName: 'fileSearch',
    state: 'output-available',
    output: {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ success: false, error: message }),
        },
      ],
    },
  } as any;
}

describe('MessageAssistant toast on fileSearch failure', () => {
  beforeEach(async () => {
    // reset mock toast state
    const mod: any = await import('@/components/ui/toast');
    mod.__mock.cb = undefined;
    mod.__mock.dismiss.mockReset();
  });

  it('shows error toast with Retry button and triggers onReload when clicked', async () => {
    const onReload = vi.fn();

    render(
      <MessageAssistant
        children={''}
        isLast
        hasScrollAnchor={false}
        copied={false}
        copyToClipboard={() => {}}
        onReload={onReload}
        parts={[buildFileSearchFailurePart('Network error')]} // simulate tool output
        status={'ready'}
        className={''}
        messageId={'m1'}
        onQuote={() => {}}
      />
    );

    const mod: any = await import('@/components/ui/toast');
    expect(typeof mod.__mock.cb).toBe('function');
    const elem = mod.__mock.cb(123);
    const { getByText } = render(elem);

    // Click Retry and ensure onReload called and dismiss invoked
    getByText('Retry').click();

    expect(onReload).toHaveBeenCalledTimes(1);
    expect(mod.__mock.dismiss).toHaveBeenCalledWith(123);
  });

  it('shows error toast without button if no onReload provided', async () => {
    render(
      <MessageAssistant
        children={''}
        isLast
        hasScrollAnchor={false}
        copied={false}
        copyToClipboard={() => {}}
        parts={[buildFileSearchFailurePart('Failed to search')]}
        status={'ready'}
        className={''}
        messageId={'m2'}
        onQuote={() => {}}
      />
    );

    const mod: any = await import('@/components/ui/toast');
    expect(typeof mod.__mock.cb).toBe('function');
    const elem = mod.__mock.cb(1);
    const { queryByText, getByText } = render(elem);

    expect(getByText('File search failed')).toBeTruthy();
    expect(queryByText('Retry')).toBeNull();
  });
});
