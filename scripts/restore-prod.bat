@echo off
REM 🔒 PRODUCTION CONFIGURATION RESTORE SCRIPT

if not exist package.json.backup (
    echo ❌ No backup configuration found. Already in production mode.
    goto :end
)

echo 🔄 Restoring production configuration...
move package.json package.dev.current >nul 2>&1
move package.json.backup package.json

echo ✅ Restored to production configuration
echo 🔍 Run 'npm run security-audit' to verify clean production dependencies
goto :end

:end