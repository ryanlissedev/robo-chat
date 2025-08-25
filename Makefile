# Makefile for robo-chat project
# Using bun for package management and npm for test compatibility

.PHONY: help install dev build test test-all lint typecheck clean kill-ports start

# Default target
help:
	@echo "Available commands:"
	@echo "  make install    - Install dependencies with bun"
	@echo "  make dev        - Start development server (kills ports first)"
	@echo "  make build      - Build production bundle"
	@echo "  make test       - Run all tests"
	@echo "  make test-all   - Run all tests with coverage"
	@echo "  make lint       - Run linter"
	@echo "  make typecheck  - Run TypeScript type checking"
	@echo "  make clean      - Clean build artifacts and node_modules"
	@echo "  make kill-ports - Kill processes on ports 3000 and 3001"
	@echo "  make start      - Start production server"

# Kill ports before starting services
kill-ports:
	@echo "Killing processes on ports 3000 and 3001..."
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@echo "Ports cleared"

# Install dependencies
install:
	@echo "Installing dependencies with bun..."
	@bun install

# Development server
dev: kill-ports
	@echo "Starting development server..."
	@bun run dev

# Build production
build:
	@echo "Building production bundle..."
	@bun run build

# Run tests (using npm for compatibility with vitest)
test:
	@echo "Running tests..."
	@npm test

# Run all tests with coverage
test-all:
	@echo "Running all tests with coverage..."
	@npm test -- --coverage --run

# Lint code
lint:
	@echo "Running linter..."
	@bun run lint

# Type checking
typecheck:
	@echo "Running TypeScript type checking..."
	@bun run typecheck

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
	@echo "Starting production server..."
	@bun run start

# Fix common issues
fix: kill-ports
	@echo "Fixing common issues..."
	@bun run lint:fix
	@bun run format
	@echo "Fixes applied"

# Run test suite and fix issues iteratively
test-fix:
	@echo "Running tests and fixing issues..."
	@npm test 2>&1 | tee test-output.log
	@echo "Test results saved to test-output.log"