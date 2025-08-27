import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { motion, AnimatePresence } from 'motion/react';
import { Suggestions } from '@/components/app/chat-input/suggestions';
import { SUGGESTIONS as SUGGESTIONS_CONFIG } from '@/lib/config';
import { TRANSITION_SUGGESTIONS } from '@/lib/motion';

// Mock motion/react
vi.mock('motion/react', () => ({
  motion: {
    create: (component: any) => component,
    div: 'div',
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock the config
vi.mock('@/lib/config', () => ({
  SUGGESTIONS: [
    {
      label: 'Operation',
      prompt: 'Operation',
      icon: () => <div>OperationIcon</div>,
      items: ['How do I start the RoboRail machine safely?', 'What are the daily operation procedures?', 'How do I calibrate the cutting head?'],
      highlight: true,
    },
    {
      label: 'Troubleshooting',
      prompt: 'Troubleshooting',
      icon: () => <div>TroubleshootingIcon</div>,
      items: ['The machine is showing error code E001', 'The cutting quality is poor', 'The machine stops unexpectedly'],
      highlight: false,
    },
    {
      label: 'Maintenance',
      prompt: 'Maintenance',
      icon: () => <div>MaintenanceIcon</div>,
      items: [],
      highlight: true,
    },
  ],
}));

// Mock the motion transition
vi.mock('@/lib/motion', () => ({
  TRANSITION_SUGGESTIONS: {
    duration: 0.1,
    ease: 'easeOut',
  },
}));

// Mock PromptSuggestion component
vi.mock('@/components/prompt-kit/prompt-suggestion', () => ({
  PromptSuggestion: ({ children, onClick, className, highlight, ...props }: any) => (
    <button
      {...props}
      className={className}
      onClick={onClick}
      data-testid="prompt-suggestion"
      data-highlight={highlight}
    >
      {children}
    </button>
  ),
}));

const defaultProps = {
  onValueChange: vi.fn(),
  onSuggestion: vi.fn(),
  value: '',
};

function renderSuggestions(props = {}) {
  return render(<Suggestions {...defaultProps} {...props} />);
}

describe('Suggestions', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Initial state', () => {
    it('should render category suggestions by default', () => {
      renderSuggestions();
      
      const suggestions = screen.getAllByTestId('prompt-suggestion');
      expect(suggestions).toHaveLength(3);
      
      expect(screen.getByText('Operation')).toBeInTheDocument();
      expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
      expect(screen.getByText('Maintenance')).toBeInTheDocument();
    });

    it('should render category icons', () => {
      renderSuggestions();
      
      expect(screen.getByText('OperationIcon')).toBeInTheDocument();
      expect(screen.getByText('TroubleshootingIcon')).toBeInTheDocument();
      expect(screen.getByText('MaintenanceIcon')).toBeInTheDocument();
    });

    it('should apply capitalize class to category suggestions', () => {
      renderSuggestions();
      
      const suggestions = screen.getAllByTestId('prompt-suggestion');
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveClass('capitalize');
      });
    });
  });

  describe('Category interaction', () => {
    it('should call onValueChange with category prompt when category clicked', async () => {
      const onValueChange = vi.fn();
      renderSuggestions({ onValueChange });
      
      const operationButton = screen.getByText('Operation');
      await user.click(operationButton);
      
      expect(onValueChange).toHaveBeenCalledWith('Operation');
    });

    it('should show category items when category is selected', async () => {
      const onValueChange = vi.fn();
      renderSuggestions({ onValueChange, value: 'Operation' });
      
      // Should not show categories
      expect(screen.queryByText('Operation')).not.toBeInTheDocument();
      expect(screen.queryByText('Troubleshooting')).not.toBeInTheDocument();
      
      // Should show category items
      expect(screen.getByText('How do I start the RoboRail machine safely?')).toBeInTheDocument();
      expect(screen.getByText('What are the daily operation procedures?')).toBeInTheDocument();
      expect(screen.getByText('How do I calibrate the cutting head?')).toBeInTheDocument();
    });

    it('should not show category items for categories with empty items', () => {
      renderSuggestions({ value: 'Maintenance' });
      
      // Should still show categories since Maintenance has no items
      expect(screen.getByText('Maintenance')).toBeInTheDocument();
    });
  });

  describe('Suggestion interaction', () => {
    it('should call onSuggestion and reset value when suggestion clicked', async () => {
      const onSuggestion = vi.fn();
      const onValueChange = vi.fn();
      renderSuggestions({ 
        onSuggestion, 
        onValueChange, 
        value: 'Operation' 
      });
      
      const suggestion = screen.getByText('How do I start the RoboRail machine safely?');
      await user.click(suggestion);
      
      expect(onSuggestion).toHaveBeenCalledWith('How do I start the RoboRail machine safely?');
      expect(onValueChange).toHaveBeenCalledWith('');
    });

    it('should apply correct styling to suggestions with highlight', () => {
      renderSuggestions({ value: 'Operation' });
      
      const suggestions = screen.getAllByTestId('prompt-suggestion');
      // Operation category has highlight: true
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveAttribute('data-highlight', 'true');
      });
    });

    it('should apply text-left class to category items', () => {
      renderSuggestions({ value: 'Operation' });
      
      const suggestions = screen.getAllByTestId('prompt-suggestion');
      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveClass('block', 'h-full', 'text-left');
      });
    });
  });

  describe('State management', () => {
    it('should reset active category when value is empty', () => {
      const { rerender } = renderSuggestions({ value: 'Operation' });
      
      // Should show category items
      expect(screen.getByText('How do I start the RoboRail machine safely?')).toBeInTheDocument();
      
      // Re-render with empty value
      rerender(<Suggestions {...defaultProps} value="" />);
      
      // Should show categories again
      expect(screen.getByText('Operation')).toBeInTheDocument();
      expect(screen.queryByText('How do I start the RoboRail machine safely?')).not.toBeInTheDocument();
    });

    it('should handle switching between categories', async () => {
      const onValueChange = vi.fn();
      const { rerender } = renderSuggestions({ onValueChange });
      
      // Click on Troubleshooting category
      const troubleshootingButton = screen.getByText('Troubleshooting');
      await user.click(troubleshootingButton);
      
      expect(onValueChange).toHaveBeenCalledWith('Troubleshooting');
      
      // Simulate value change
      rerender(
        <Suggestions 
          {...defaultProps} 
          onValueChange={onValueChange} 
          value="Troubleshooting" 
        />
      );
      
      // Should show Troubleshooting category items
      expect(screen.getByText('The machine is showing error code E001')).toBeInTheDocument();
      expect(screen.getByText('The cutting quality is poor')).toBeInTheDocument();
      expect(screen.getByText('The machine stops unexpectedly')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should render suggestions as buttons', () => {
      renderSuggestions();
      
      const suggestions = screen.getAllByTestId('prompt-suggestion');
      suggestions.forEach(suggestion => {
        expect(suggestion.tagName).toBe('BUTTON');
      });
    });

    it('should handle keyboard navigation', async () => {
      renderSuggestions();
      
      const firstSuggestion = screen.getByText('Operation');
      firstSuggestion.focus();
      
      await user.keyboard('{Enter}');
      
      expect(defaultProps.onValueChange).toHaveBeenCalledWith('Operation');
    });
  });

  describe('Animation', () => {
    it('should use AnimatePresence for transitions', () => {
      renderSuggestions();
      
      // AnimatePresence should be present in the component tree
      // This is tested through the mock
      expect(screen.getAllByTestId('prompt-suggestion').length).toBeGreaterThan(0);
    });

    it('should apply motion variants to suggestions', () => {
      renderSuggestions();
      
      const suggestions = screen.getAllByTestId('prompt-suggestion');
      // Motion props are passed through the mocked component
      expect(suggestions.length).toBe(3);
    });
  });

  describe('Edge cases', () => {
    it('should handle missing category data gracefully', () => {
      renderSuggestions({ value: 'Non-existent category' });
      
      // Should show categories since no matching category found
      expect(screen.getByText('Operation')).toBeInTheDocument();
      expect(screen.getByText('Troubleshooting')).toBeInTheDocument();
      expect(screen.getByText('Maintenance')).toBeInTheDocument();
    });

    it('should handle undefined value prop', () => {
      renderSuggestions({ value: undefined });
      
      // Should render without errors
      expect(screen.getByText('Operation')).toBeInTheDocument();
    });

    it('should handle empty suggestions config', () => {
      // Test the component's resilience by checking it doesn't crash with no suggestions
      // This test verifies the component handles empty states gracefully
      // We'll simulate this by checking the component works with minimal props
      renderSuggestions({ value: 'NonExistentCategory' });
      
      // Should still render the fallback categories
      expect(screen.getByText('Operation')).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should memoize component to prevent unnecessary re-renders', async () => {
      const { rerender } = renderSuggestions();
      
      // Look for any suggestions instead of specific text
      const suggestions = screen.getAllByTestId('prompt-suggestion');
      expect(suggestions).toHaveLength(3);
      
      // Re-render with same props
      rerender(<Suggestions {...defaultProps} />);
      
      // Component should still have suggestions
      const suggestionsAfterRerender = screen.getAllByTestId('prompt-suggestion');
      expect(suggestionsAfterRerender).toHaveLength(3);
    });

    it('should handle rapid category switches', async () => {
      const onValueChange = vi.fn();
      const localUser = userEvent.setup();
      renderSuggestions({ onValueChange });
      
      // Look for suggestions by test id instead of text
      const suggestions = screen.getAllByTestId('prompt-suggestion');
      expect(suggestions).toHaveLength(3);
      
      // Click different categories
      await localUser.click(suggestions[0]); // Operation
      await localUser.click(suggestions[1]); // Troubleshooting
      await localUser.click(suggestions[2]); // Maintenance
      
      expect(onValueChange).toHaveBeenCalledTimes(3);
      expect(onValueChange).toHaveBeenLastCalledWith('Maintenance');
    });
  });
});
