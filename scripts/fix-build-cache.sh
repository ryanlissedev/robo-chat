#!/bin/bash

# Fix Next.js Build Cache Issues
# This script resolves common build manifest and cache corruption issues

echo "🔧 Fixing Next.js build cache issues..."

# Function to safely remove directories
safe_remove() {
    if [ -d "$1" ]; then
        echo "  Removing $1..."
        rm -rf "$1"
    else
        echo "  $1 does not exist, skipping..."
    fi
}

# Function to create directories if they don't exist
ensure_directory() {
    if [ ! -d "$1" ]; then
        echo "  Creating $1..."
        mkdir -p "$1"
    fi
}

echo "📁 Cleaning build artifacts..."

# Remove Next.js build cache
safe_remove ".next"
safe_remove ".turbo"

# Remove node_modules cache (optional, uncomment if needed)
# safe_remove "node_modules/.cache"

# Remove package manager caches
safe_remove "node_modules/.cache"

echo "🔄 Reinstalling dependencies..."

# Clear pnpm cache
pnpm store prune 2>/dev/null || echo "  pnpm store prune failed (this is usually fine)"

# Remove pnpm cache directories
safe_remove "node_modules/.pnpm"
safe_remove ".pnpm-store"

# Reinstall dependencies
pnpm install

echo "🏗️  Rebuilding project..."

# Build the project
pnpm run build

echo "✅ Build cache issues should now be resolved!"
echo ""
echo "💡 If you continue to experience issues, try:"
echo "   - pnpm run dev:clean (clean development start)"
echo "   - pnpm run build:clean (clean production build)"
echo "   - pnpm run clean (manual cache cleanup)"
echo ""
echo "🚀 You can now start the development server with: pnpm run dev"
