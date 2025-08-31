# RoboChat Troubleshooting Guide

## Rate Limiting Configuration

### Current Configuration
The RoboChat project has flexible rate limiting configuration for different user types:

- **Guest Users (Non-authenticated)**: 10,000 requests per day
- **Authenticated Users**: 1,000 requests per day
- **Pro Model Limit**: 500 requests per day

### Configuration Files
- **Main Config**: `lib/config.ts`
  - `NON_AUTH_DAILY_MESSAGE_LIMIT = 10_000`
  - `AUTH_DAILY_MESSAGE_LIMIT = 1000`
  - `DAILY_LIMIT_PRO_MODELS = 500`

- **Rate Limiting Logic**: `app/api/rate-limits/api.ts`

### Disabling Rate Limits
To completely disable rate limiting, set the environment variable:
```bash
DISABLE_RATE_LIMIT=true
```

This will bypass all rate limiting checks for guest users in development and when explicitly disabled.

### Modifying Rate Limits
To change rate limits, edit the values in `lib/config.ts`:

```typescript
// For guest users
export const NON_AUTH_DAILY_MESSAGE_LIMIT = 10_000; // Change this value

// For authenticated users  
export const AUTH_DAILY_MESSAGE_LIMIT = 1000; // Change this value
```

## Next.js Build Cache Issues

### Common Symptoms
- ENOENT errors when accessing `_buildManifest.js.tmp.*` files
- Development server failing to start
- Missing files in `.next/static/development/` directory
- Corrupted build cache

### Root Causes
1. **Turbopack Cache Corruption**: Next.js 15 uses Turbopack which can have cache issues
2. **Interrupted Builds**: Build processes interrupted mid-way
3. **File System Issues**: Permissions or disk space problems
4. **Concurrent Builds**: Multiple build processes running simultaneously

### Solutions

#### Quick Fix Commands
```bash
# Clean all caches and rebuild
pnpm run clean && pnpm run build

# Clean development start
pnpm run dev:clean

# Clean production build
pnpm run build:clean

# Manual cache cleanup only
pnpm run clean:cache
```

#### Comprehensive Fix Script
Run the automated fix script:
```bash
./scripts/fix-build-cache.sh
```

This script will:
1. Remove `.next` and `.turbo` directories
2. Clear pnpm cache and store
3. Reinstall dependencies
4. Rebuild the project

#### Manual Steps
If the script doesn't work, follow these manual steps:

1. **Stop all development servers**
2. **Clean build artifacts**:
   ```bash
   rm -rf .next
   rm -rf .turbo
   rm -rf node_modules/.cache
   rm -rf node_modules/.pnpm
   ```

3. **Clear pnpm cache**:
   ```bash
   pnpm store prune
   ```

4. **Reinstall dependencies**:
   ```bash
   pnpm install
   ```

5. **Rebuild project**:
   ```bash
   pnpm run build
   ```

### Preventive Measures

1. **Use Clean Commands**: Always use `pnpm run dev:clean` or `pnpm run build:clean` when experiencing issues

2. **Avoid Interrupting Builds**: Let build processes complete fully

3. **Regular Cache Cleanup**: Run `pnpm run clean:cache` periodically

4. **Monitor Disk Space**: Ensure adequate disk space for build processes

5. **Single Build Process**: Avoid running multiple build commands simultaneously

### Environment-Specific Solutions

#### Development Environment
- Use `pnpm run dev:clean` for a fresh start
- Enable verbose logging: `DEBUG=* pnpm run dev`

#### Production Environment
- Use `pnpm run build:clean` for clean builds
- Ensure proper file permissions
- Monitor build logs for early error detection

### Additional Debugging

#### Enable Debug Mode
```bash
DEBUG=next:* pnpm run dev
```

#### Check File Permissions
```bash
ls -la .next/
ls -la .turbo/
```

#### Verify Dependencies
```bash
pnpm list --depth=0
```

## Tool Calls and Source Citations

### Overview
RoboChat now includes enhanced visibility for AI tool calls and source citations, making it easy to see:
- **What tools were used** during response generation
- **Which sources** were referenced for information
- **Inline citations** within the response text (when supported)

### Features

#### Tool Invocations
- **Collapsible tool cards** showing tool execution details
- **Real-time status indicators** (Pending, Running, Completed, Error)
- **Input/output display** with JSON formatting
- **Controlled by user preferences** - can be toggled on/off in settings

