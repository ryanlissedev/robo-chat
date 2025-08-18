# RoboRail Security Documentation

## API Key Security

### Encryption at Rest

RoboRail implements military-grade encryption for all API keys stored in the system:

- **Algorithm**: AES-256-GCM (Galois/Counter Mode)
- **Key Derivation**: PBKDF2 with 100,000 iterations
- **Authentication**: GCM mode provides authenticated encryption
- **Unique IVs**: Each API key uses a unique initialization vector
- **User Binding**: Keys are encrypted with user-specific AAD (Additional Authenticated Data)

### Security Features

#### 1. Multi-Layer Encryption
```typescript
// API keys are encrypted using:
- Master key from environment variable
- PBKDF2 key derivation for added security
- Per-user AAD binding
- Unique IV for each encryption
- Authentication tags for integrity verification
```

#### 2. Key Rotation
- Automatic rotation reminders
- Secure rotation with backup
- Audit trail for all rotations
- Zero-downtime rotation process

#### 3. Access Controls
- Row-Level Security (RLS) in database
- User-scoped access only
- Audit logging for all operations
- Rate limiting on sensitive endpoints

#### 4. Input Validation
- Format validation for each provider
- Entropy checks to detect weak keys
- Suspicious pattern detection
- SQL injection prevention

### Environment Variables

Required security environment variables:

```env
# Master encryption key (32 bytes, base64 encoded)
ENCRYPTION_KEY=your-base64-encoded-32-byte-key

# Optional: Custom salt for key derivation
ENCRYPTION_SALT=your-custom-salt

# Database encryption (Supabase Vault)
SUPABASE_VAULT_KEY=your-vault-key
```

### Generating Secure Keys

Generate a secure encryption key:

```bash
# Using OpenSSL
openssl rand -base64 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Security Best Practices

### 1. API Key Management

✅ **DO:**
- Rotate API keys regularly (every 90 days)
- Use environment variables for system keys
- Enable audit logging
- Monitor for suspicious activity
- Use provider-specific API key formats

❌ **DON'T:**
- Share API keys in code or logs
- Use test/demo keys in production
- Store unencrypted keys
- Disable security features
- Ignore rotation reminders

### 2. Rate Limiting

Endpoints are protected with rate limits:

| Endpoint | Limit | Window |
|----------|-------|---------|
| API Key Operations | 10 requests | 1 minute |
| API Key Testing | 5 requests | 1 minute |
| General API | 60 requests | 1 minute |

### 3. Audit Logging

All API key operations are logged:
- Creation
- Updates
- Deletion
- Access
- Rotation
- Failed attempts

### 4. Security Headers

The application enforces security headers:
- Strict-Transport-Security (HSTS)
- X-Frame-Options
- X-XSS-Protection
- X-Content-Type-Options
- Referrer-Policy
- Permissions-Policy

## Database Security

### Row-Level Security (RLS)

All sensitive tables have RLS enabled:

```sql
-- Users can only access their own data
CREATE POLICY "Users can manage their own API keys" ON user_keys
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

### Encryption Fields

Database schema for encrypted storage:

```sql
CREATE TABLE user_keys (
  encrypted_key TEXT NOT NULL,  -- AES-256-GCM encrypted
  iv TEXT NOT NULL,             -- Unique IV per key
  auth_tag TEXT,                -- GCM authentication tag
  masked_key VARCHAR(50),       -- Safe display version
  -- ... other fields
);
```

## Compliance & Standards

RoboRail follows industry standards:

- **OWASP Top 10** protection
- **GDPR** compliant data handling
- **SOC 2** security controls
- **PCI DSS** for payment keys (if applicable)
- **NIST** cryptographic standards

## Security Incident Response

### 1. Detection
- Automated monitoring for suspicious patterns
- Audit log analysis
- Rate limit violations
- Failed decryption attempts

### 2. Response
- Immediate key rotation capability
- User notification system
- Audit trail preservation
- Incident documentation

### 3. Recovery
- Key backup in audit logs
- Point-in-time recovery
- User re-authentication
- Security review process

## Security Checklist

### Development
- [ ] Use encryption utilities for all API keys
- [ ] Implement input validation
- [ ] Add rate limiting to new endpoints
- [ ] Enable audit logging
- [ ] Test key rotation

### Deployment
- [ ] Set ENCRYPTION_KEY environment variable
- [ ] Enable HTTPS only
- [ ] Configure CORS properly
- [ ] Review security headers
- [ ] Enable monitoring

### Operations
- [ ] Regular security audits
- [ ] Key rotation schedule
- [ ] Audit log review
- [ ] Vulnerability scanning
- [ ] Incident response drills

## Vulnerability Disclosure

Report security vulnerabilities to: security@roborail.ai

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

## Additional Resources

- [OWASP Security Guidelines](https://owasp.org)
- [NIST Cryptographic Standards](https://www.nist.gov/cryptography)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)