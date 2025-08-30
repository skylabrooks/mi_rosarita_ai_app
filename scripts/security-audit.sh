#!/bin/bash

# 🔍 AUTOMATED SECURITY AUDIT SCRIPT
# Monitors dependency vulnerabilities across environments

set -e

AUDIT_LOG="security-audit-$(date +%Y%m%d-%H%M%S).log"
REPORT_FILE="security-report-$(date +%Y%m%d).md"

echo "🔍 Starting Comprehensive Security Audit..."
echo "📊 Audit timestamp: $(date)"
echo "📝 Log file: $AUDIT_LOG"

# Function to audit package file
audit_package() {
    local package_file=$1
    local env_name=$2

    echo "==========================================" >> "$AUDIT_LOG"
    echo "🔍 Auditing $env_name environment" >> "$AUDIT_LOG"
    echo "📄 Package file: $package_file" >> "$AUDIT_LOG"
    echo "==========================================" >> "$AUDIT_LOG"

    if [ -f "$package_file" ]; then
        echo "✅ Found package file: $package_file"

        # Create temporary directory for isolated audit
        local temp_dir=$(mktemp -d)
        cp "$package_file" "$temp_dir/package.json"

        cd "$temp_dir"

        # Install dependencies
        npm install --package-lock-only 2>/dev/null

        # Run audit
        echo "Running npm audit for $env_name..." >> "../../../$AUDIT_LOG"
        if npm audit --audit-level=info >> "../../../$AUDIT_LOG" 2>&1; then
            echo "✅ $env_name audit completed" >> "../../../$AUDIT_LOG"
        else
            echo "🚨 $env_name contains vulnerabilities" >> "../../../$AUDIT_LOG"
        fi

        # Cleanup
        cd "../../../"
        rm -rf "$temp_dir"

    else
        echo "❌ Package file not found: $package_file" >> "$AUDIT_LOG"
    fi
}

# Audit all environments
audit_package "package.prod.json" "Production"
audit_package "package.dev.json" "Development"
audit_package "package.json" "Current"

# Generate report
echo "📋 Generating security report..."
{
    echo "# 🔒 Security Audit Report"
    echo "**Generated:** $(date)"
    echo "**Audit Log:** $AUDIT_LOG"
    echo ""

    if grep -q "🚨" "$AUDIT_LOG"; then
        echo "## 🚨 Security Issues Found"
        echo "Critical vulnerabilities detected in one or more environments."
    else
        echo "## ✅ All Environments Secure"
        echo "No critical vulnerabilities found in audited environments."
    fi

    echo ""
    echo "## 📊 Audit Summary"
    echo "\`\`\`"
    grep "🔍\|✅\|🚨" "$AUDIT_LOG"
    echo "\`\`\`"

} > "$REPORT_FILE"

echo "📝 Security report generated: $REPORT_FILE"
echo "🔍 Audit completed successfully"