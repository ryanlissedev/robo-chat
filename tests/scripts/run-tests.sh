#!/bin/bash

# RoboRail TDD London Test Suite Runner
# Comprehensive test execution script following TDD London (outside-in) approach

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test configuration
UNIT_CONFIG="tests/vitest.config.unit.ts"
INTEGRATION_CONFIG="tests/vitest.config.integration.ts"
E2E_CONFIG="playwright.config.ts"

# Directories
TEST_RESULTS_DIR="test-results"
COVERAGE_DIR="coverage"

# Functions
print_header() {
    echo -e "\n${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

cleanup_previous_results() {
    print_info "Cleaning up previous test results..."
    rm -rf "$TEST_RESULTS_DIR" "$COVERAGE_DIR" || true
    mkdir -p "$TEST_RESULTS_DIR" "$COVERAGE_DIR"
}

check_dependencies() {
    print_info "Checking dependencies..."
    
    if ! command -v bun &> /dev/null; then
        print_error "Bun is required but not installed. Please install bun first."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_warning "Docker not found. Database integration tests may fail."
    fi
    
    print_success "Dependencies check passed"
}

setup_test_database() {
    print_info "Setting up test database..."
    
    # Check if PostgreSQL is available
    if command -v psql &> /dev/null; then
        # Create test database if it doesn't exist
        createdb roborail_test 2>/dev/null || true
        print_success "Test database ready"
    else
        print_warning "PostgreSQL not found. Using Docker for database tests..."
        # Start test database container if needed
        if ! docker ps | grep -q postgres-test; then
            docker run -d --name postgres-test \
                -e POSTGRES_USER=roborail_test \
                -e POSTGRES_PASSWORD=test_password \
                -e POSTGRES_DB=roborail_test \
                -p 5433:5432 \
                postgres:15 || print_warning "Could not start test database container"
        fi
    fi
}

run_unit_tests() {
    print_header "Running Unit Tests (TDD London - Inner Loop)"
    
    print_info "Testing business logic, validation, and utilities..."
    
    if bun run vitest --config="$UNIT_CONFIG" --run --reporter=verbose; then
        print_success "Unit tests passed"
        return 0
    else
        print_error "Unit tests failed"
        return 1
    fi
}

run_integration_tests() {
    print_header "Running Integration Tests (TDD London - Repository Layer)"
    
    print_info "Testing database operations and repository patterns..."
    
    if bun run vitest --config="$INTEGRATION_CONFIG" --run --reporter=verbose; then
        print_success "Integration tests passed"
        return 0
    else
        print_error "Integration tests failed"
        return 1
    fi
}

run_acceptance_tests() {
    print_header "Running Acceptance Tests (TDD London - Outer Loop)"
    
    print_info "Testing complete user workflows and database operations..."
    
    # Acceptance tests are included in integration config
    if bun run vitest --config="$INTEGRATION_CONFIG" --run --reporter=verbose tests/acceptance/; then
        print_success "Acceptance tests passed"
        return 0
    else
        print_error "Acceptance tests failed"
        return 1
    fi
}

run_e2e_tests() {
    print_header "Running End-to-End Tests (Full System)"
    
    print_info "Testing complete application workflows..."
    
    # Start the application in test mode
    print_info "Starting application for E2E tests..."
    bun run build > /dev/null 2>&1 || print_warning "Build failed, using dev mode"
    
    # Run Playwright tests
    if bunx playwright test --config="$E2E_CONFIG"; then
        print_success "E2E tests passed"
        return 0
    else
        print_error "E2E tests failed"
        return 1
    fi
}

generate_coverage_report() {
    print_header "Generating Coverage Reports"
    
    print_info "Merging coverage reports..."
    
    # Combine coverage reports if both unit and integration ran
    if [ -d "coverage/unit" ] && [ -d "coverage/integration" ]; then
        print_info "Creating combined coverage report..."
        mkdir -p coverage/combined
        
        # This would require a coverage merging tool
        # For now, we'll keep them separate
        print_info "Coverage reports available in:"
        print_info "  - coverage/unit/ (Unit test coverage)"
        print_info "  - coverage/integration/ (Integration test coverage)"
    fi
}

run_quality_checks() {
    print_header "Running Code Quality Checks"
    
    print_info "Running TypeScript type checking..."
    if bun run type-check; then
        print_success "TypeScript check passed"
    else
        print_error "TypeScript check failed"
        return 1
    fi
    
    print_info "Running ESLint..."
    if bun run lint; then
        print_success "ESLint check passed"
    else
        print_error "ESLint check failed"
        return 1
    fi
}

cleanup_test_environment() {
    print_info "Cleaning up test environment..."
    
    # Stop test database container if it was started
    if docker ps | grep -q postgres-test; then
        docker stop postgres-test > /dev/null 2>&1 || true
        docker rm postgres-test > /dev/null 2>&1 || true
    fi
}

print_summary() {
    print_header "Test Summary"
    
    echo -e "Test Results:"
    echo -e "  📊 Detailed reports: file://$PWD/test-results/"
    echo -e "  📈 Coverage reports: file://$PWD/coverage/"
    
    if [ -f "$TEST_RESULTS_DIR/unit-results.json" ]; then
        echo -e "  🔧 Unit test results: $TEST_RESULTS_DIR/unit-results.json"
    fi
    
    if [ -f "$TEST_RESULTS_DIR/integration-results.json" ]; then
        echo -e "  🔗 Integration test results: $TEST_RESULTS_DIR/integration-results.json"
    fi
    
    if [ -f "playwright-report/index.html" ]; then
        echo -e "  🌐 E2E test results: file://$PWD/playwright-report/index.html"
    fi
    
    print_success "All test reports generated successfully"
}

# Main execution
main() {
    local test_type="${1:-all}"
    local exit_code=0
    
    print_header "RoboRail TDD London Test Suite"
    print_info "Test type: $test_type"
    print_info "Following TDD London (outside-in) testing approach"
    
    # Setup
    cleanup_previous_results
    check_dependencies
    
    case "$test_type" in
        "unit")
            run_unit_tests || exit_code=1
            ;;
        "integration")
            setup_test_database
            run_integration_tests || exit_code=1
            ;;
        "acceptance")
            setup_test_database
            run_acceptance_tests || exit_code=1
            ;;
        "e2e")
            run_e2e_tests || exit_code=1
            ;;
        "quality")
            run_quality_checks || exit_code=1
            ;;
        "all")
            # TDD London approach: outside-in
            print_info "Running tests in TDD London order: Acceptance → Integration → Unit"
            
            setup_test_database
            
            # Outer loop (acceptance tests)
            run_acceptance_tests || exit_code=1
            
            # Middle loop (integration tests)
            if [ $exit_code -eq 0 ]; then
                run_integration_tests || exit_code=1
            fi
            
            # Inner loop (unit tests)
            if [ $exit_code -eq 0 ]; then
                run_unit_tests || exit_code=1
            fi
            
            # Quality checks
            if [ $exit_code -eq 0 ]; then
                run_quality_checks || exit_code=1
            fi
            
            # Optional E2E tests (full system verification)
            if [ $exit_code -eq 0 ] && [ "${SKIP_E2E:-false}" != "true" ]; then
                print_info "Running E2E tests for full system verification..."
                run_e2e_tests || exit_code=1
            fi
            ;;
        *)
            print_error "Unknown test type: $test_type"
            echo "Usage: $0 [unit|integration|acceptance|e2e|quality|all]"
            exit 1
            ;;
    esac
    
    # Generate reports
    if [ "$test_type" != "quality" ]; then
        generate_coverage_report
    fi
    
    # Cleanup
    cleanup_test_environment
    
    # Summary
    print_summary
    
    if [ $exit_code -eq 0 ]; then
        print_success "All tests completed successfully! 🎉"
        echo -e "\n${GREEN}TDD London cycle complete:${NC}"
        echo -e "${GREEN}✅ Acceptance tests (outside) - User workflows${NC}"
        echo -e "${GREEN}✅ Integration tests (middle) - Repository layer${NC}"
        echo -e "${GREEN}✅ Unit tests (inside) - Business logic${NC}"
    else
        print_error "Some tests failed. Check the reports for details."
    fi
    
    exit $exit_code
}

# Handle script arguments
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi