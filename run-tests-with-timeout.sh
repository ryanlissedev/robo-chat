#!/bin/bash

# Test runner with timeout protection
set -e

TIMEOUT_SECONDS=30
TEST_COMMAND="$1"
TEST_NAME="$2"

echo "🧪 Running: $TEST_NAME"
echo "⏱️  Timeout: ${TIMEOUT_SECONDS}s"
echo "🔧 Command: $TEST_COMMAND"

# Run test in background
$TEST_COMMAND &
TEST_PID=$!

# Wait for completion or timeout
{
    sleep $TIMEOUT_SECONDS
    if kill -0 $TEST_PID 2>/dev/null; then
        echo "❌ Test timed out after ${TIMEOUT_SECONDS}s, killing process..."
        kill -TERM $TEST_PID 2>/dev/null || true
        sleep 2
        kill -KILL $TEST_PID 2>/dev/null || true
        echo "❌ $TEST_NAME: TIMEOUT"
        exit 124
    fi
} &
TIMEOUT_PID=$!

# Wait for test to complete
if wait $TEST_PID; then
    kill $TIMEOUT_PID 2>/dev/null || true
    echo "✅ $TEST_NAME: PASSED"
    exit 0
else
    TEST_EXIT_CODE=$?
    kill $TIMEOUT_PID 2>/dev/null || true
    echo "❌ $TEST_NAME: FAILED (exit code: $TEST_EXIT_CODE)"
    exit $TEST_EXIT_CODE
fi