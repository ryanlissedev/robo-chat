#!/bin/bash
set -euo pipefail

# RoboRail Development Environment Setup
# This script sets up the development environment for RoboRail
# Run with: ./SETUP.sh

echo "🤖 Setting up RoboRail development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_info() {
    echo -e "${GREEN}ℹ️  $1${NC}"
}

log_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_command() {
    if command -v "$1" &> /dev/null; then
        log_info "$1 is available"
        return 0
    else
        log_error "$1 is not installed"
        return 1
    fi
}

# Check prerequisites
log_info "Checking prerequisites..."

# Check Node.js
if ! check_command "node"; then
    log_error "Node.js is required. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_NODE="18.0.0"
if ! node -p "require('semver').gte('$NODE_VERSION', '$REQUIRED_NODE')" 2>/dev/null || ! command -v node &> /dev/null; then
    # Fallback version check
    MAJOR_VERSION=$(echo $NODE_VERSION | cut -d. -f1)
    if [ "$MAJOR_VERSION" -lt 18 ]; then
        log_error "Node.js 18+ is required. Current version: $NODE_VERSION"
        exit 1
    fi
fi
log_info "Node.js version: $NODE_VERSION ✓"

# Check npm
if ! check_command "npm"; then
    log_error "npm is required and should come with Node.js"
    exit 1
fi

# Check git
if ! check_command "git"; then
    log_warn "Git is recommended for version control"
fi

# Install dependencies
log_info "Installing dependencies..."
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

# Environment setup
log_info "Setting up environment configuration..."
if [ ! -f ".env.local" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env.local
        log_info "Created .env.local from .env.example"
        log_warn "Please edit .env.local with your API keys and configuration"
    else
        log_warn ".env.example not found, creating minimal .env.local"
        cat > .env.local << EOF
# RoboRail Environment Configuration
# Please configure these values for your development environment

# Core Required Variables
OPENAI_API_KEY=your_openai_api_key_here
CSRF_SECRET=$(openssl rand -hex 16 2>/dev/null || echo "your_32_character_random_string")
ENCRYPTION_KEY=$(openssl rand -base64 32 2>/dev/null || echo "your_base64_encoded_32_byte_key")

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE=your_supabase_service_role_key

# Optional: LangSmith Observability
LANGSMITH_API_KEY=your_langsmith_api_key
LANGSMITH_PROJECT=roborail
LANGSMITH_TRACING=true
EOF
    fi
else
    log_info ".env.local already exists"
fi

# Type checking
log_info "Running TypeScript type check..."
if npm run type-check; then
    log_info "TypeScript check passed ✓"
else
    log_warn "TypeScript check failed - this may be due to missing environment variables"
fi

# Build verification
log_info "Verifying build process..."
if npm run build; then
    log_info "Build verification passed ✓"
else
    log_error "Build failed - please check your configuration"
    exit 1
fi

# Final checks
log_info "Running final validation..."

# Check if key files exist
REQUIRED_FILES=("package.json" "tsconfig.json" "next.config.ts" "tailwind.config.js")
for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        log_error "Required file missing: $file"
        exit 1
    fi
done

log_info "All required files present ✓"

# Success message
echo ""
log_info "🎉 RoboRail development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your API keys and configuration"
echo "2. Start development server: npm run dev"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "For more information, see:"
echo "- AGENTS.md - Agent configuration guide"
echo "- CLAUDE.md - Development guidelines"
echo "- README.md - Project documentation"
echo ""

# Optional: Start development server
read -p "Start development server now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    log_info "Starting development server..."
    npm run dev
fi