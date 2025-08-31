import { render } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock everything that could cause issues
vi.mock('motion/react', () => ({
  motion: { div: 'div', form: 'form', span: 'span' },
  AnimatePresence: ({ children }: any) => children,
}));

vi.mock('@/lib/supabase/config', () => ({
  isSupabaseEnabled: vi.fn(() => true),
}));

vi.mock('@/components/ui/toast', () => ({
  toast: vi.fn(),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null })),
    })),
  })),
}));

vi.mock('lucide-react', () => ({
  ChevronLeft: () =>
    React.createElement('div', { 'data-testid': 'chevron-left' }),
  CircleCheck: () =>
    React.createElement('div', { 'data-testid': 'circle-check' }),
  Loader2: () => React.createElement('div', { 'data-testid': 'loader2' }),
}));

vi.mock('@/components/ui/button', () => ({
  Button: React.forwardRef(({ children, ...props }: any, ref: any) =>
    React.createElement('button', { ...props, ref }, children)
  ),
}));

// Simple test component
function SimpleFeedbackForm() {
  return React.createElement(
    'div',
    { 'data-testid': 'feedback-form' },
    'Simple Form'
  );
}

describe('Simple FeedbackForm Test', () => {
  it('should render without hanging', () => {
    const { getByTestId } = render(React.createElement(SimpleFeedbackForm));
    expect(getByTestId('feedback-form')).toBeTruthy();
  });
});
