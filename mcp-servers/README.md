# 🚀 Mi Rosarita AI App - MCP Servers

This directory contains **Model Context Protocol (MCP) servers** that provide AI assistants with powerful tools to help develop, test, deploy, and maintain the Mi Rosarita AI travel companion app.

## 📋 Overview

The MCP servers in this project enhance your development workflow by providing AI assistants with tools for:

- **Firebase Development** - Cloud Functions, Firestore, Authentication
- **React Native Development** - App building, testing, Expo operations
- **Google AI Integration** - Gemini API testing, itinerary generation
- **API Integration Testing** - Amadeus, Stripe, Google Maps testing
- **Code Quality & Testing** - Linting, coverage, type checking
- **Security Management** - API key validation, environment security

## 🛠️ Available MCP Servers

### 1. **Firebase MCP Server** (`firebase-server.js`)
**Purpose**: Firebase development and operations
**Tools**:
- Deploy Cloud Functions to production
- Start/stop Firebase emulators
- Query Firestore collections
- Manage Firebase projects
- Monitor function logs
- Deploy security rules

**Example Usage**:
```javascript
// Deploy all functions
firebase_deploy_functions({ project: "my-project" })

// Start emulators
firebase_emulators_start({ services: ["functions", "firestore"] })

// Query deals collection
firebase_firestore_query({
  collection: "deals",
  limit: 10,
  project: "my-project"
})
```

### 2. **React Native MCP Server** (`react-native-server.js`)
**Purpose**: Mobile app development with Expo
**Tools**:
- Start Metro bundler
- Run apps on iOS/Android devices
- Start Expo development server
- Build production APKs/AABs
- Lint and format code
- Install dependencies

**Example Usage**:
```javascript
// Start Expo dev server
expo_start({ platform: "all", dev: true })

// Build production APK
expo_build({
  platform: "android",
  type: "apk",
  profile: "production"
})

// Run on Android device
react_native_run_android({
  variant: "debug",
  device: "emulator-5554"
})
```

### 3. **Google AI MCP Server** (`google-ai-server.js`)
**Purpose**: Gemini AI integration and testing
**Tools**:
- Test Google AI API connections
- Generate AI-powered itineraries
- Analyze travel photos
- Create deal descriptions
- Monitor API usage
- Validate AI content

**Example Usage**:
```javascript
// Configure API key
gemini_configure({ api_key: "your-api-key" })

// Generate itinerary
gemini_generate_itinerary({
  duration: 3,
  interests: ["beach", "food", "culture"],
  budget: "medium",
  destination: "Rosarito"
})

// Analyze photos
gemini_analyze_photos({
  photo_urls: ["url1", "url2"],
  analysis_type: "travel"
})
```

### 4. **API Testing MCP Server** (`api-testing-server.js`)
**Purpose**: External API integration testing
**Tools**:
- Test Amadeus flight/hotel APIs
- Test Stripe payment processing
- Test Google Maps Places API
- Generate mock response data
- Validate API responses
- Monitor rate limits

**Example Usage**:
```javascript
// Configure Amadeus API
api_configure_keys({
  service: "amadeus",
  api_key: "your-key",
  api_secret: "your-secret"
})

// Test flight search
amadeus_test_flights({
  origin: "LAX",
  destination: "TIJ",
  departure_date: "2024-12-25",
  mock_response: false
})

// Test payment processing
stripe_test_payment({
  amount: 5000,
  currency: "usd",
  description: "Travel booking"
})
```

### 5. **Testing & Quality MCP Server** (`testing-quality-server.js`)
**Purpose**: Code quality and testing operations
**Tools**:
- Run unit tests with coverage
- Lint TypeScript/React code
- Check type definitions
- Generate coverage reports
- Format code with Prettier
- Security vulnerability scanning
- Performance auditing

**Example Usage**:
```javascript
// Run tests with coverage
run_tests({
  test_type: "all",
  coverage: true,
  watch: false
})

// Lint code
lint_code({
  fix: true,
  dir: "src",
  format: "stylish"
})

// Check TypeScript types
check_typescript({
  strict: true,
  project: "tsconfig.json"
})
```

### 6. **Security MCP Server** (`security-server.js`)
**Purpose**: API key management and security validation
**Tools**:
- Validate API key formats
- Scan codebase for exposed secrets
- Generate secure configurations
- Environment security checks
- Encrypt sensitive data
- JWT token validation

**Example Usage**:
```javascript
// Validate API keys
validate_api_keys({
  services: ["GOOGLE_AI_API_KEY", "STRIPE_SECRET_KEY"],
  check_strength: true,
  check_exposure: true
})

// Scan for secrets
scan_secrets({
  directories: ["src", "functions"],
  scan_types: ["api_keys", "passwords"]
})

// Generate secure config
generate_secure_config({
  services: ["all"],
  include_comments: true
})
```

## 🚀 Quick Start

### 1. **Install Dependencies**
```bash
# Install MCP SDK
npm install --save-dev @modelcontextprotocol/sdk

# Install server-specific dependencies (as needed)
npm install --save-dev firebase-tools expo-cli node-fetch
```

