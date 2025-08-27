#!/bin/bash
# Enhanced Test Runner Script with Proper Timeout Handling
# Usage: ./run-tests.sh [test-type] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
DEFAULT_TIMEOUT=60
COVERAGE=${COVERAGE:-0}
CI=${CI:-0}

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to handle timeouts
run_with_timeout() {
    local timeout=$1
    local description=$2
    shift 2
    
    log_info "Running: $description (timeout: ${timeout}s)"
    
    if command -v timeout >/dev/null 2>&1; then
        # GNU timeout (Linux)
        timeout "${timeout}s" "$@"
    elif command -v gtimeout >/dev/null 2>&1; then
        # GNU timeout via Homebrew (macOS)
        gtimeout "${timeout}s" "$@"
    else
        # Fallback: use background process with kill
        "$@" &
        local pid=$!
        local count=0
        
        while [ $count -lt $timeout ]; do
            if ! kill -0 $pid 2>/dev/null; then
                wait $pid
                return $?
            fi
            sleep 1
            ((count++))
        done
        
        log_warning "Process timed out after ${timeout}s, terminating..."
        kill -TERM $pid 2>/dev/null || true
        sleep 2
        kill -KILL $pid 2>/dev/null || true
        return 124 # timeout exit code
    fi
}

# Function to check if vitest is available
check_vitest() {
    if ! command -v vitest >/dev/null 2>&1; then
        log_error "Vitest not found. Please install dependencies: bun install"
        exit 1
    fi
}

# Function to run unit tests
run_unit_tests() {
    local timeout=${1:-30}
    log_info "Running unit tests with ${timeout}s timeout"
    
    if [ "$COVERAGE" = "1" ]; then
        run_with_timeout $timeout "Unit tests with coverage" \
            vitest run --config tests/vitest.config.unit.ts --coverage
    else
        run_with_timeout $timeout "Unit tests" \
            vitest run --config tests/vitest.config.unit.ts
    fi
}

# Function to run integration tests
run_integration_tests() {
    local timeout=${1:-60}
    log_info "Running integration tests with ${timeout}s timeout"
    
    if [ "$COVERAGE" = "1" ]; then
        run_with_timeout $timeout "Integration tests with coverage" \
            vitest run --config tests/vitest.config.integration.ts --coverage
    else
        run_with_timeout $timeout "Integration tests" \
            vitest run --config tests/vitest.config.integration.ts
    fi
}

# Function to run all vitest tests
run_all_vitest() {
    local timeout=${1:-90}
    log_info "Running all vitest tests with ${timeout}s timeout"
    
    if [ "$COVERAGE" = "1" ]; then
        run_with_timeout $timeout "All vitest tests with coverage" \
            vitest run --coverage
    else
        run_with_timeout $timeout "All vitest tests" \
            vitest run
    fi
}

# Function to run minimal/fast tests
run_minimal_tests() {
    local timeout=${1:-20}
    log_info "Running minimal test suite with ${timeout}s timeout"
    
    run_with_timeout $timeout "Minimal tests" \
        vitest run --config vitest.config.minimal.ts
}

# Function to run e2e tests
run_e2e_tests() {
    local timeout=${1:-300}
    log_info "Running e2e tests with ${timeout}s timeout"
    
    run_with_timeout $timeout "E2E tests" \
        playwright test
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [test-type] [options]"
    echo ""
    echo "Test Types:"
    echo "  unit           Run unit tests (timeout: 30s)"
    echo "  integration    Run integration tests (timeout: 60s)"
    echo "  minimal        Run minimal/fast test suite (timeout: 20s)"
    echo "  e2e            Run e2e tests (timeout: 300s)"
    echo "  all            Run all vitest tests (timeout: 90s)"
    echo ""
    echo "Options:"
    echo "  --timeout=N    Set custom timeout in seconds"
    echo "  --coverage     Run with coverage reporting"
    echo "  --watch        Run in watch mode (no timeout)"
    echo "  --help         Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  COVERAGE=1     Enable coverage reporting"
    echo "  CI=1           Enable CI mode optimizations"
    echo ""
    echo "Examples:"
    echo "  $0 unit                    # Run unit tests"
    echo "  $0 integration --coverage  # Run integration tests with coverage"
    echo "  $0 all --timeout=120       # Run all tests with 2min timeout"
    echo "  COVERAGE=1 $0 unit         # Run unit tests with coverage"
}

# Parse command line arguments
WATCH_MODE=0
CUSTOM_TIMEOUT=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --timeout=*)
            CUSTOM_TIMEOUT="${1#*=}"
            shift
            ;;
        --coverage)
            COVERAGE=1
            shift
            ;;
        --watch)
            WATCH_MODE=1
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        -*)
            log_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
        *)
            TEST_TYPE=$1
            shift
            ;;
    esac
done

# Check prerequisites
check_vitest

# Handle watch mode (no timeouts)
if [ "$WATCH_MODE" = "1" ]; then
    log_info "Running in watch mode (no timeout)"
    case ${TEST_TYPE:-all} in
        unit)
            vitest --config tests/vitest.config.unit.ts --watch
            ;;
        integration)
            vitest --config tests/vitest.config.integration.ts --watch
            ;;
        minimal)
            vitest --config vitest.config.minimal.ts --watch
            ;;
        all|*)
            vitest --watch
            ;;
    esac
    exit 0
fi

# Main execution
case ${TEST_TYPE:-all} in
    unit)
        timeout=${CUSTOM_TIMEOUT:-30}
        run_unit_tests $timeout
        ;;
    integration)
        timeout=${CUSTOM_TIMEOUT:-60}
        run_integration_tests $timeout
        ;;
    minimal)
        timeout=${CUSTOM_TIMEOUT:-20}
        run_minimal_tests $timeout
        ;;
    e2e)
        timeout=${CUSTOM_TIMEOUT:-300}
        run_e2e_tests $timeout
        ;;
    all)
        timeout=${CUSTOM_TIMEOUT:-90}
        run_all_vitest $timeout
        ;;
    *)
        log_error "Unknown test type: ${TEST_TYPE}"
        show_usage
        exit 1
        ;;
esac

# Check exit status
if [ $? -eq 0 ]; then
    log_success "Tests completed successfully!"
else
    exit_code=$?
    if [ $exit_code -eq 124 ]; then
        log_error "Tests timed out!"
    else
        log_error "Tests failed with exit code: $exit_code"
    fi
    exit $exit_code
fi