# Fetch Mocking Fix for Vitest Tests

## Problem

Tests were failing with the error:
```
TypeError: global.fetch.mockResolvedValueOnce is not a function
```

This occurred because `global.fetch` was not properly set up with Jest-style mocking methods (`mockResolvedValueOnce`, `mockRejectedValueOnce`, etc.) that tests expected.

## Root Cause

The original setup in `/tests/setup.ts` created a mock with Jest-style methods using `createMockWithJestMethods()`, but the function was being called incorrectly. The mock was being enhanced with methods, but not properly assigned as a shared reference across `globalThis.fetch` and `global.fetch`.

Additionally, there was a syntax error in the OpenAI mock class where the `chat` property was missing a semicolon.

## Solution

### 1. Fixed Fetch Mock Setup (`/tests/setup.ts` lines 82-91)

```typescript
// Mock fetch globally for all tests with enhanced methods
// Create the base vi.fn() first, then enhance it with Jest-style methods
const mockFetchFn = vi.fn();
const mockFetch = createMockWithJestMethods(mockFetchFn);
globalThis.fetch = mockFetch;

// Also ensure global.fetch points to the same mock
if (typeof global !== 'undefined') {
  (global as any).fetch = mockFetch;
}
```

**Key Changes:**
- Create a base `vi.fn()` first
- Enhance it with Jest-style methods using `createMockWithJestMethods()`
- Assign the enhanced mock to both `globalThis.fetch` and `global.fetch`
- Ensures consistent reference across test files

### 2. Added Mock Reset in beforeEach (`/tests/setup.ts` line 189)

```typescript
beforeEach(() => {
  // Capture a shallow snapshot of current env just before each test begins
  __envBaseline = { ...process.env };

  // Reset fetch mock for each test
  mockFetch.mockClear();
});
```

This ensures each test starts with a clean fetch mock state.

### 3. Fixed OpenAI Mock Syntax (`/tests/setup.ts` line 369)

Changed:
```typescript
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({ ... }),
      },
    },  // Missing semicolon!
  },
```

To:
```typescript
    chat = {
      completions: {
        create: vi.fn().mockResolvedValue({ ... }),
      },
    };  // Added semicolon!
  },
```

## Usage in Tests

Tests can now use Jest-style mocking syntax with Vitest:

```typescript
// Mock successful response
(global.fetch as any).mockResolvedValueOnce({
  status: 200,
  ok: true,
  json: async () => ({ success: true }),
});

// Mock error response
(global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

// Mock multiple responses in sequence
(global.fetch as any)
  .mockResolvedValueOnce({ status: 200, ok: true })
  .mockResolvedValueOnce({ status: 404, ok: false });
```

## Helper Function: createMockWithJestMethods

This helper adds Jest-compatible methods to Vitest mocks:

```typescript
const createMockWithJestMethods = (baseMock: any) => {
  baseMock.mockResolvedValue = (value: any) => {
    baseMock.mockImplementation(() => Promise.resolve(value));
    return baseMock;
  };
  baseMock.mockResolvedValueOnce = (value: any) => {
    baseMock.mockImplementationOnce(() => Promise.resolve(value));
    return baseMock;
  };
  baseMock.mockRejectedValue = (value: any) => {
    baseMock.mockImplementation(() => Promise.reject(value));
    return baseMock;
  };
  baseMock.mockRejectedValueOnce = (value: any) => {
    baseMock.mockImplementationOnce(() => Promise.reject(value));
    return baseMock;
  };
  return baseMock;
};
```

## Files Affected

- `/tests/setup.ts` - Main fix applied here
- `/tests/unit/ai-gateway.test.ts` - Now passing (19/19 tests)
- `/tests/unit/guest-user-functionality.test.ts` - Uses fetch mocking
- `/tests/unit/guest-user-fallback-behavior.test.ts` - Uses fetch mocking
- `/tests/unit/guest-api-key-management.test.ts` - Uses fetch mocking
- `/tests/unit/services/api-key-service.test.ts` - Uses fetch mocking
- `/tests/integration/guest-user-complete-flow.test.ts` - Uses fetch mocking

## Test Results

After fix:
```
✓ tests/unit/ai-gateway.test.ts (19 tests) 547ms
  ✓ All 19 tests passing
```

## Key Takeaways

1. **Vitest vs Jest**: Vitest doesn't have `mockResolvedValueOnce` by default - we need to add it
2. **Global References**: Both `globalThis.fetch` and `global.fetch` must point to the same mock
3. **Mock Cleanup**: Always clear mocks in `beforeEach` to prevent test interference
4. **TypeScript Class Syntax**: Class properties in TypeScript need semicolons when using field declarations

## Migration Pattern

If you encounter similar errors in other test files:

1. Check if the mock is properly created with `createMockWithJestMethods()`
2. Verify both `globalThis` and `global` references point to the same mock
3. Ensure `beforeEach` clears mock state with `mockClear()`
4. Consider using `vi.spyOn(globalThis, 'fetch')` for individual test file mocks

## Alternative Approach (Not Used)

Instead of the global mock, individual tests could use:

```typescript
const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({ ... });
```

However, the global approach in `setup.ts` is preferred for consistency across all test files.
