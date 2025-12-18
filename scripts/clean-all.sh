#!/bin/bash

# Clean all caches and build artifacts for eve-vault monorepo
# Usage: ./scripts/clean-all.sh

set -e

echo "🧹 Cleaning eve-vault monorepo..."

# Get the root directory (parent of scripts folder)
ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "📁 Working in: $ROOT_DIR"

# Remove node_modules
echo "🗑️  Removing node_modules..."
rm -rf node_modules
rm -rf apps/*/node_modules
rm -rf packages/*/node_modules

# Remove Vite cache
echo "🗑️  Removing Vite cache..."
rm -rf .vite
rm -rf apps/*/.vite
rm -rf apps/*/node_modules/.vite
rm -rf packages/*/.vite

# Remove TypeScript build output
echo "🗑️  Removing TypeScript build output (dist folders)..."
rm -rf packages/*/dist
rm -rf apps/*/dist

# Remove TypeScript build info
echo "🗑️  Removing TypeScript build info..."
find . -name "tsconfig.tsbuildinfo" -type f -delete 2>/dev/null || true
find . -name "*.tsbuildinfo" -type f -delete 2>/dev/null || true

# Remove Turbo cache
echo "🗑️  Removing Turbo cache..."
rm -rf .turbo
rm -rf apps/*/.turbo
rm -rf packages/*/.turbo

# Remove WXT output (extension specific)
echo "🗑️  Removing WXT output..."
rm -rf apps/extension/.output
rm -rf apps/extension/.wxt

# Remove other common caches
echo "🗑️  Removing other caches..."
rm -rf .cache
rm -rf apps/*/.cache
rm -rf packages/*/.cache

# Remove Bun cache (optional - uncomment if needed)
# echo "🗑️  Removing Bun cache..."
# rm -rf ~/.bun/install/cache

echo ""
echo "✅ All caches cleared!"
echo ""
echo "To reinstall dependencies and start fresh, run:"
echo "  bun install"
echo "  bun run build        # Required: builds shared package"
echo "  bun dev"
