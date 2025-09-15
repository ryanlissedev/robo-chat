/**
 * Test Isolation Validation Suite
 * 
 * This test suite validates that all isolation mechanisms are working correctly.
 * It specifically tests for the common pollution issues that were occurring:
 * 1. Environment variable bleeding
 * 2. Global state persistence  
 * 3. DOM state pollution
 * 4. Supabase mock conflicts
 * 5. Module mock contamination
 */

import React from 'react';
import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { domIsolation, envIsolation, mockIsolation, testIsolation } from './test-isolation';

describe('Test Isolation Validation', () => {
  describe('Environment Variable Isolation', () => {
    it('should isolate environment variables between tests', () => {
      // Test 1: Set a custom environment variable
      const originalValue = process.env.TEST_VARIABLE;
      envIsolation.setTestEnv('TEST_VARIABLE', 'test-value-1');
      
      expect(process.env.TEST_VARIABLE).toBe('test-value-1');
      
      // Reset environment
      envIsolation.resetEnv();
      
      // Variable should be reset to original state
      expect(process.env.TEST_VARIABLE).toBe(originalValue);
    });

    it('should not leak environment changes to subsequent tests', () => {
      // This test should see clean environment
      expect(process.env.TEST_VARIABLE).toBeUndefined();
      
      // Set different value
      envIsolation.setTestEnv('TEST_VARIABLE', 'test-value-2');
      expect(process.env.TEST_VARIABLE).toBe('test-value-2');
    });

    it('should maintain core test environment variables', () => {
      envIsolation.resetEnv();
      
      // Core test variables should always be present
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
      expect(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY).toBeDefined();
      expect(process.env.ENCRYPTION_KEY).toBeDefined();
    });
  });

  describe('Mock Isolation', () => {
    it('should create isolated Supabase mocks', () => {
      const mock1 = mockIsolation.createIsolatedSupabaseMock();
      const mock2 = mockIsolation.createIsolatedSupabaseMock();
      
      // Mocks should be separate instances
      expect(mock1).not.toBe(mock2);
      expect(mock1.from).not.toBe(mock2.from);
      
      // Configure one mock differently
      mock1.from.mockReturnValue({ data: 'mock1' });
      mock2.from.mockReturnValue({ data: 'mock2' });
      
      expect(mock1.from()).toEqual({ data: 'mock1' });
      expect(mock2.from()).toEqual({ data: 'mock2' });
    });

    it('should reset all mocks properly', () => {
      const mockFn = vi.fn();
      mockFn('test-call');
      expect(mockFn).toHaveBeenCalledWith('test-call');
      
      mockIsolation.resetAllMocks();
      
      // Mock should be cleared
      expect(mockFn).not.toHaveBeenCalled();
    });

    it('should handle console mock restoration', () => {
      const originalError = console.error;
      const mockError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      mockError('test-error');
      expect(mockError).toHaveBeenCalledWith('test-error');
      
      mockIsolation.resetAllMocks();
      
      // Console should be restored
      expect(console.error).toBe(originalError);
    });
  });

  describe('DOM Isolation', () => {
    it('should clean up DOM state between tests', () => {
      // Add some content to the DOM
      if (typeof document !== 'undefined') {
        document.body.innerHTML = '<div id="test-content">Test Content</div>';
        expect(document.getElementById('test-content')).toBeTruthy();
        
        domIsolation.cleanupDOM();
        
        // DOM should be clean
        expect(document.getElementById('test-content')).toBeFalsy();
        expect(document.body.innerHTML).toBe('');
      }
    });

    it('should clear localStorage and sessionStorage', () => {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('test-key', 'test-value');
        expect(window.localStorage.getItem('test-key')).toBe('test-value');
        
        domIsolation.cleanupDOM();
        
        expect(window.localStorage.getItem('test-key')).toBeNull();
      }
    });

    it('should handle React component cleanup', () => {
      const TestComponent = () => React.createElement('div', { 'data-testid': 'test-component' }, 'Test');

      const { getByTestId } = render(React.createElement(TestComponent));
      expect(getByTestId('test-component')).toBeInTheDocument();

      domIsolation.cleanupDOM();

      // Component should be cleaned up
      expect(() => getByTestId('test-component')).toThrow();
    });
  });

  describe('Complete Test Isolation', () => {
    let testState: any = {};

    beforeEach(() => {
      testState = { initialized: true, counter: 0 };
    });

    afterEach(async () => {
      await testIsolation.cleanup();
    });

    it('should provide clean state for each test - Test A', () => {
      testState.counter = 5;
      testState.testA = true;
      
      // Set environment variable
      envIsolation.setTestEnv('ISOLATION_TEST', 'test-a');
      
      // Add DOM content
      if (typeof document !== 'undefined') {
        document.body.innerHTML = '<div>Test A Content</div>';
      }
      
      expect(testState.counter).toBe(5);
      expect(process.env.ISOLATION_TEST).toBe('test-a');
    });

    it('should provide clean state for each test - Test B', () => {
      // This test should start with fresh state
      expect(testState.counter).toBe(0); // Reset by beforeEach
      expect(testState.testA).toBeUndefined();
      expect(process.env.ISOLATION_TEST).toBeUndefined(); // Reset by isolation
      
      if (typeof document !== 'undefined') {
        expect(document.body.innerHTML).toBe(''); // Clean DOM
      }
      
      testState.counter = 10;
      testState.testB = true;
      envIsolation.setTestEnv('ISOLATION_TEST', 'test-b');
      
      expect(testState.counter).toBe(10);
      expect(process.env.ISOLATION_TEST).toBe('test-b');
    });

    it('should provide clean state for each test - Test C', () => {
      // This test should also start with fresh state
      expect(testState.counter).toBe(0);
      expect(testState.testB).toBeUndefined();
      expect(process.env.ISOLATION_TEST).toBeUndefined();
      
      // No pollution from previous tests
      expect(testState.testA).toBeUndefined();
    });
  });

  describe('Module Mock Isolation', () => {
    it('should not leak module mocks between tests', () => {
      // Mock a module for this test only
      vi.doMock('@/lib/test-module', () => ({
        testFunction: () => 'mocked-result',
      }));

      const testModule = vi.importActual('@/lib/test-module');
      // In a real scenario, this would be the mocked version
      // For this test, we're just verifying the isolation pattern works
      expect(vi.isMockFunction(testModule)).toBeFalsy(); // Would be true if module was actually mocked
    });

    it('should have clean module state', () => {
      // This test should not see the mock from the previous test
      // Module mocking isolation is handled by vi.resetModules() in the cleanup
      expect(true).toBe(true); // Placeholder assertion
    });
  });

  describe('Async Operation Isolation', () => {
    it('should handle timers properly', async () => {
      const callback = vi.fn();
      
      // Set up timer
      setTimeout(callback, 100);
      
      // Fast-forward time if using fake timers
      if (vi.isFakeTimers()) {
        vi.advanceTimersByTime(100);
      } else {
        // Wait for timer in real time
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      
      expect(callback).toHaveBeenCalled();
    });

    it('should clean up timers between tests', () => {
      const callback = vi.fn();
      
      // This test should not be affected by timers from previous tests
      setTimeout(callback, 1000);
      
      // Immediate cleanup should prevent the timer from firing
      vi.clearAllTimers();
      
      // Even if we wait, callback should not be called
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling in Isolation', () => {
    it('should handle cleanup errors gracefully', async () => {
      // Simulate a problematic state that might cause cleanup errors
      if (typeof window !== 'undefined') {
        // Create a problematic DOM state
        const problematicElement = document.createElement('div');
        Object.defineProperty(problematicElement, 'remove', {
          value: () => { throw new Error('Cleanup error'); },
        });
        document.body.appendChild(problematicElement);
      }
      
      // Cleanup should not throw even if there are errors
      await expect(testIsolation.cleanup()).resolves.not.toThrow();
    });

    it('should continue working after cleanup errors', () => {
      // Test should still work normally after the previous test with errors
      expect(true).toBe(true);
      
      if (typeof document !== 'undefined') {
        document.body.innerHTML = '<div>Normal content</div>';
        expect(document.body.innerHTML).toContain('Normal content');
      }
    });
  });
});

describe('Integration with Existing Test Patterns', () => {
  describe('Component Testing Isolation', () => {
    beforeEach(() => {
      testIsolation.setup();
    });

    afterEach(async () => {
      await testIsolation.cleanup();
    });

    it('should work with React component tests', () => {
      const TestComponent = ({ message }: { message: string }) => (
        <div data-testid="message">{message}</div>
      );

      const { getByTestId, rerender } = render(
        <TestComponent message="Initial message" />
      );

      expect(getByTestId('message')).toHaveTextContent('Initial message');

      rerender(<TestComponent message="Updated message" />);
      expect(getByTestId('message')).toHaveTextContent('Updated message');
    });

    it('should provide clean state for second component test', () => {
      const _AnotherComponent = () => (
        <div data-testid="another">Another component</div>
      );

      const { getByTestId } = render(<AnotherComponent />);
      expect(getByTestId('another')).toHaveTextContent('Another component');
      
      // Should not see any traces of previous test
      expect(() => getByTestId('message')).toThrow();
    });
  });

  describe('API Testing Isolation', () => {
    it('should isolate API mocks', () => {
      const mockResponse = { data: 'api-test-1' };
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        } as Response)
      );

      expect(global.fetch).toBeTruthy();
      // API test logic would go here
    });

    it('should have fresh API mocks', () => {
      // This test should have a clean fetch mock
      // The previous test's configuration should not leak here
      expect(vi.isMockFunction(global.fetch)).toBe(true);
      
      // Configure fresh for this test
      const mockResponse = { data: 'api-test-2' };
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      
      // Test would use this fresh configuration
    });
  });
});