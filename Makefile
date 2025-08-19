# RoboRail Development Makefile
# Common tasks for AI agents and developers

.DEFAULT_GOAL := help
.PHONY: help setup dev build start test test-all test-unit test-e2e test-coverage lint lint-fix type-check clean install kill-ports kill-port check-ports

# Colors
BLUE := \033[1;34m
GREEN := \033[1;32m
YELLOW := \033[1;33m
RED := \033[1;31m
NC := \033[0m

help: ## Show this help message
	@echo "$(BLUE)RoboRail Development Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)For first-time setup, run: make setup$(NC)"

setup: ## Run initial project setup
	@echo "$(BLUE)Setting up RoboRail development environment...$(NC)"
	@chmod +x SETUP.sh
	@./SETUP.sh

install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	@npm ci

dev: kill-ports ## Start development server
	@echo "$(BLUE)Starting development server...$(NC)"
	@npm run dev

kill-ports: ## Kill processes on common development ports
	@echo "$(YELLOW)Killing processes on development ports...$(NC)"
	@-lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:3001 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:5173 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:8080 | xargs kill -9 2>/dev/null || true
	@-lsof -ti:4200 | xargs kill -9 2>/dev/null || true
	@echo "$(GREEN)Ports cleared$(NC)"

kill-port: ## Kill process on specific port (usage: make kill-port PORT=3000)
	@if [ -z "$(PORT)" ]; then \
		echo "$(RED)Error: PORT not specified. Usage: make kill-port PORT=3000$(NC)"; \
		exit 1; \
	fi
	@echo "$(YELLOW)Killing process on port $(PORT)...$(NC)"
	@-lsof -ti:$(PORT) | xargs kill -9 2>/dev/null || true
	@echo "$(GREEN)Port $(PORT) cleared$(NC)"

check-ports: ## Show processes running on common development ports
	@echo "$(BLUE)Checking processes on development ports...$(NC)"
	@echo "$(YELLOW)Port 3000 (Next.js):$(NC)"
	@-lsof -i:3000 2>/dev/null || echo "  No process found"
	@echo "$(YELLOW)Port 3001 (Alternative):$(NC)"
	@-lsof -i:3001 2>/dev/null || echo "  No process found"
	@echo "$(YELLOW)Port 5173 (Vite):$(NC)"
	@-lsof -i:5173 2>/dev/null || echo "  No process found"
	@echo "$(YELLOW)Port 8080 (General):$(NC)"
	@-lsof -i:8080 2>/dev/null || echo "  No process found"

build: kill-ports ## Build for production
	@echo "$(BLUE)Building for production...$(NC)"
	@bun run build

start: kill-ports ## Start production server
	@echo "$(BLUE)Starting production server...$(NC)"
	@bun run start

test: ## Run tests
	@echo "$(BLUE)Running tests...$(NC)"
	@bun run test

test-all: ## Run comprehensive test suite with 100% coverage
	@echo "$(BLUE)Running comprehensive test suite...$(NC)"
	@./scripts/test-all.sh

test-unit: ## Run unit tests only
	@echo "$(BLUE)Running unit tests...$(NC)"
	@bun run test

test-e2e: kill-ports ## Run E2E tests only
	@echo "$(BLUE)Running E2E tests...$(NC)"
	@bun run test:e2e

test-coverage: ## Run tests with coverage report
	@echo "$(BLUE)Running tests with coverage...$(NC)"
	@bun run test:coverage

lint: ## Run linting
	@echo "$(BLUE)Running linter...$(NC)"
	@bun run lint

lint-fix: ## Fix linting issues
	@echo "$(BLUE)Fixing linting issues...$(NC)"
	@bun run lint --fix

type-check: ## Run TypeScript type checking
	@echo "$(BLUE)Running TypeScript checks...$(NC)"
	@npm run type-check

validate: ## Run all validation checks
	@echo "$(BLUE)Running validation checks...$(NC)"
	@make lint
	@make type-check
	@make build
	@echo "$(GREEN)✅ All validation checks passed!$(NC)"

clean: ## Clean build artifacts and dependencies
	@echo "$(BLUE)Cleaning build artifacts...$(NC)"
	@rm -rf .next
	@rm -rf node_modules
	@rm -rf .agent-workspace
	@rm -rf .agent-cache
	@echo "$(GREEN)✅ Cleaned successfully!$(NC)"

reset: clean install ## Reset project (clean + install)
	@echo "$(GREEN)✅ Project reset complete!$(NC)"

agent-setup: ## Setup for AI agent development
	@echo "$(BLUE)Setting up AI agent development environment...$(NC)"
	@mkdir -p .agent-workspace
	@mkdir -p .agent-logs
	@echo "$(GREEN)✅ Agent environment ready!$(NC)"

status: ## Show project status
	@echo "$(BLUE)RoboRail Project Status$(NC)"
	@echo "Node.js: $$(node --version)"
	@echo "npm: $$(npm --version)"
	@echo "TypeScript: $$(npx tsc --version)"
	@echo "Next.js: $$(npm list next --depth=0 2>/dev/null | grep next || echo 'Not installed')"
	@echo ""
	@if [ -f ".env.local" ]; then echo "$(GREEN)✅ Environment configured$(NC)"; else echo "$(YELLOW)⚠️  .env.local missing$(NC)"; fi
	@if [ -d "node_modules" ]; then echo "$(GREEN)✅ Dependencies installed$(NC)"; else echo "$(RED)❌ Dependencies missing$(NC)"; fi

quick-start: ## Quick start for agents (setup + dev)
	@make setup
	@make dev