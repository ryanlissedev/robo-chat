/**
 * Comprehensive Edge Cases and Error Scenarios Tests
 * Testing boundary conditions, error states, and exceptional cases
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Import error boundary for testing
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class TestErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, _errorInfo: React.ErrorInfo) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return <div data-testid="error-boundary">Something went wrong: {this.state.error?.message}</div>;
    }

    return this.props.children;
  }
}

describe('Edge Cases and Error Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods to avoid noise in test output
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Network and API Error Scenarios', () => {
    it('should handle fetch network errors', async () => {
      // Mock fetch to reject with network error
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const _TestComponent = () => {
        const [data, setData] = React.useState(null);
        const [_error, setError] = React.useState<string | null>(null);

        const fetchData = async () => {
          try {
            const response = await fetch('/api/test');
            const result = await response.json();
            setData(result);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          }
        };

        return (
          <div>
            <button onClick={fetchData} data-testid="fetch-button">
              Fetch Data
            </button>
            {error && <div data-testid="error-message">{error}</div>}
          </div>
        );

      render(<TestComponent />);
      const button = screen.getByTestId('fetch-button');
      
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Network error');
      });
    });

    it('should handle API response errors with different status codes', async () => {
      const errorScenarios = [
        { status: 400, statusText: 'Bad Request', expectedError: 'Bad Request' },
        { status: 401, statusText: 'Unauthorized', expectedError: 'Unauthorized' },
        { status: 403, statusText: 'Forbidden', expectedError: 'Forbidden' },
        { status: 404, statusText: 'Not Found', expectedError: 'Not Found' },
        { status: 429, statusText: 'Too Many Requests', expectedError: 'Too Many Requests' },
        { status: 500, statusText: 'Internal Server Error', expectedError: 'Internal Server Error' },
        { status: 503, statusText: 'Service Unavailable', expectedError: 'Service Unavailable' },
      ];

      for (const scenario of errorScenarios) {
        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: scenario.status,
          statusText: scenario.statusText,
          json: async () => ({ error: scenario.statusText }),
        });

        const _TestComponent = () => {
          const [_error, setError] = React.useState<string | null>(null);

          const fetchData = async () => {
            try {
              const response = await fetch('/api/test');
              if (!response.ok) {
                throw new Error(`${response.status}: ${response.statusText}`);
              }
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Unknown error');
            }
          };

          return (
            <div>
              <button onClick={fetchData} data-testid="fetch-button">
                Fetch Data
              </button>
            {error && <div data-testid="error-message">{error}</div>}
            </div>
          );

        const { unmount } = render(<TestComponent />);
        const button = screen.getByTestId('fetch-button');
        
        await userEvent.click(button);

        await waitFor(() => {
          expect(screen.getByTestId('error-message')).toHaveTextContent(`${scenario.status}: ${scenario.expectedError}`);
        });

        unmount();
      }
    });

    it('should handle malformed JSON responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError('Unexpected token < in JSON at position 0');
        },
      });

      const _TestComponent = () => {
        const [_error, setError] = React.useState<string | null>(null);

        const fetchData = async () => {
          try {
            const response = await fetch('/api/test');
            await response.json();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          }
        };

        return (
          <div>
            <button onClick={fetchData} data-testid="fetch-button">
              Fetch Data
            </button>
            {error && <div data-testid="error-message">{error}</div>}
          </div>
        );

      render(<TestComponent />);
      const button = screen.getByTestId('fetch-button');
      
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Unexpected token < in JSON at position 0');
      });
    });

    it('should handle timeout errors', async () => {
      // Mock AbortController for timeout simulation
      const mockAbortController = {
        signal: { aborted: false },
        abort: vi.fn(),
      };

      global.AbortController = vi.fn().mockImplementation(() => mockAbortController);
      
      global.fetch = vi.fn().mockImplementation(() => 
        new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout')), 100);
        })
      );

      const _TestComponent = () => {
        const [_error, setError] = React.useState<string | null>(null);

        const fetchData = async () => {
          try {
            const controller = new AbortController();
            setTimeout(() => controller.abort(), 50);
            
            await fetch('/api/test', { signal: controller.signal });
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          }
        };

        return (
          <div>
            <button onClick={fetchData} data-testid="fetch-button">
              Fetch Data
            </button>
            {error && <div data-testid="error-message">{error}</div>}
          </div>
        );

      render(<TestComponent />);
      const button = screen.getByTestId('fetch-button');
      
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('error-message')).toHaveTextContent('Request timeout');
      }, { timeout: 1000 });
    });
  });

  describe('React Component Error Scenarios', () => {
    it('should handle component render errors', () => {
      const onError = vi.fn();

      const _ThrowingComponent = () => {
        throw new Error('Component render error');
      };

      render(
        <TestErrorBoundary onError={onError}>
          <ThrowingComponent />
        </TestErrorBoundary>
      );

      expect(screen.getByTestId('error-boundary')).toHaveTextContent('Something went wrong: Component render error');
      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it('should handle async component errors', async () => {
      const onError = vi.fn();

      const _AsyncThrowingComponent = () => {
        const [shouldThrow, _setShouldThrow] = React.useState(false);

        React.useEffect(() => {
          if (shouldThrow) {
            throw new Error('Async component error');
          }
        }, [shouldThrow]);

        return (
          <button onClick={() => setShouldThrow(true)} data-testid="trigger-error">
            Trigger Error
          </button>
        );
      };

      render(
        <TestErrorBoundary onError={onError}>
          <AsyncThrowingComponent />
        </TestErrorBoundary>
      );

      const button = screen.getByTestId('trigger-error');
      
      expect(() => {
        fireEvent.click(button);
      }).toThrow('Async component error');
    });

    it('should handle undefined props gracefully', () => {
      const _ComponentWithProps = ({ requiredProp }: { requiredProp: string }) => (
        <div data-testid="component-output">{requiredProp?.toUpperCase() || 'No prop provided'}</div>
      );

      render(<ComponentWithProps requiredProp={undefined as any} />);

      expect(screen.getByTestId('component-output')).toHaveTextContent('No prop provided');
    });

    it('should handle null children', () => {
      const _WrapperComponent = ({ children }: { children: React.ReactNode }) => (
        <div data-testid="wrapper">
          {children || 'No children provided'}
        </div>
      );

      render(<WrapperComponent children={null} />);

      expect(screen.getByTestId('wrapper')).toHaveTextContent('No children provided');
    });

    it('should handle circular reference objects', () => {
      const circularObj: any = { name: 'test' };
      circularObj.self = circularObj;

      const _ComponentWithCircular = ({ data }: { data: any }) => {
        const [error, setError] = React.useState<string | null>(null);

        React.useEffect(() => {
          try {
            JSON.stringify(data);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Circular reference error');
          }
        }, [data]);

        return (
          <div data-testid="circular-component">
            {error || 'No error'}
          </div>
        );
      };

      render(<ComponentWithCircular data={circularObj} />);

      expect(screen.getByTestId('circular-component')).toHaveTextContent('circular');
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle extremely long input strings', () => {
      const veryLongString = 'a'.repeat(100000);

      const _InputComponent = () => {
        const [value, setValue] = React.useState('');
        const [error, setError] = React.useState<string | null>(null);

        const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
          const newValue = e.target.value;
          if (newValue.length > 10000) {
            setError('Input too long');
            return;
          }
          setValue(newValue);
          setError(null);
        };

        return (
          <div>
            <textarea
              value={value}
              onChange={handleChange}
              data-testid="long-input"
            />
            {error && <div data-testid="input-error">{error}</div>}
          </div>
        );
      };

      render(<InputComponent />);
      
      const textarea = screen.getByTestId('long-input');
      fireEvent.change(textarea, { target: { value: veryLongString } });

      expect(screen.getByTestId('input-error')).toHaveTextContent('Input too long');
    });

    it('should handle special characters and unicode', () => {
      const specialChars = '🚀 Special chars: ñáéíóú àèìòù äëïöü ß 中文 日本語 العربية';

      const _UnicodeComponent = () => {
        const [value, _setValue] = React.useState('');

        return (
          <div>
            <input
              value={value}
              onChange={(_e) => setValue(e.target.value)}
              data-testid="unicode-input"
            />
            <div data-testid="unicode-output">{value}</div>
          </div>
        );
      };

      render(<UnicodeComponent />);
      
      const input = screen.getByTestId('unicode-input');
      fireEvent.change(input, { target: { value: specialChars } });

      expect(screen.getByTestId('unicode-output')).toHaveTextContent(specialChars);
    });

    it('should handle empty and whitespace-only inputs', () => {
      const _whitespaceInputs = ['', '   ', '\t\t', '\n\n', '\r\n', '   \t  \n  '];

      const _ValidationComponent = ({ testInput }: { testInput: string }) => {
        const _isValid = testInput.trim().length > 0;

        return (
          <div data-testid={`validation-${testInput === '' ? 'empty' : 'whitespace'}`}>
            {isValid ? 'Valid' : 'Invalid'}
          </div>
        );
      };

      whitespaceInputs.forEach((input, index) => {
        const { unmount } = render(<ValidationComponent testInput={input} />);
        
        const testId = input === '' ? 'validation-empty' : 'validation-whitespace';
        expect(screen.getByTestId(testId)).toHaveTextContent('Invalid');
        
        unmount();
      });
    });

    it('should handle SQL injection attempts', () => {
      const sqlInjectionAttempts = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "admin'/*",
        "' UNION SELECT * FROM passwords --",
      ];

      const SafeQueryComponent = ({ query }: { query: string }) => {
        // Simple sanitization - in real app, use proper libraries
        const sanitizedQuery = query
          .replace(/['";]/g, '')
          .replace(/--/g, '')
          .replace(/\/\*/g, '')
          .replace(/\*\//g, '');

        return (
          <div data-testid="sanitized-query">{sanitizedQuery}</div>
        );
      };

      sqlInjectionAttempts.forEach((injection, index) => {
        const { unmount } = render(<SafeQueryComponent query={injection} />);
        
        const sanitized = screen.getByTestId('sanitized-query');
        expect(sanitized.textContent).not.toContain("'");
        expect(sanitized.textContent).not.toContain('"');
        expect(sanitized.textContent).not.toContain('--');
        
        unmount();
      });
    });

    it('should handle XSS attempts', () => {
      const xssAttempts = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("xss")',
        '<svg onload="alert(1)">',
      ];

      const SafeDisplayComponent = ({ content }: { content: string }) => {
        // React automatically escapes content, but let's be explicit
        const safeContent = content
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#x27;');

        return (
          <div data-testid="safe-content" dangerouslySetInnerHTML={{ __html: safeContent }} />
        );
      };

      xssAttempts.forEach((xss, index) => {
        const { unmount } = render(<SafeDisplayComponent content={xss} />);
        
        const safeDiv = screen.getByTestId('safe-content');
        expect(safeDiv.innerHTML).not.toContain('<script');
        expect(safeDiv.innerHTML).not.toContain('javascript:');
        
        unmount();
      });
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle large data sets without memory leaks', () => {
      const LargeDataComponent = () => {
        const [data, setData] = React.useState<number[]>([]);

        const addLargeData = () => {
          const largeArray = Array.from({ length: 100000 }, (_, i) => i);
          setData(largeArray);
        };

        return (
          <div>
            <button onClick={addLargeData} data-testid="add-data">
              Add Large Data
            </button>
            <div data-testid="data-count">{data.length} items</div>
          </div>
        );
      };

      render(<LargeDataComponent />);
      
      const button = screen.getByTestId('add-data');
      fireEvent.click(button);

      expect(screen.getByTestId('data-count')).toHaveTextContent('100000 items');
    });

    it('should handle rapid state updates', async () => {
      const RapidUpdatesComponent = () => {
        const [count, setCount] = React.useState(0);

        const rapidUpdate = () => {
          for (let i = 0; i < 1000; i++) {
            setCount(prev => prev + 1);
          }
        };

        return (
          <div>
            <button onClick={rapidUpdate} data-testid="rapid-update">
              Rapid Update
            </button>
            <div data-testid="count">{count}</div>
          </div>
        );
      };

      render(<RapidUpdatesComponent />);
      
      const button = screen.getByTestId('rapid-update');
      fireEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('count')).toHaveTextContent('1000');
      });
    });

    it('should handle deeply nested components', () => {
      const DeepComponent = ({ depth }: { depth: number }) => {
        if (depth === 0) {
          return <div data-testid="deepest-component">Deepest Level</div>;
        }
        
        return (
          <div data-testid={`level-$depth`}>
            Level {depth}
            <DeepComponent depth={depth - 1} />
          </div>
        );
      };

      render(<DeepComponent depth={100} />);
      
      expect(screen.getByTestId('deepest-component')).toBeInTheDocument();
      expect(screen.getByTestId('level-100')).toBeInTheDocument();
    });
  });

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle missing browser APIs gracefully', () => {
      // Mock missing localStorage
      const originalLocalStorage = global.localStorage;
      delete (global as any).localStorage;

      const LocalStorageComponent = () => {
        const [value, setValue] = React.useState<string | null>(null);
        const [error, setError] = React.useState<string | null>(null);

        const saveToStorage = () => {
          try {
            if (typeof Storage !== 'undefined' && localStorage) {
              localStorage.setItem('test', 'value');
              setValue('Saved');
            } else {
              throw new Error('localStorage not available');
            }
          } catch (err) {
            setError('Storage not available');
          }
        };

        return (
          <div>
            <button onClick={saveToStorage} data-testid="save-button">
              Save
            </button>
            {value && <div data-testid="success">{value}</div>}
            {error && <div data-testid="storage-error">{error}</div>}
          </div>
        );
      };

      render(<LocalStorageComponent />);
      
      const button = screen.getByTestId('save-button');
      fireEvent.click(button);

      expect(screen.getByTestId('storage-error')).toHaveTextContent('Storage not available');

      // Restore localStorage
      global.localStorage = originalLocalStorage;
    });

    it('should handle missing fetch API', () => {
      const originalFetch = global.fetch;
      delete (global as any).fetch;

      const FetchComponent = () => {
        const [error, setError] = React.useState<string | null>(null);

        const makeRequest = () => {
          try {
            if (typeof fetch === 'undefined') {
              throw new Error('Fetch API not available');
            }
            fetch('/api/test');
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
          }
        };

        return (
          <div>
            <button onClick={makeRequest} data-testid="fetch-button">
              Fetch
            </button>
            {error && <div data-testid="fetch-error">{error}</div>}
          </div>
        );
      };

      render(<FetchComponent />);
      
      const button = screen.getByTestId('fetch-button');
      fireEvent.click(button);

      expect(screen.getByTestId('fetch-error')).toHaveTextContent('Fetch API not available');

      // Restore fetch
      global.fetch = originalFetch;
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent API calls', async () => {
      const responses = ['Response 1', 'Response 2', 'Response 3'];
      let callCount = 0;

      global.fetch = vi.fn().mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: async () => ({ data: responses[callCount++] || 'Default' }),
        })
      );

      const ConcurrentComponent = () => {
        const [results, setResults] = React.useState<string[]>([]);

        const makeConcurrentCalls = async () => {
          const promises = Array.from({ length: 3 }, (_, i) =>
            fetch(`/api/endpoint$i`).then(r => r.json())
          );

          try {
            const responses = await Promise.all(promises);
            setResults(responses.map(r => r.data));
          } catch (err) {
            setResults(['Error occurred']);
          }
        };

        return (
          <div>
            <button onClick={makeConcurrentCalls} data-testid="concurrent-button">
              Make Concurrent Calls
            </button>
            <div data-testid="results">
              {results.map((result, index) => (
                <div key={index} data-testid={`result-$index`}>
                  {result}
                </div>
              ))}
            </div>
          </div>
        );
      };

      render(<ConcurrentComponent />);
      
      const button = screen.getByTestId('concurrent-button');
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByTestId('result-0')).toHaveTextContent('Response 1');
        expect(screen.getByTestId('result-1')).toHaveTextContent('Response 2');
        expect(screen.getByTestId('result-2')).toHaveTextContent('Response 3');
      });
    });

    it('should handle race conditions', async () => {
      let requestId = 0;

      global.fetch = vi.fn().mockImplementation(() => {
        const currentId = ++requestId;
        const delay = Math.random() * 100;
        
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({ id: currentId, data: `Response $currentId` }),
            });
          }, delay);
        });
      });

      const RaceConditionComponent = () => {
        const [result, setResult] = React.useState<string | null>(null);
        const [latestRequestId, setLatestRequestId] = React.useState(0);

        const makeRequest = async () => {
          const currentRequestId = latestRequestId + 1;
          setLatestRequestId(currentRequestId);

          try {
            const response = await fetch('/api/data');
            const data = await response.json();
            
            // Only update if this is still the latest request
            if (data.id >= currentRequestId) {
              setResult(data.data);
            }
          } catch (err) {
            setResult('Error');
          }
        };

        return (
          <div>
            <button onClick={makeRequest} data-testid="race-button">
              Make Request
            </button>
            {result && <div data-testid="race-result">{result}</div>}
          </div>
        );
      };

      render(<RaceConditionComponent />);
      
      const button = screen.getByTestId('race-button');
      
      // Make multiple rapid requests
      await userEvent.click(button);
      await userEvent.click(button);
      await userEvent.click(button);

      // Wait for requests to resolve
      await waitFor(() => {
        expect(screen.getByTestId('race-result')).toBeInTheDocument();
      });

      // Should have a response (exact content depends on timing)
      expect(screen.getByTestId('race-result')).toHaveTextContent(/Response d+/);
    });
  });
});