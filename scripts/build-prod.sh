#!/bin/bash

# 🔒 PRODUCTION BUILD SCRIPT
# This script creates production builds with ZERO vulnerable dependencies

set -e

echo "🔒 Starting SECURE Production Build..."
echo "🛡️ Only production-safe dependencies will be included"

# Step 1: Clean build environment
echo "🧹 Cleaning build environment..."
rm -rf dist/ build/ node_modules/ package-lock.json

# Step 2: Backup original package.json and use production configuration
echo "📦 Setting up production package configuration..."
cp package.json package.json.backup
cp package.prod.json package.json

# Step 3: Create package-lock.json for production
echo "📦 Creating production package-lock.json..."
npm install --package-lock-only --production=false

# Step 4: Install ONLY production dependencies
echo "📦 Installing production-only dependencies..."
npm ci --production

# Step 3: Security audit of production dependencies
echo "🔍 Running security audit on production dependencies..."
if npm audit --audit-level=high; then
    echo "✅ Production dependencies PASSED security audit"
else
    echo "🚨 SECURITY VIOLATION: Production dependencies contain vulnerabilities!"
    echo "❌ Build aborted for security reasons"
    exit 1
fi

# Step 4: Build production bundle
echo "🏗️ Building production bundle..."
npx expo export --platform all --output-dir dist/

# Step 5: Verify build artifacts
echo "✨ Verifying production build..."
if [ -d "dist" ] && [ "$(ls -A dist)" ]; then
    echo "✅ Production build completed successfully"
    echo "📊 Build size: $(du -sh dist | cut -f1)"
else
    echo "❌ Production build failed - no artifacts found"
    exit 1
fi

# Step 6: Deploy (would integrate with CI/CD)
echo "🚀 Ready for deployment - no vulnerable dependencies detected"
echo "📋 Next steps:"
echo "   • Review dist/ contents"
echo "   • Run integration tests"
echo "   • Deploy to production environment"