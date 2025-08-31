# OpenAI Native File Search Configuration Guide

## Overview

This application now supports OpenAI's native file search capabilities through the responses API for GPT-5 models. File search allows the AI to search through uploaded documents in vector stores to provide more accurate and contextual responses.

## Architecture

### Implementation Details

1. **Provider Level Configuration** (`/lib/openproviders/index.ts`)
   - File search is configured at the provider level for GPT-5 models
   - Uses the `openai.responses()` API with tool configuration
   - Automatically handles vector store IDs and search options

2. **Chat Route Integration** (`/app/api/chat/route.ts`)
   - Extracts vector store IDs from environment variables
   - Passes configuration through provider settings
   - Supports both streaming and fallback retrieval paths

3. **Tool Configuration**
   - Tool name: `file_search` (not `fileSearch`)
   - Configured through the responses API for GPT-5 models
   - Can be forced with `toolChoice: { type: 'tool', toolName: 'file_search' }`

## Setup Instructions

### 1. Set Up OpenAI API Key

Add your OpenAI API key to the `.env` file:

```env
OPENAI_API_KEY=sk-...
```

### 2. Create and Configure Vector Stores

#### Option A: Automatic Setup (Recommended)

Run the setup script to automatically configure vector stores:

```bash
npm run setup:vector-store:setup
```

This will:
- List existing vector stores
- Create a new one if none exist
- Upload test content
- Update your `.env` file with the vector store IDs

#### Option B: Manual Setup

1. **List existing vector stores:**
   ```bash
   npm run setup:vector-store:list
   ```

2. **Create a new vector store:**
   ```bash
   npm run setup:vector-store:create "My Vector Store"
   ```

3. **Add vector store IDs to `.env`:**
   ```env
   OPENAI_VECTOR_STORE_IDS=vs_abc123,vs_def456
   ```

### 3. Upload Documents to Vector Store

#### Using the Test Upload Script

Upload test content to a vector store:

```bash
npm run setup:vector-store:test-upload vs_abc123
```

#### Using OpenAI Dashboard

1. Go to [OpenAI Storage](https://platform.openai.com/storage)
2. Select your vector store
3. Upload documents (PDF, TXT, MD, etc.)
4. Wait for processing to complete

## Testing File Search

### Run the Test Script

Test the native file search implementation:

```bash
npm run test:file-search
```

This script will:
- Connect to your vector store
- Send a test query with file search enabled
- Verify that the file search tool is invoked
- Display the response

### Manual Testing

1. Start the development server:
   ```bash
   npm run dev
   ```

2. In the chat interface, select a GPT-5 model

3. Enable file search in your request:
   ```javascript
   {
     enableSearch: true,
     messages: [
       {
         role: "user",
         content: "Search for information about TypeScript best practices"
       }
     ]
   }
   ```

## Configuration Options

### Environment Variables

```env
# Required
OPENAI_API_KEY=sk-...

# Vector Store IDs (comma-separated)
OPENAI_VECTOR_STORE_IDS=vs_abc123,vs_def456

# Optional: Vercel AI Gateway (for production)
VERCEL_AI_GATEWAY_URL=https://ai-gateway.vercel.sh/v1
VERCEL_AI_GATEWAY_API_KEY=...
```

### Provider Settings

When using the `openproviders` function with GPT-5 models:

```typescript
const model = openproviders('gpt-5', {
  enableSearch: true,
  vectorStoreIds: ['vs_abc123', 'vs_def456'],
  fileSearchOptions: {
    maxNumResults: 10,
    ranker: 'default_2024_08_21'
  }
}, apiKey);
```

### File Search Options

- `maxNumResults`: Maximum number of search results (default: 10)
- `ranker`: Ranking algorithm (default: 'default_2024_08_21')

## Troubleshooting

### No Search Results

1. **Check vector store has files:**
   ```bash
   npm run setup:vector-store:list
   ```
   Verify "Files" count is > 0

2. **Upload test content:**
   ```bash
   npm run setup:vector-store:test-upload vs_your_store_id
   ```

3. **Verify environment variable:**
   ```bash
   echo $OPENAI_VECTOR_STORE_IDS
   ```

### File Search Not Invoked

1. **Ensure using GPT-5 model** - File search via responses API is for GPT-5
2. **Check `enableSearch: true`** is set in provider settings
3. **Verify vector store IDs** are correctly configured

### API Errors

1. **"vector_store not found"** - Invalid vector store ID
2. **"API key invalid"** - Check OPENAI_API_KEY
3. **"GPT-5 access denied"** - Model not available for your account

## Available Commands

```bash
# Setup and configuration
npm run setup:vector-store          # Show help
npm run setup:vector-store:list     # List all vector stores
npm run setup:vector-store:create   # Create new vector store
npm run setup:vector-store:setup    # Auto-configure everything

# Testing
npm run test:file-search            # Test native file search
npm run setup:vector-store:test-upload # Upload test content

# Development
npm run dev                          # Start development server
```

## Migration from Custom File Search

If you were using the custom file search implementation in `/lib/tools/file-search.ts`:

1. The native implementation is now automatically used for GPT-5 models
2. Vector stores created via OpenAI API are compatible
3. No code changes needed - just configure vector store IDs
4. Custom implementation remains available as fallback for non-GPT-5 models

## Security Considerations

- Never commit API keys to version control
- Use environment variables for all sensitive configuration
- Vector store IDs are safe to commit if needed
- Consider using different vector stores for dev/staging/production

## Support

For issues or questions:
1. Check the test output: `npm run test:file-search`
2. Verify vector stores: `npm run setup:vector-store:list`
3. Review OpenAI dashboard: https://platform.openai.com/storage
4. Check API usage: https://platform.openai.com/usage