# RoboChat AI Assistant - Makefile
# Optimized for both bun and npm package managers

.PHONY: help setup install dev build test test-all lint typecheck clean kill-ports start quick-start ci-test pre-commit

# Detect available package manager (prefer bun, then pnpm, then npm)
PKG ?=
ifeq (,$(shell command -v bun 2>/dev/null))
  ifeq (,$(shell command -v pnpm 2>/dev/null))
    PKG := npm
  else
    PKG := pnpm
  endif
else
  PKG := bun
endif

# Default target - show help
help:
	@echo "RoboChat AI Assistant - Available Commands"
	@echo "=========================================="
	@echo "  make setup      - Run initial setup script"
	@echo "  make install    - Install dependencies"
	@echo "  make dev        - Start development server"
	@echo "  make build      - Build production bundle"
	@echo "  make test       - Run all tests"
	@echo "  make test-all   - Run tests with coverage"
	@echo "  make lint       - Check code quality"
	@echo "  make typecheck  - Run TypeScript validation"
	@echo "  make clean      - Clean all artifacts"
	@echo "  make quick-start- Setup and start dev server"
	@echo "  make ci-test    - Run CI test suite"
	@echo "  make pre-commit - Pre-commit checks"

# Kill ports before starting services
kill-ports:
	@echo "Killing processes on ports 3000 and 3001..."
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@echo "Ports cleared"

# Install dependencies
install:
	@echo "Installing dependencies with $(PKG)..."
	@$(PKG) install

# Development server
dev: kill-ports
	@echo "Starting development server with $(PKG)..."
	@$(PKG) run dev

# Build production
build:
	@echo "Building production bundle with $(PKG)..."
	@$(PKG) run build

# Run tests (using npm for compatibility with vitest)
test:
	@echo "Running tests..."
	@npm run test:run

# Run all tests with coverage
test-all:
	@echo "Running all tests with coverage..."
	@npm run test:coverage:ci

# Lint code
lint:
	@echo "Running linter with $(PKG)..."
	@$(PKG) run lint

# Type checking
typecheck:
	@echo "Running TypeScript type checking with $(PKG)..."
	@$(PKG) run type-check

# Clean build artifacts
clean:
	@echo "Cleaning build artifacts..."
	@rm -rf .next
	@rm -rf node_modules
	@rm -rf coverage
	@rm -rf dist
	@rm -rf .turbo
	@echo "Clean complete"

# Start production server
start: build kill-ports
	@echo "Starting production server with $(PKG)..."
	@$(PKG) run start

# Fix common issues
fix: kill-ports
	@echo "Fixing common issues with $(PKG)..."
	@$(PKG) run lint:fix
	@$(PKG) run format
	@echo "Fixes applied"

# Run test suite and fix issues iteratively
test-fix:
	@echo "Running tests and fixing issues..."
	@npm test 2>&1 | tee test-output.log
	@echo "Test results saved to test-output.log"

# Setup environment (new)
setup:
	@echo "Running setup script..."
	@./SETUP.sh

# Quick start - setup and run dev
quick-start: setup dev

# CI test suite
ci-test: lint typecheck test
	@echo "✅ CI tests passed!"

# Pre-commit checks
pre-commit: lint fix typecheck
	@echo "✅ Ready to commit!"