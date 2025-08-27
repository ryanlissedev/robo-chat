#!/bin/bash
# RoboChat AI Assistant - Setup Script
# Automated environment setup for agents and developers

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 RoboChat AI Assistant - Environment Setup${NC}"
echo "================================================"

# Check Node.js version
echo -e "\n${YELLOW}Checking prerequisites...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18+${NC}"
    echo "Visit: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo -e "${RED}❌ Node.js 18+ required. Current version: $(node -v)${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Node.js $(node -v) detected${NC}"

# Check package manager (prefer bun, fallback to npm)
if command -v bun &> /dev/null; then
    PKG_MANAGER="bun"
    echo -e "${GREEN}✅ Using Bun package manager${NC}"
else
    PKG_MANAGER="npm"
    echo -e "${GREEN}✅ Using npm package manager${NC}"
fi

# Install dependencies
echo -e "\n${YELLOW}Installing dependencies...${NC}"
if [ "$PKG_MANAGER" = "bun" ]; then
    bun install
else
    npm install
fi
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Setup environment variables
echo -e "\n${YELLOW}Setting up environment...${NC}"
if [ ! -f .env.local ]; then
    if [ -f .env.example ]; then
        cp .env.example .env.local
        echo -e "${GREEN}✅ Created .env.local from .env.example${NC}"
        echo -e "${YELLOW}⚠️  Please update .env.local with your API keys:${NC}"
        echo "   - Supabase credentials (required)"
        echo "   - AI model API keys (at least one required)"
        echo "   - CSRF secret for security"
    else
        echo -e "${RED}❌ .env.example not found${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ .env.local already exists${NC}"
fi

# Install Playwright browsers if needed
if [ "$PKG_MANAGER" = "bun" ]; then
    if ! bunx playwright --version &> /dev/null; then
        echo -e "\n${YELLOW}Installing Playwright browsers for E2E testing...${NC}"
        bunx playwright install
        echo -e "${GREEN}✅ Playwright browsers installed${NC}"
    fi
else
    if ! npx playwright --version &> /dev/null; then
        echo -e "\n${YELLOW}Installing Playwright browsers for E2E testing...${NC}"
        npx playwright install
        echo -e "${GREEN}✅ Playwright browsers installed${NC}"
    fi
fi

# Run type check
echo -e "\n${YELLOW}Running type check...${NC}"
if npm run type-check; then
    echo -e "${GREEN}✅ TypeScript validation passed${NC}"
else
    echo -e "${YELLOW}⚠️  TypeScript issues detected (non-blocking)${NC}"
fi

# Run linting
echo -e "\n${YELLOW}Checking code quality...${NC}"
if npm run lint; then
    echo -e "${GREEN}✅ Code quality check passed${NC}"
else
    echo -e "${YELLOW}⚠️  Linting issues detected. Run 'npm run lint:fix' to auto-fix${NC}"
fi

# Setup complete
echo -e "\n${GREEN}🎉 Setup complete!${NC}"
echo "================================================"
echo -e "\n${YELLOW}Next steps:${NC}"
echo "1. Update .env.local with your API keys"
echo "2. Run 'npm run dev' to start development server"
echo "3. Visit http://localhost:3000"
echo ""
echo -e "${YELLOW}Available commands:${NC}"
echo "  npm run dev        - Start development server"
echo "  npm run build      - Build for production"
echo "  npm test           - Run tests"
echo "  npm run lint:fix   - Auto-fix code issues"
echo ""
echo -e "${GREEN}Happy coding! 🚀${NC}"