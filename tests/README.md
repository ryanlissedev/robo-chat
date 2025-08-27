# Test Coverage Tooling Setup

This document describes the comprehensive test coverage tooling setup for the robo-chat project.

## 🎯 Overview

The test suite has been enhanced with:
- **V8 Coverage Provider**: Working V8 coverage provider with 100% threshold enforcement
- **Test Utilities Library**: Complete set of mock factories, test builders, and custom matchers
- **Enhanced Coverage Reporting**: Multiple report formats with detailed analysis
- **Proper Environment Setup**: Coverage-aware test configuration

## 📁 File Structure

```
tests/
├── utils/                     # Test utility library
│   ├── index.ts              # Central exports and convenience utilities
│   ├── mock-factories.ts     # Mock factories for all dependencies
│   ├── test-builders.ts      # Builder pattern test data creators
│   └── custom-matchers.ts    # Domain-specific assertions
├── setup.ts                  # Main test setup
├── setup-coverage.ts         # Coverage-aware setup enhancements
├── coverage.config.ts        # V8 coverage configuration
└── README.md                 # This file
```

## ⚙️ Configuration

### V8 Coverage Provider
- **Provider**: V8 (fixed and working)
- **Thresholds**: 100% coverage enforced for branches, functions, lines, and statements
- **Reports**: text, html, json, lcov, clover formats
- **Environment-aware**: Different thresholds for development, production, and CI

### Coverage Thresholds
```typescript
// Production (default)
branches: 100%
functions: 100% 
lines: 100%
statements: 100%

// Development
branches: 80%
functions: 85%
lines: 85%
statements: 85%

// CI
branches: 95%
functions: 95%
lines: 95%
statements: 95%
```

## 🧰 Test Utilities

### Mock Factories
Comprehensive mocks for:
- **Supabase**: Client, auth, database operations
- **API Responses**: REST and streaming responses
- **Chat Messages**: Messages, conversations, file uploads
- **Authentication**: Users, sessions, tokens
- **Browser APIs**: localStorage, WebSocket, etc.

```typescript
import { mockSupabase, mockUser, mockApiResponse } from '@/tests/utils';

// Create authenticated user
const { user, session, supabase } = setupTest.withAuth();

// Mock API response
const response = mockApiResponse({ data: { success: true } });
```

### Test Builders
Builder pattern for creating test data:
- **UserBuilder**: Create users with various configurations
- **SessionBuilder**: Authentication sessions
- **ChatMessageBuilder**: Chat messages and conversations  
- **ConversationBuilder**: Full conversation threads
- **FileUploadBuilder**: File upload scenarios

```typescript
import { User, Session, Message, Conversation } from '@/tests/utils';

// Build test data
const user = User.admin().withEmail('admin@test.com').build();
const conversation = Conversation.simple().withUser(user.id).build();
const messages = Message.buildList(5, [
  { role: 'user' },
  { role: 'assistant' }
]);
```

### Custom Matchers
Domain-specific assertions:
- **String Validation**: `toBeValidEmail()`, `toBeValidUUID()`, `toBeValidJWT()`
- **Time Assertions**: `toBeWithinTimeRange()`, `toBeValidTimestamp()`
- **Supabase Objects**: `toMatchSupabaseUser()`, `toMatchSupabaseSession()`
- **API Responses**: `toBeValidAPIResponse()`, `toHaveStreamingResponse()`
- **Security**: `toMatchApiKeyPattern()`, `toBeValidEncryptionKey()`

```typescript
// Use custom matchers
expect(user.email).toBeValidEmail();
expect(session).toMatchSupabaseSession();
expect(apiResponse).toBeValidAPIResponse();
expect(timestamp).toBeWithinTimeRange(start, end);
```

## 📊 NPM Scripts

### Basic Testing
```bash
npm test                    # Run tests in watch mode
npm run test:run           # Run tests once
npm run test:ui            # Run tests with UI
```