### 2. **Configure Environment**
Copy MCP configuration to your `.env` file:
```bash
# Enable desired servers
MCP_FIREBASE_ENABLED=true
MCP_REACT_NATIVE_ENABLED=true
MCP_GOOGLE_AI_ENABLED=true
MCP_API_TESTING_ENABLED=true
MCP_TESTING_QUALITY_ENABLED=true
MCP_SECURITY_ENABLED=true
```

### 3. **MCP Client Configuration**
Create an `.mcprc` file or configure your MCP client:

```json
{
  "mcpServers": {
    "firebase-server": {
      "command": "node",
      "args": ["./mcp-servers/firebase-server.js"],
      "env": {
        "FIREBASE_PROJECT_ID": "your-project-id"
      }
    },
    "react-native-server": {
      "command": "node",
      "args": ["./mcp-servers/react-native-server.js"],
      "env": {
        "NODE_ENV": "development"
      }
    },
    "google-ai-server": {
      "command": "node",
      "args": ["./mcp-servers/google-ai-server.js"]
    },
    "api-testing-server": {
      "command": "node",
      "args": ["./mcp-servers/api-testing-server.js"]
    },
    "testing-quality-server": {
      "command": "node",
      "args": ["./mcp-servers/testing-quality-server.js"]
    },
    "security-server": {
      "command": "node",
      "args": ["./mcp-servers/security-server.js"]
    }
  }
}
```

### 4. **Start Servers**
Each server can be started independently:
```bash
# Start all servers in background
node mcp-servers/firebase-server.js &
node mcp-servers/react-native-server.js &
node mcp-servers/google-ai-server.js &
node mcp-servers/api-testing-server.js &
node mcp-servers/testing-quality-server.js &
node mcp-servers/security-server.js &
```

## 🔧 Server Dependencies

### Global Dependencies
- `@modelcontextprotocol/sdk` - MCP protocol implementation

### Server-Specific Dependencies

**Firebase Server**:
- `firebase-tools` - Firebase CLI
- `firebase-admin` - Firebase Admin SDK

**React Native Server**:
- `@react-native/cli` - React Native CLI
- `expo-cli` - Expo CLI
- `prettier` - Code formatting
- `eslint` - Code linting

**Google AI Server**:
- `@google/generative-ai` - Google AI SDK

**API Testing Server**:
- `node-fetch` - HTTP requests
- `stripe` - Stripe SDK (optional)

**Testing & Quality Server**:
- `jest` - Testing framework
- `typescript` - TypeScript compiler
- `eslint` - Linting
- `prettier` - Formatting

**Security Server**:
- `crypto` - Node.js built-in
- `fs` - Node.js built-in

## 🎯 Best Practices

### 1. **Environment Management**
- Keep API keys secure and rotate regularly
- Use different keys for development/staging/production
- Enable only necessary MCP servers for your workflow

### 2. **Performance Optimization**
- Start servers only when needed
- Configure appropriate rate limits for API testing
- Use mock responses for development testing

### 3. **Security Considerations**
- Never commit `.env` files with real API keys
- Use the security server to validate configurations
- Regularly audit your codebase for exposed secrets

### 4. **MCP Server Management**
- Monitor server logs for debugging
- Restart servers if configuration changes
- Update server versions regularly for new features

## 🐛 Troubleshooting

### Common Issues

1. **Server won't start**
   - Check if required dependencies are installed
   - Verify environment variables are set
   - Check port availability

2. **API calls fail**
   - Validate API keys with security server
   - Check network connectivity
   - Verify API endpoints and authentication

3. **TypeScript errors**
   - Update TypeScript configuration
   - Check path mappings in tsconfig.json
   - Verify import statements

### Debug Mode
Run servers with debug logging:
```bash
DEBUG=mcp:* node mcp-servers/firebase-server.js
```

## 📚 Advanced Usage

### Custom Tool Development
Extend servers by adding new tools in the `setupToolHandlers()` methods:

```javascript
// Example: Add a custom Firebase tool
case 'my_custom_tool':
  return await this.myCustomTool(args);
```

### Resource Management
Add custom resources in `setupResourceHandlers()`:

```javascript
case 'my://custom/resource':
  return await this.getCustomResource();
```

### Integration with CI/CD
Use MCP servers in your deployment pipeline:

```yaml
# Example GitHub Actions workflow
- name: Run MCP Security Check
  run: node mcp-servers/security-server.js validate_api_keys

- name: Run Tests via MCP
  run: node mcp-servers/testing-quality-server.js run_tests
```

## 🤝 Contributing

When adding new MCP servers:

1. Follow the existing code structure and patterns
2. Add comprehensive documentation
3. Include example usage
4. Update dependencies in this README
5. Test server functionality thoroughly

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For MCP server issues and questions:
1. Check server logs for error messages
2. Validate your environment configuration
3. Review the troubleshooting section above
4. Create an issue with relevant log output

---

**Happy coding with AI assistance! 🚀✨**