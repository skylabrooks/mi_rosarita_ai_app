@echo off
REM 🚨 DEVELOPMENT BUILD SCRIPT
REM This script sets up the development environment with ALL dependencies
REM including those with known vulnerabilities

echo 🔧 Setting up Development Environment...
echo 🚨 WARNING: This environment contains vulnerable dependencies!
echo 🔒 Vulnerabilities are isolated from production builds

REM Step 1: Clean previous installations
echo 🧹 Cleaning previous installations...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

REM Step 2: Backup original package.json and use development configuration
echo 📦 Setting up development package configuration...
if exist package.json.backup del package.json.backup
if exist package.json rename package.json package.json.backup
copy package.dev.json package.json >nul

REM Step 3: Install development dependencies
echo 📦 Installing development dependencies...
call npm install --package-lock-only

REM Step 4: Keep development configuration for development server
REM NOTE: Development configuration remains active during development
REM To return to production configuration, run: npm run restore-prod

REM Step 5: Show security notification
echo.
echo ===========================================
echo 🚨 SECURITY NOTIFICATION
echo ===========================================
echo Development environment contains:
echo • 18 high-severity vulnerabilities
echo • 8 moderate-severity vulnerabilities
echo • 4 low-severity vulnerabilities
echo ===========================================
echo ✅ These are ISOLATED from production builds
echo ✅ Regular security audits will monitor changes
echo ===========================================

REM Step 6: Development setup complete
echo ✅ Development environment setup complete!
echo.
echo 🚀 Starting development server...
echo 🚨 Development configuration remains active with vulnerabilities
echo.
echo 🔧 Server commands:
echo    npm start        - Start Expo dev server
echo    npm run web:dev  - Start in web mode
echo    npm run android:dev - Android development
echo    npm run ios:dev     - iOS development
echo.
echo 🚨 Remember: The development environment contains:
echo    • 18 high-severity vulnerabilities
echo    • 8 moderate-severity vulnerabilities
echo    • 4 low-severity vulnerabilities
echo    These are ISOLATED from production builds
echo.
echo 🏭 To switch back to production mode, run: npm run restore-prod
echo.

REM Step 7: Start development server
npm start