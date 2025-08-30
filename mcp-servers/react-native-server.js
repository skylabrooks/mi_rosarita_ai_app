#!/usr/bin/env node

/**
 * React Native/Expo MCP Server for Mi Rosarita AI App
 *
 * Provides tools for React Native and Expo development, building, and operations.
 * This server enables AI assistants to:
 * - Run React Native apps on different platforms
 * - Build and deploy mobile apps
 * - Manage Expo development workflow
 * - Handle app configurations and assets
 * - Test mobile app functionality
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

class ReactNativeMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'react-native-mcp-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'react_native_start',
            description: 'Start React Native Metro bundler',
            inputSchema: {
              type: 'object',
              properties: {
                reset_cache: {
                  type: 'boolean',
                  description: 'Reset Metro cache before starting',
                  default: false,
                },
                port: {
                  type: 'number',
                  description: 'Port for Metro bundler',
                  default: 8081,
                },
              },
            },
          },
          {
            name: 'react_native_run_android',
            description: 'Run app on Android device/emulator',
            inputSchema: {
              type: 'object',
              properties: {
                device: {
                  type: 'string',
                  description: 'Specific Android device ID (optional)',
                },
                variant: {
                  type: 'string',
                  description: 'Build variant (debug, release)',
                  default: 'debug',
                  enum: ['debug', 'release'],
                },
              },
            },
          },
          {
            name: 'react_native_run_ios',
            description: 'Run app on iOS simulator/device',
            inputSchema: {
              type: 'object',
              properties: {
                device: {
                  type: 'string',
                  description: 'iOS simulator device name (e.g., "iPhone 15")',
                },
                scheme: {
                  type: 'string',
                  description: 'Build scheme (optional)',
                },
              },
            },
          },
          {
            name: 'expo_start',
            description: 'Start Expo development server',
            inputSchema: {
              type: 'object',
              properties: {
                platform: {
                  type: 'string',
                  description: 'Target platform (ios, android, web, all)',
                  default: 'all',
                  enum: ['ios', 'android', 'web', 'all'],
                },
                clear: {
                  type: 'boolean',
                  description: 'Clear cache before starting',
                  default: true,
                },
                dev: {
                  type: 'boolean',
                  description: 'Enable development mode',
                  default: true,
                },
              },
            },
          },
          {
            name: 'expo_build',
            description: 'Build Expo app for production',
            inputSchema: {
              type: 'object',
              properties: {
                platform: {
                  type: 'string',
                  description: 'Target platform',
                  enum: ['ios', 'android'],
                  required: true,
                },
                type: {
                  type: 'string',
                  description: 'Build type',
                  enum: ['archive', 'simulator', 'apk', 'aab'],
                  default: 'apk',
                },
                profile: {
                  type: 'string',
                  description: 'Build profile from eas.json',
                  default: 'production',
                },
              },
              required: ['platform'],
            },
          },
          {
            name: 'react_native_lint',
            description: 'Run ESLint on React Native code',
            inputSchema: {
              type: 'object',
              properties: {
                fix: {
                  type: 'boolean',
                  description: 'Auto-fix linting issues',
                  default: false,
                },
                dir: {
                  type: 'string',
                  description: 'Directory to lint',
                  default: 'src',
                },
              },
            },
          },
          {
            name: 'react_native_test',
            description: 'Run React Native tests',
            inputSchema: {
              type: 'object',
              properties: {
                watch: {
                  type: 'boolean',
                  description: 'Run in watch mode',
                  default: false,
                },
                coverage: {
                  type: 'boolean',
                  description: 'Generate coverage report',
                  default: false,
                },
                testPathPattern: {
                  type: 'string',
                  description: 'Pattern to match test files',
                },
              },
            },
          },
          {
            name: 'expo_install_dependencies',
            description: 'Install or update Expo dependencies',
            inputSchema: {
              type: 'object',
              properties: {
                packages: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific packages to install',
                },
                dev: {
                  type: 'boolean',
                  description: 'Install as dev dependencies',
                  default: false,
                },
              },
            },
          },
          {
            name: 'expo_prebuild',
            description: 'Generate native iOS/Android projects from Expo config',
            inputSchema: {
              type: 'object',
              properties: {
                platform: {
                  type: 'string',
                  description: 'Target platform (ios, android, all)',
                  default: 'all',
                  enum: ['ios', 'android', 'all'],
                },
                clean: {
                  type: 'boolean',
                  description: 'Clean native folders before prebuild',
                  default: false,
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'react_native_start':
            return await this.startMetro(args);
          case 'react_native_run_android':
            return await this.runAndroid(args);
          case 'react_native_run_ios':
            return await this.runIOS(args);
          case 'expo_start':
            return await this.startExpo(args);
          case 'expo_build':
            return await this.buildExpo(args);
          case 'react_native_lint':
            return await this.runLint(args);
          case 'react_native_test':
            return await this.runTests(args);
          case 'expo_install_dependencies':
            return await this.installDependencies(args);
          case 'expo_prebuild':
            return await this.prebuildExpo(args);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  setupResourceHandlers() {
    this.server.setRequestHandler('resources/list', async () => {
      return {
        resources: [
          {
            uri: 'react-native://app/config',
            mimeType: 'application/json',
            name: 'App Configuration',
            description: 'Expo/app.json configuration',
          },
          {
            uri: 'react-native://package/info',
            mimeType: 'application/json',
            name: 'Package Information',
            description: 'Package.json dependencies and scripts',
          },
          {
            uri: 'react-native://metro/config',
            mimeType: 'application/json',
            name: 'Metro Configuration',
            description: 'Metro bundler configuration',
          },
        ],
      };
    });

    this.server.setRequestHandler('resources/read', async (request) => {
      const { uri } = request.params;

      try {
        switch (uri) {
          case 'react-native://app/config':
            return await this.getAppConfigResource();
          case 'react-native://package/info':
            return await this.getPackageInfoResource();
          case 'react-native://metro/config':
            return await this.getMetroConfigResource();
          default:
            throw new Error(`Unknown resource: ${uri}`);
        }
      } catch (error) {
        return {
          contents: [
            {
              uri,
              mimeType: 'text/plain',
              text: `Error: ${error.message}`,
            },
          ],
        };
      }
    });
  }

  async startMetro(args = {}) {
    const { reset_cache = false, port = 8081 } = args;

    const commandArgs = ['start', `--port=${port}`];
    if (reset_cache) {
      commandArgs.push('--reset-cache');
    }

    // Start Metro in background
    const child = spawn('react-native', commandArgs, {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    return {
      content: [
        {
          type: 'text',
          text: `Metro bundler started on port ${port}. PID: ${child.pid}`,
        },
      ],
    };
  }

  async runAndroid(args = {}) {
    const { device, variant = 'debug' } = args;

    const commandArgs = ['run-android', `--variant=${variant}`];
    if (device) {
      commandArgs.push(`--deviceId=${device}`);
    }

    const output = execSync(`react-native ${commandArgs.join(' ')}`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 5,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Android app launched:\n${output}`,
        },
      ],
    };
  }

  async runIOS(args = {}) {
    const { device, scheme } = args;

    const commandArgs = ['run-ios'];
    if (device) {
      commandArgs.push(`--simulator=${device}`);
    }
    if (scheme) {
      commandArgs.push(`--scheme=${scheme}`);
    }

    const output = execSync(`react-native ${commandArgs.join(' ')}`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 5,
    });

    return {
      content: [
        {
          type: 'text',
          text: `iOS app launched:\n${output}`,
        },
      ],
    };
  }

  async startExpo(args = {}) {
    const { platform = 'all', clear = true, dev = true } = args;

    const commandArgs = ['start'];
    if (platform !== 'all') {
      commandArgs.push(`--${platform}`);
    }
    if (clear) {
      commandArgs.push('--clear');
    }
    if (!dev) {
      commandArgs.push('--no-dev');
    }

    // Start Expo in background
    const child = spawn('expo', commandArgs, {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    return {
      content: [
        {
          type: 'text',
          text: `Expo development server started for ${platform} platform(s). PID: ${child.pid}`,
        },
      ],
    };
  }

  async buildExpo(args) {
    const { platform, type = 'apk', profile = 'production' } = args;

    if (!platform) {
      throw new Error('Platform is required for Expo build');
    }

    const command = platform === 'ios' ? 'eas build --platform ios' : 'eas build --platform android';

    const output = execSync(`${command} --profile ${profile}`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Expo build completed for ${platform}:\n${output}`,
        },
      ],
    };
  }

  async runLint(args = {}) {
    const { fix = false, dir = 'src' } = args;

    const commandArgs = [dir];
    if (fix) {
      commandArgs.unshift('--fix');
    }

    const output = execSync(`eslint ${commandArgs.join(' ')}`, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 5,
    });

    return {
      content: [
        {
          type: 'text',
          text: `ESLint ${fix ? 'fixed' : 'checked'}:\n${output}`,
        },
      ],
    };
  }

  async runTests(args = {}) {
    const { watch = false, coverage = false, testPathPattern } = args;

    let command = 'npm test';
    const commandArgs = [];

    if (watch) {
      commandArgs.push('--', '--watch');
    }
    if (coverage) {
      commandArgs.push('--', '--coverage');
    }
    if (testPathPattern) {
      commandArgs.push('--', `--testPathPattern=${testPathPattern}`);
    }

    const fullCommand = commandArgs.length > 0 ? `${command} ${commandArgs.join(' ')}` : command;

    const output = execSync(fullCommand, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Tests executed:\n${output}`,
        },
      ],
    };
  }

  async installDependencies(args = {}) {
    const { packages = [], dev = false } = args;

    const packageList = packages.join(' ');
    const command = dev ? `npm install --save-dev ${packageList}` : `npm install ${packageList}`;

    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 5,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Dependencies installed:\n${output}`,
        },
      ],
    };
  }

  async prebuildExpo(args = {}) {
    const { platform = 'all', clean = false } = args;

    let command = 'expo prebuild';
    if (platform !== 'all') {
      command += ` --platform ${platform}`;
    }
    if (clean) {
      command += ' --clean';
    }

    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10,
    });

    return {
      content: [
        {
          type: 'text',
          text: `Expo prebuild completed:\n${output}`,
        },
      ],
    };
  }

  async getAppConfigResource() {
    try {
      const appJson = await fs.readFile('app.json', 'utf8');
      const config = JSON.parse(appJson);

      return {
        contents: [
          {
            uri: 'react-native://app/config',
            mimeType: 'application/json',
            text: JSON.stringify(config, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: 'react-native://app/config',
            mimeType: 'application/json',
            text: JSON.stringify({
              error: error.message,
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    }
  }

  async getPackageInfoResource() {
    try {
      const packageJson = await fs.readFile('package.json', 'utf8');
      const packageInfo = JSON.parse(packageJson);

      return {
        contents: [
          {
            uri: 'react-native://package/info',
            mimeType: 'application/json',
            text: JSON.stringify({
              name: packageInfo.name,
              version: packageInfo.version,
              scripts: packageInfo.scripts,
              dependencies: packageInfo.dependencies,
              devDependencies: packageInfo.devDependencies,
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: 'react-native://package/info',
            mimeType: 'application/json',
            text: JSON.stringify({
              error: error.message,
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    }
  }

  async getMetroConfigResource() {
    try {
      const metroConfig = await fs.readFile('metro.config.js', 'utf8');

      return {
        contents: [
          {
            uri: 'react-native://metro/config',
            mimeType: 'application/javascript',
            text: metroConfig,
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: 'react-native://metro/config',
            mimeType: 'application/json',
            text: JSON.stringify({
              error: error.message,
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('React Native MCP server started');
  }
}

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const server = new ReactNativeMCPServer();
  server.run().catch(console.error);
}

export default ReactNativeMCPServer;