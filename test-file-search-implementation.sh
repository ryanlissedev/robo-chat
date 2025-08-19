#!/bin/bash

# Final Test Suite for File Search Implementation
# Verifies all components work together

set -e

echo "🚀 Testing File Search Implementation"
echo "===================================="

# Test 1: Core functionality tests
echo "📋 1. Running core functionality tests..."
if ./run-tests-with-timeout.sh "bun test tests/unit/simple.test.ts tests/unit/chat-api.test.ts tests/unit/vector-store-manager.test.ts tests/unit/retrieval/enhanced-retrieval.test.ts" "Core Tests"; then
    echo "✅ Core functionality tests passed"
else
    echo "❌ Core functionality tests failed"
    exit 1
fi

# Test 2: Integration tests
echo "📋 2. Running integration tests..."
if ./run-tests-with-timeout.sh "bun test tests/integration/chat-file-search.integration.test.ts" "Integration Tests"; then
    echo "✅ Integration tests passed"
else
    echo "❌ Integration tests failed"
    exit 1
fi

# Test 3: Check TypeScript compilation
echo "📋 3. Checking TypeScript compilation..."
if bun run type-check; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Test 4: Verify file structure
echo "📋 4. Verifying file structure..."
required_files=(
    "lib/vector-store/manager.ts"
    "app/api/chat/route.ts"
    "lib/retrieval/query-rewriting.ts"
    "tests/unit/vector-store-manager.test.ts"
    "tests/unit/chat-api.test.ts"
    "tests/unit/retrieval/enhanced-retrieval.test.ts"
    "tests/integration/chat-file-search.integration.test.ts"
)

for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        exit 1
    fi
done

# Test 5: Check for critical functions
echo "📋 5. Checking for critical functions..."
if grep -q "getOrCreateDefaultVectorStore" lib/vector-store/manager.ts; then
    echo "✅ Vector store management function exists"
else
    echo "❌ Vector store management function missing"
    exit 1
fi

if grep -q "enhancedRetrieval" lib/retrieval/query-rewriting.ts; then
    echo "✅ Enhanced retrieval function exists"
else
    echo "❌ Enhanced retrieval function missing"
    exit 1
fi

if grep -q "experimental_toolResources" app/api/chat/route.ts; then
    echo "✅ File search integration exists in chat API"
else
    echo "❌ File search integration missing from chat API"
    exit 1
fi

echo ""
echo "🎉 All File Search Implementation Tests Passed!"
echo "=============================================="
echo ""
echo "✅ Core functionality working"
echo "✅ Vector store management implemented"
echo "✅ OpenAI Assistants API integration working"
echo "✅ Chat API file search enabled"
echo "✅ Error handling and fallbacks in place"
echo "✅ Integration tests passing"
echo "✅ TypeScript compilation successful"
echo ""
echo "🚀 File search functionality is ready for use!"