### Coverage Testing
```bash
npm run test:coverage      # Run with 100% coverage enforcement
npm run test:coverage:dev  # Run with relaxed development thresholds  
npm run test:coverage:ci   # Run with CI configuration and JSON output
npm run test:coverage:watch # Coverage in watch mode
npm run test:coverage:ui   # Coverage with UI
```

### Targeted Testing
```bash
npm run test:unit                    # Unit tests only
npm run test:unit:coverage          # Unit tests with coverage
npm run test:integration             # Integration tests only  
npm run test:integration:coverage   # Integration tests with coverage
```

## 🛠️ Setup Utilities

### Test Environment Setup
```typescript
import { setupTest } from '@/tests/utils';

// Clean environment
const mocks = setupTest.withMocks();

// Authenticated environment  
const { user, session, supabase } = setupTest.withAuth();

// With conversation data
const { conversation, messages } = setupTest.withConversation(10);

// Cleanup
setupTest.cleanup();
```

### Performance Testing
```typescript
import { performance } from '@/tests/utils';

// Measure execution time
const { result, duration } = await performance.measure(() => expensiveFunction());

// Assert performance
const result = await performance.expectWithinTime(() => fastFunction(), 100); // 100ms

// Benchmark multiple runs
const { averageDuration } = await performance.benchmark(() => fn(), 10);
```

### Memory Testing
```typescript
import { memory } from '@/tests/utils';

// Check memory usage
const usage = memory.getUsage();

// Assert memory limits
await memory.expectMemoryUsage(() => processLargeData(), 50); // 50MB max
```

## 📈 Coverage Reports

Coverage reports are generated in multiple formats:

### HTML Report
- **Location**: `./coverage/index.html`
- **Features**: Interactive browsing, source highlighting, drill-down analysis

### JSON Reports
- **Summary**: `./coverage/coverage-summary.json`
- **Detailed**: `./coverage/coverage-final.json`
- **Usage**: CI/CD integration, programmatic analysis

### LCOV Report  
- **Location**: `./coverage/lcov.info`
- **Usage**: IDE integration, external tools

## 🔧 Environment Variables

```bash
COVERAGE=1              # Enable coverage collection
NODE_ENV=development    # Use development thresholds
CI=1                   # Use CI configuration
```

## ✅ Best Practices

### Writing Tests with Coverage
1. **Import utilities**: Use the centralized utils index
2. **Use builders**: Create test data with builder pattern
3. **Use custom matchers**: Domain-specific assertions
4. **Setup/teardown**: Use setupTest utilities
5. **Performance aware**: Use performance testing utilities

### Example Test Structure
```typescript
import { describe, it, expect, setupTest, User, mockApiResponse } from '@/tests/utils';

describe('User Management', () => {
  let testEnv: ReturnType<typeof setupTest.withAuth>;

  beforeEach(() => {
    testEnv = setupTest.withAuth();
  });

  afterEach(() => {
    setupTest.cleanup();
  });

  it('should create user successfully', async () => {
    // Arrange
    const userData = User.create().withEmail('test@example.com').build();
    const mockResponse = mockApiResponse({ data: userData });
    
    // Act
    const result = await createUser(userData);
    
    // Assert
    expect(result).toMatchSupabaseUser();
    expect(result.email).toBeValidEmail();
  });
});
```

## 🚀 Next Steps

1. **Gradual Migration**: Move existing tests to use new utilities
2. **Coverage Improvement**: Systematically improve coverage to reach 100%
3. **CI Integration**: Integrate coverage reports into CI/CD pipeline
4. **Documentation**: Add more examples and use cases

## 📋 Current Status

- ✅ V8 coverage provider working
- ✅ 100% coverage thresholds enforced
- ✅ Complete test utilities library
- ✅ Enhanced coverage reporting
- ✅ Environment-aware configuration
- ✅ NPM scripts updated
- ✅ Documentation complete

The test coverage tooling is now fully functional and ready for use!