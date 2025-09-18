# Guest Mode Documentation

## Overview

Guest Mode allows users to access the chat application without creating an account. Users can bring their own API keys (BYOK) and use the full chat functionality while maintaining privacy and security through client-side encryption and local storage.

## Table of Contents

- [How Guest Mode Works](#how-guest-mode-works)
- [API Key Management](#api-key-management)
- [Storage Options](#storage-options)
- [Features and Limitations](#features-and-limitations)
- [Security and Privacy](#security-and-privacy)
- [Troubleshooting](#troubleshooting)
- [Developer Guide](#developer-guide)

## How Guest Mode Works

### Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Guest User    │────│  Browser App    │────│  AI Providers   │
│                 │    │                 │    │                 │
│ • No Account    │    │ • Local Storage │    │ • OpenAI        │
│ • BYOK          │    │ • Encryption    │    │ • Anthropic     │
│ • Local Data    │    │ • Session Mgmt  │    │ • Google        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Guest User Creation Flow

1. **Initial Access**: User visits the application without authentication
2. **Guest Detection**: Application detects no authentication session
3. **Guest Creation**: Generates a unique guest user ID
4. **Optional Database**: Creates guest record in Supabase (if available)
5. **Fallback Mode**: Functions entirely locally if database unavailable

### Guest Session Management

- **Session Token**: Generated client-side for session identification
- **Timeout**: 24-hour default session timeout
- **Persistence**: Sessions persist across tab refreshes but not browser restarts (unless using persistent storage)

## API Key Management

### Supported Providers

| Provider | Key Format | Example |
|----------|------------|---------|
| OpenAI | `sk-[48+ chars]` | `sk-1234567890abcdef...` |
| Anthropic | `sk-ant-[95+ chars]` | `sk-ant-api03-1234...` |
| Google | `[39 chars]` | `AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q` |
| Mistral | `[32 chars]` | `abc123def456ghi789jkl012mno345pqr` |
| Perplexity | `pplx-[32+ chars]` | `pplx-1234567890abcdef...` |
| xAI | `xai-[32+ chars]` | `xai-1234567890abcdef...` |

### API Key Validation

```typescript
// Format validation
const isValidOpenAIKey = (key: string) => /^sk-[a-zA-Z0-9]{48,}$/.test(key);

// Provider detection
const getProviderForModel = (model: string) => {
  if (model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('claude-')) return 'anthropic';
  // ... other providers
};
```

### Key Testing

API keys are validated through test requests to provider endpoints:

```typescript
// Test endpoint
POST /api/settings/test-api-key
{
  "provider": "openai",
  "isGuest": true
}

// Response
{
  "success": true,
  "error": null
}
```

## Storage Options

### 1. Memory (Tab Scope)

- **Duration**: Current tab session only
- **Security**: Highest - keys never written to disk
- **Use Case**: Maximum security, temporary usage
- **Persistence**: Lost on tab close/refresh

```typescript
// Usage
const headers = await headersForModel('gpt-4');
// Automatically includes in-memory keys in request headers
```

### 2. Session Storage

- **Duration**: Browser session (until browser closed)
- **Security**: High - encrypted with ephemeral key
- **Use Case**: Multi-tab usage within session
- **Persistence**: Survives tab refresh, lost on browser restart

```typescript
// Encrypted storage
const encrypted = await encryptWithKey(apiKey, ephemeralKey);
sessionStorage.setItem('guestByok:session:openai', JSON.stringify(encrypted));
```

### 3. Persistent Storage

- **Duration**: Indefinite (until manually removed)
- **Security**: Medium - encrypted with user passphrase
- **Use Case**: Regular users who want convenience
- **Persistence**: Survives browser restarts

```typescript
// Passphrase-based encryption
const encrypted = await encryptWithPassphrase(apiKey, userPassphrase);
localStorage.setItem('guestByok:persistent:openai', JSON.stringify(encrypted));
```

### Storage Priority

When multiple storage scopes contain keys for the same provider:

1. **Memory** (highest priority)
2. **Session Storage**
3. **Persistent Storage** (lowest priority)

## Features and Limitations

### ✅ Available Features

| Feature | Description |
|---------|-------------|
| **Chat Interface** | Full conversational AI with all supported models |
| **File Uploads** | Document analysis and image processing |
| **Model Switching** | Switch between providers/models mid-conversation |
| **Local Settings** | Theme, language, temperature, and other preferences |
| **Chat History** | Local storage of conversation history |
| **Export/Import** | Backup and restore settings and conversations |
| **Real-time** | Streaming responses and live typing indicators |
| **Search** | File search and web search capabilities |

### ❌ Limitations

| Limitation | Reason | Alternative |
|------------|---------|-------------|
| **Cloud Sync** | No user account | Export/Import settings |
| **Analytics** | Privacy protection | Local usage tracking only |
| **Team Features** | Single-user mode | Sign up for account |
| **Premium Models** | Account verification required | Use personal API keys |
| **Advanced Features** | Account-based entitlements | Upgrade to full account |
| **Rate Limits** | Guest user restrictions | 50 requests/hour default |

### Rate Limiting

```typescript
const guestLimits = {
  maxRequestsPerHour: 50,
  maxTokensPerRequest: 4000,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  maxConversations: 100,
  maxMessagesPerConversation: 1000
};
```

## Security and Privacy

### Encryption Standards

- **Algorithm**: AES-GCM 256-bit encryption
- **Key Derivation**: PBKDF2 with SHA-256 (100,000 iterations)
- **Random Generation**: Cryptographically secure randomness via Web Crypto API

### Security Architecture

```typescript
// Memory storage - no disk writes
const memoryKey = await generateEphemeralAesKey();
const encrypted = await encryptWithKey(apiKey, memoryKey);

// Session storage - ephemeral encryption key
const sessionKey = await generateEphemeralAesKey();
const sessionEncrypted = await encryptWithKey(apiKey, sessionKey);

// Persistent storage - passphrase-based
const salt = randomBytes(16);
const derivedKey = await deriveKeyFromPassphrase(passphrase, salt);
const persistentEncrypted = await encryptWithKey(apiKey, derivedKey);
```

### Privacy Guarantees

1. **No Server Storage**: API keys never stored on application servers
2. **Client-Side Encryption**: All sensitive data encrypted before storage
3. **Ephemeral Keys**: Session keys exist only in memory
4. **No Tracking**: Guest users are not tracked across sessions
5. **Local Processing**: Settings and preferences stored locally only

### API Key Masking

```typescript
// Display format for UI
const maskKey = (key: string, visible = 4) => {
  if (!key) return '';
  const tail = key.slice(-visible);
  return `${key.slice(0, visible)}•••••••${tail}`;
};

// Example: "sk-12•••••••cdef"
```

## Troubleshooting

### Common Issues

#### 1. API Key Not Working

**Symptoms**: Authentication errors, "Invalid API key" messages

**Solutions**:
- Verify key format matches provider requirements
- Check key has necessary permissions for chosen model
- Test key directly with provider's API
- Ensure key hasn't expired or been revoked

#### 2. Storage Issues

**Symptoms**: Settings not persisting, keys disappearing

**Solutions**:
- Check browser storage quota (may be full)
- Verify browser supports localStorage/sessionStorage
- Clear corrupted storage data
- Switch to different storage scope

#### 3. Network/Connectivity

**Symptoms**: Requests failing, timeout errors

**Solutions**:
- Check internet connectivity
- Verify provider service status
- Try different provider/model
- Check rate limiting status

#### 4. Browser Compatibility

**Symptoms**: Encryption errors, storage failures

**Solutions**:
- Ensure modern browser with Web Crypto API support
- Enable JavaScript and localStorage
- Disable browser extensions that might interfere
- Clear browser cache and cookies

### Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `AUTH_001` | Invalid API key format | Check key format for provider |
| `AUTH_002` | API key permissions insufficient | Verify key has model access |
| `STORAGE_001` | Quota exceeded | Clear storage or use different scope |
| `STORAGE_002` | Encryption failed | Check browser Web Crypto support |
| `NETWORK_001` | Request timeout | Check connectivity and try again |
| `RATE_001` | Rate limit exceeded | Wait before next request |

## Developer Guide

### Integration Points

#### Guest User Detection

```typescript
const isGuestUser = !user?.id || user?.anonymous === true;
const hasApiKey = await getMemoryCredentialPlaintext(provider);
const canUseChat = isGuestUser && hasApiKey;
```

#### API Request Headers

```typescript
const headers = await headersForModel(modelId);
if (headers) {
  // Headers automatically include:
  // X-Model-Provider: openai
  // X-Provider-Api-Key: sk-...
  // X-Credential-Source: guest-byok
}
```

#### Storage Management

```typescript
const credentialService = new GuestCredentialService();

// Save with different scopes
await credentialService.saveCredential({
  provider: 'openai',
  key: 'sk-...',
  storageScope: 'session'
});

// Load all available credentials
const credentials = await credentialService.loadCredentials();

// Test key validity
const result = await credentialService.testApiKey('openai');
```

#### Error Handling

```typescript
const handleGuestError = (error: any) => {
  if (error.status === 401) {
    // API key invalid - prompt for new key
    showApiKeyModal();
  } else if (error.status === 429) {
    // Rate limited - show wait message
    showRateLimitMessage(error.retryAfter);
  } else {
    // Other errors - fallback gracefully
    enableOfflineMode();
  }
};
```

### Testing Guest Mode

#### Unit Tests

```typescript
describe('Guest Functionality', () => {
  it('should store API keys securely', async () => {
    const service = new GuestCredentialService();
    const result = await service.saveCredential({
      provider: 'openai',
      key: 'sk-test-key',
      storageScope: 'session'
    });

    expect(result.masked).toBe('sk-t•••••••key');
    expect(result.scope).toBe('session');
  });
});
```

#### Integration Tests

```typescript
it('should complete guest chat flow', async () => {
  // Create guest user
  const response = await POST('/api/create-guest', {
    userId: 'test-guest'
  });

  // Add API key
  const headers = await headersForModel('gpt-4');

  // Send chat message
  const chatResponse = await POST('/api/chat', {
    headers,
    body: { messages: [...] }
  });

  expect(chatResponse.ok).toBe(true);
});
```

#### E2E Tests

```typescript
test('guest user workflow', async ({ page }) => {
  await page.goto('/');

  // Start as guest
  await page.click('[data-testid="start-as-guest"]');

  // Add API key
  await page.fill('[placeholder="Enter API key"]', 'sk-test-key');
  await page.click('[data-testid="save-key"]');

  // Send message
  await page.fill('[placeholder="Type message"]', 'Hello');
  await page.click('[data-testid="send-button"]');

  // Verify response
  await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();
});
```

### Configuration

#### Environment Variables

```env
# Guest mode settings
GUEST_MODE_ENABLED=true
GUEST_RATE_LIMIT_PER_HOUR=50
GUEST_MAX_TOKEN_LIMIT=4000
GUEST_SESSION_TIMEOUT_MS=86400000  # 24 hours

# Security settings
ENCRYPTION_KEY=your-32-char-encryption-key-here
PBKDF2_ITERATIONS=100000
```

#### Feature Flags

```typescript
const guestFeatures = {
  chatEnabled: true,
  fileUploadEnabled: true,
  webSearchEnabled: true,
  analyticsEnabled: false,
  cloudSyncEnabled: false,
  premiumModelsEnabled: false
};
```

### Best Practices

1. **Security First**: Always encrypt sensitive data before storage
2. **Graceful Degradation**: Provide fallbacks when services unavailable
3. **Clear Communication**: Explain limitations and guide users
4. **Performance**: Use appropriate storage scope for use case
5. **Testing**: Comprehensive test coverage for all scenarios
6. **Monitoring**: Track errors and usage patterns for improvements

### Migration Path

For users who want to upgrade from guest to authenticated:

```typescript
const migrateGuestToUser = async (guestData: GuestData, newUser: User) => {
  // Export guest settings
  const settings = await exportGuestSettings();

  // Transfer to user account
  await importUserSettings(newUser.id, settings);

  // Clear guest data
  await clearGuestData();

  // Redirect to authenticated flow
  window.location.href = '/dashboard';
};
```

---

## Support

For additional support or questions:

- **Documentation**: Check this guide and inline help text
- **Issues**: Report bugs via the feedback system
- **Security**: Report security issues through secure channels only
- **Feature Requests**: Use the in-app feedback form

**Remember**: Guest mode is designed for privacy and security. Your API keys and data never leave your browser unless you explicitly export them.