#### Source Citations
- **Enhanced source cards** with detailed information:
  - Source title and URL
  - Hostname display
  - Index numbering
  - Optional descriptions and excerpts
- **Collapsible sources section** at the bottom of responses
- **Inline citations** (when AI generates content with citation markers like `[1]`, `[2]`)

#### Inline Citations
- **Hover cards** showing detailed source information
- **Carousel navigation** for multiple sources
- **Source previews** with titles, URLs, and descriptions
- **Quote excerpts** when available

### Configuration

#### Enabling/Disabling Tool Invocations
1. Go to **Settings** → **Appearance** → **Interaction Preferences**
2. Toggle **"Tool invocations"** on/off
3. When enabled, tool execution details will be visible in chat responses

#### Source Display
- Sources are automatically displayed when available
- No configuration needed - works out of the box
- Enhanced with better styling and information display

### Technical Implementation

#### Components Used
- **AI SDK Tool Components**: `Tool`, `ToolHeader`, `ToolContent`, `ToolInput`, `ToolOutput`
- **AI SDK Inline Citation Components**: `InlineCitation`, `InlineCitationCard`, etc.
- **Enhanced Source Components**: Improved `Sources`, `Source` with better styling
- **Response Component**: Enhanced with inline citation parsing

#### File Structure
```
components/
├── ai-elements/
│   ├── tool.tsx              # Tool invocation display
│   ├── inline-citation.tsx   # Inline citation components
│   ├── source.tsx            # Enhanced source display
│   └── response.tsx          # Enhanced with citation parsing
├── app/chat/
│   ├── message-assistant.tsx # Main message component
│   ├── smooth-streaming-message.tsx # Streaming with citations
│   └── get-sources.ts        # Source extraction logic
```

#### How It Works
1. **Tool Invocations**: Extracted from message parts and displayed in collapsible cards
2. **Sources**: Extracted from tool results and message parts, deduplicated and enhanced
3. **Inline Citations**: Parsed from response text looking for `[1]`, `[2]` markers
4. **Streaming**: Works with both static and streaming responses

### Troubleshooting

#### Tool Invocations Not Showing
- Check if **"Tool invocations"** is enabled in Settings → Appearance
- Verify that the AI model actually used tools (some responses don't require tools)
- Check browser console for any JavaScript errors

#### Sources Not Appearing
- Ensure the AI response actually includes source information
- Check that the file search or web search tools were used
- Verify that source extraction is working in browser dev tools

#### Inline Citations Not Working
- Inline citations require the AI to generate text with citation markers like `[1]`, `[2]`
- Currently works best with responses that explicitly include numbered citations
- Check that sources are available and properly formatted

## AI SDK Warnings and Debug Messages

### Temperature Warning for Reasoning Models
**Issue**: `AI SDK Warning: The "temperature" setting is not supported by this model - temperature is not supported for reasoning models`

**Solution**: This warning has been resolved by implementing proper temperature handling:
- **Reasoning models** (GPT-5, o1, o3, o4 series) automatically have temperature disabled
- **Regular models** can still use temperature settings
- **Utility function** `getModelTemperature()` handles this automatically

### Disabling AI SDK Warning Logging
To disable AI SDK warning messages in production:

1. **Add to environment variables**:
   ```bash
   AI_SDK_LOG_WARNINGS=false
   ```

2. **Or set globally in your application**:
   ```javascript
   globalThis.AI_SDK_LOG_WARNINGS = false;
   ```

### Debug Messages
Debug messages like `[DEBUG] Checking envApiKey: [SET]` are normal and indicate:
- Environment variables are being loaded correctly
- API keys are properly configured
- Gateway settings are being applied

These can be disabled by setting appropriate log levels in your environment.

## Getting Help

If issues persist after following this guide:

1. Check the [Next.js documentation](https://nextjs.org/docs)
2. Review [Turbopack documentation](https://turbo.build/pack/docs)
3. Check [AI SDK documentation](https://ai-sdk.dev/elements) for component usage
4. Search existing issues in the project repository
5. Create a new issue with:
   - Error messages
   - Steps to reproduce
   - Environment details (Node.js version, OS, etc.)
   - Screenshots of the issue
