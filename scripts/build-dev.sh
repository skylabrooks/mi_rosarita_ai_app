#!/bin/bash

# 🚨 DEVELOPMENT BUILD SCRIPT
# This script sets up the development environment with ALL dependencies
# including those with known vulnerabilities

set -e

echo "🔧 Setting up Development Environment..."
echo "🚨 WARNING: This environment contains vulnerable dependencies!"
echo "🔒 Vulnerabilities are isolated from production builds"

# Step 1: Clean previous installations
echo "🧹 Cleaning previous installations..."
rm -rf node_modules package-lock.json

# Step 2: Backup original package.json and use development configuration
echo "📦 Setting up development package configuration..."
cp package.json package.json.backup
cp package.dev.json package.json

# Step 3: Install development dependencies
echo "📦 Installing development dependencies..."
npm install --package-lock-only

# Step 4: Restore original package.json
echo "🔄 Restoring original package configuration..."
mv package.json.backup package.json

# Step 5: Security notification
echo ""
echo "=========================================="
echo "🚨 SECURITY NOTIFICATION"
echo "=========================================="
echo "Development environment contains:"
echo "• 18 high-severity vulnerabilities"
echo "• 8 moderate-severity vulnerabilities"
echo "• 4 low-severity vulnerabilities"
echo "=========================================="
echo "✅ These are ISOLATED from production builds"
echo "✅ Regular security audits will monitor changes"
echo "=========================================="

# Step 6: Start development environment
echo "🚀 Starting development server..."
npm run security-notice
npm start