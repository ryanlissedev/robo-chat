import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

// Mock TextMorph to just render children
vi.mock('@/components/motion-primitives/text-morph', () => ({
  TextMorph: ({ children }: { children: React.ReactNode }) => children,
}));

// Import after mock
import { ButtonCopy } from '@/components/common/button-copy';

describe('ButtonCopy', () => {
  it('should render with initial "Copy" text', () => {
    render(<ButtonCopy code="test" />);
    expect(screen.getByText('Copy')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should copy code to clipboard when clicked', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      configurable: true,
    });

    const testCode = 'console.log("test");';
    render(<ButtonCopy code={testCode} />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Wait a bit for async operation
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(testCode);
    });
  });

  it('should show "Copied" text after clicking', async () => {
    const mockWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: mockWriteText },
      configurable: true,
    });

    render(<ButtonCopy code="test" />);
    expect(screen.getByText('Copy')).toBeInTheDocument();

    const button = screen.getByRole('button');

    // Click the button
    fireEvent.click(button);

    // Wait for the clipboard operation to be called and state to update
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith('test');
    });

    // Check that the button text changed to "Copied"
    await waitFor(() => {
      expect(button.textContent).toBe('Copied');
    });
  });
});
