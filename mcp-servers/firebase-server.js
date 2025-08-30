#!/usr/bin/env node

/**
 * Firebase MCP Server for Mi Rosarita AI App
 *
 * Provides tools for Firebase development, deployment, and operations management.
 * This server enables AI assistants to:
 * - Manage Firebase projects and services
 * - Deploy cloud functions
 * - Monitor Firestore database
 * - Manage Firebase Authentication
 * - Handle Firebase Storage operations
 * - Run Firebase emulators
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { execSync, spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import * as admin from 'firebase-admin';
import mime from 'mime-types';
import https from 'https';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import winston from 'winston';
import NodeCache from 'node-cache';

class FirebaseMCPServer {
  constructor(config = {}) {
    // Configuration with defaults
    this.config = {
      rateLimits: {
        global: { points: 1000, duration: 60 }, // 1000 requests per minute globally
        auth: { points: 500, duration: 60 },
        storage: { points: 300, duration: 60 },
        firestore: { points: 800, duration: 60 },
        hosting: { points: 100, duration: 60 },
      },
      retryConfig: {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30000,
      },
      logLevel: config.logLevel || 'info',
      enableMetrics: config.enableMetrics !== false,
      enableCaching: config.enableCaching !== false,
      ...config
    };

    // Initialize logger
    this.logger = winston.createLogger({
      level: this.config.logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          )
        })
      ]
    });

    // Initialize cache
    this.cache = new NodeCache({
      stdTTL: 300, // 5 minutes default TTL
      checkperiod: 60, // Check for expired keys every 60 seconds
    });

    // Initialize rate limiters
    this.rateLimiters = {
      global: new RateLimiterMemory(this.config.rateLimits.global),
      auth: new RateLimiterMemory(this.config.rateLimits.auth),
      storage: new RateLimiterMemory(this.config.rateLimits.storage),
      firestore: new RateLimiterMemory(this.config.rateLimits.firestore),
      hosting: new RateLimiterMemory(this.config.rateLimits.hosting),
    };

    // Usage statistics
    this.stats = {
      totalRequests: 0,
      requestsByOperation: new Map(),
      errorsByType: new Map(),
      averageResponseTime: 0,
      rateLimitHits: new Map(),
      cacheHits: 0,
      cacheMisses: 0,
    };

    // Initialize Firebase Admin SDK with enhanced config
    this.firebaseApps = new Map();

    // Default app initialization (for single project use)
    this.firebaseApps.set('default', admin.initializeApp({
      projectId: 'mi-rosarita-ai-app',
      credential: admin.credential.applicationDefault(),
      databaseURL: `https://mi-rosarita-ai-app.firebaseio.com`
    }));

    this.server = new Server(
      {
        name: 'firebase-mcp-server',
        version: '0.2.0',
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

    this.logger.info('Firebase MCP Server initialized with enhanced features');
  }

 // Firebase-specific error categorization
 categorizeError(error) {
    if (error.code) {
      switch (error.code) {
        case 'auth/email-already-exists':
        case 'auth/phone-number-already-exists':
          return { category: 'Auth', type: 'Duplicate', suggestion: 'Use a different email/phone number' };
        case 'auth/invalid-email':
        case 'auth/weak-password':
          return { category: 'Auth', type: 'InvalidInput', suggestion: 'Check input format and requirements' };
        case 'auth/user-not-found':
        case 'auth/wrong-password':
          return { category: 'Auth', type: 'Authentication', suggestion: 'Verify credentials' };
        case 'auth/too-many-requests':
          return { category: 'Auth', type: 'RateLimited', suggestion: 'Please wait before retrying' };
        case 'auth/requires-recent-login':
          return { category: 'Auth', type: 'Session', suggestion: 'Re-authenticate the user' };
        case 'permission-denied':
          return { category: 'Permission', type: 'AccessDenied', suggestion: 'Check user permissions and security rules' };
        case 'not-found':
          return { category: 'NotFound', type: 'ResourceMissing', suggestion: 'Verify the resource exists' };
        case 'already-exists':
          return { category: 'Conflict', type: 'Duplicate', suggestion: 'Resource already exists' };
        case 'resource-exhausted':
          return { category: 'Quota', type: 'Exceeded', suggestion: 'Quota exceeded, wait or upgrade plan' };
        case 'cancelled':
        case 'deadline-exceeded':
          return { category: 'Network', type: 'Timeout', suggestion: 'Network timeout, please retry' };
        case 'unavailable':
          return { category: 'Network', type: 'ServiceUnavailable', suggestion: 'Service temporarily unavailable' };
        default:
          return { category: 'Unknown', type: 'Generic', suggestion: error.message };
      }
    }
    // Network errors
    if (error.name === 'FirebaseError') {
      return { category: 'Firebase', type: 'SDKError', suggestion: 'Check Firebase SDK usage' };
    }
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT') {
      return { category: 'Network', type: 'Connection', suggestion: 'Network issues, please retry' };
    }
    return { category: 'Unknown', type: 'Generic', suggestion: 'Unexpected error occurred' };
  }

 // Rate limiting helper
 async checkRateLimit(operation, key = 'global') {
    try {
      await this.rateLimiters[key].consume(operation);
      this.logger.debug(`Rate limit check passed for ${key}:${operation}`);
      return true;
    } catch (rejRes) {
      this.stats.rateLimitHits.set(key, (this.stats.rateLimitHits.get(key) || 0) + 1);
      this.logger.warn(`Rate limit exceeded for ${key}:${operation}`, { remaining: rejRes.remainingPoints });
      throw new Error(`Rate limit exceeded. Retry after ${Math.ceil(rejRes.msBeforeNext / 1000)} seconds`);
    }
  }

 // Exponential backoff retry mechanism
 async withRetry(operation, operationName, extraData = {}) {
    let lastError;
    const { maxRetries, baseDelayMs, maxDelayMs } = this.config.retryConfig;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const start = Date.now();
        const result = await operation();
        const duration = Date.now() - start;

        // Update metrics
        this.updateMetrics(operationName, duration, true);

        if (attempt > 0) {
          this.logger.info(`Operation ${operationName} succeeded on retry attempt ${attempt + 1}`);
        }

        return result;
      } catch (error) {
        lastError = error;
        const errorCategory = this.categorizeError(error);

        // Update error statistics
        this.stats.errorsByType.set(errorCategory.category, (this.stats.errorsByType.get(errorCategory.category) || 0) + 1);

        // Log error with context
        this.logger.error(`Operation ${operationName} failed on attempt ${attempt + 1}`, {
          error: error.message,
          category: errorCategory.category,
          type: errorCategory.type,
          suggestion: errorCategory.suggestion,
          ...extraData
        });

        // Don't retry on authentication or permission errors
        if (['Authentication', 'AccessDenied', 'InvalidInput'].includes(errorCategory.type)) {
          break;
        }

        if (attempt < maxRetries) {
          const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
          this.logger.info(`Retrying ${operationName} in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // Update metrics for failed operation
    this.updateMetrics(operationName, 0, false);

    // If we get here, all retries failed
    const errorCategory = this.categorizeError(lastError);
    const enhancedError = new Error(`Operation ${operationName} failed after ${maxRetries + 1} attempts: ${lastError.message}`);
    enhancedError.category = errorCategory.category;
    enhancedError.type = errorCategory.type;
    enhancedError.suggestion = errorCategory.suggestion;
    throw enhancedError;
  }

 // Metrics and statistics tracking
 updateMetrics(operationName, duration, success) {
    if (!this.config.enableMetrics) return;

    this.stats.totalRequests++;
    const current = this.stats.requestsByOperation.get(operationName) || { count: 0, totalTime: 0, successCount: 0, failureCount: 0 };
    current.count++;
    current.totalTime += duration;
    if (success) {
      current.successCount++;
    } else {
      current.failureCount++;
    }

    this.stats.requestsByOperation.set(operationName, current);

    // Calculate rolling average response time
    const totalTime = Array.from(this.stats.requestsByOperation.values()).reduce((sum, op) => sum + op.totalTime, 0);
    const totalCount = Array.from(this.stats.requestsByOperation.values()).reduce((sum, op) => sum + op.count, 0);
    this.stats.averageResponseTime = totalCount > 0 ? totalTime / totalCount : 0;
  }

 // Cache management
 getCacheKey(operation, ...args) {
    return `${operation}:${JSON.stringify(args)}`;
  }

 getCached(key) {
    if (!this.config.enableCaching) return null;

    const cached = this.cache.get(key);
    if (cached !== undefined) {
      this.stats.cacheHits++;
      this.logger.debug('Cache hit', { key });
      return cached;
    }
    this.stats.cacheMisses++;
    return null;
  }

 setCached(key, value, ttl = 300) {
    if (!this.config.enableCaching) return;
    this.cache.set(key, value, ttl);
    this.logger.debug('Cache set', { key, ttl });
  }

 // Get Firebase app instance (for multi-project support)
 getFirebaseApp(projectId = 'default') {
    if (this.firebaseApps.has(projectId)) {
      return this.firebaseApps.get(projectId);
    }

    // Create new app for the project
    const app = admin.initializeApp({
      projectId,
      credential: admin.credential.applicationDefault(),
      databaseURL: `https://${projectId}.firebaseio.com`
    }, projectId);

    this.firebaseApps.set(projectId, app);
    this.logger.info(`Initialized Firebase app for project: ${projectId}`);
    return app;
  }

 // Memory-efficient file handling for Storage operations
 async streamUploadToStorage(bucket, filePath, destination, metadata) {
    const fs = await import('fs');
    const file = bucket.file(destination);
    const readStream = fs.createReadStream(filePath);

    return new Promise((resolve, reject) => {
      const writeStream = file.createWriteStream({
        metadata,
        resumable: false, // Disable resumable uploads for better memory efficiency
      });

      writeStream.on('finish', () => resolve({ success: true, destination }));
      writeStream.on('error', reject);
      readStream.on('error', reject);

      readStream.pipe(writeStream);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler('tools/list', async () => {
      return {
        tools: [
          {
            name: 'firebase_deploy_functions',
            description: 'Deploy Firebase Cloud Functions to production',
            inputSchema: {
              type: 'object',
              properties: {
                project: {
                  type: 'string',
                  description: 'Firebase project ID (optional, uses default if not provided)',
                },
                functions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific functions to deploy (optional, deploys all if not provided)',
                },
              },
            },
          },
          {
            name: 'firebase_emulators_start',
            description: 'Start Firebase emulators for local development',
            inputSchema: {
              type: 'object',
              properties: {
                services: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['functions', 'firestore', 'auth', 'storage', 'hosting'],
                  },
                  description: 'Specific emulators to start (optional, starts all if not provided)',
                },
                port: {
                  type: 'number',
                  description: 'Port for emulator UI (default: 4000)',
                  default: 4000,
                },
              },
            },
          },
          {
            name: 'firebase_firestore_query',
            description: 'Query Firestore database collections using Firebase SDK with advanced filtering and ordering',
            inputSchema: {
              type: 'object',
              properties: {
                collection: {
                  type: 'string',
                  description: 'Collection name to query',
                },
                where: {
                  type: ['object', 'array'],
                  description: 'Query conditions - can be an object for single condition or array for multiple conditions. Each condition has field, operator, value.',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string' },
                      operator: { type: 'string', enum: ['==', '!=', '<', '<=', '>', '>=', 'array-contains', 'array-contains-any', 'in', 'not-in'] },
                      value: { }
                    },
                    required: ['field', 'operator', 'value']
                  }
                },
                orderBy: {
                  type: 'array',
                  description: 'Ordering fields',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string' },
                      direction: { type: 'string', enum: ['asc', 'desc'], default: 'asc' }
                    },
                    required: ['field']
                  }
                },
                limit: {
                  type: 'number',
                  description: 'Maximum number of documents to return',
                  default: 10,
                },
                project: {
                  type: 'string',
                  description: 'Firebase project ID (overrides default project)',
                },
              },
              required: ['collection'],
            },
          },
          {
            name: 'firebase_functions_logs',
            description: 'Retrieve Firebase Cloud Functions logs',
            inputSchema: {
              type: 'object',
              properties: {
                function: {
                  type: 'string',
                  description: 'Specific function name (optional)',
                },
                limit: {
                  type: 'number',
                  description: 'Number of log entries to retrieve',
                  default: 50,
                },
                project: {
                  type: 'string',
                  description: 'Firebase project ID',
                },
              },
            },
          },
          {
            name: 'firebase_project_info',
            description: 'Get Firebase project information and configuration',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'firebase_rules_deploy',
            description: 'Deploy Firestore and Storage security rules',
            inputSchema: {
              type: 'object',
              properties: {
                project: {
                  type: 'string',
                  description: 'Firebase project ID',
                },
                validate_only: {
                  type: 'boolean',
                  description: 'Only validate rules without deploying',
                  default: false,
                },
              },
            },
          },
          {
            name: 'firebase_auth_create_user',
            description: 'Create a new user in Firebase Authentication',
            inputSchema: {
              type: 'object',
              properties: {
                email: { type: 'string', description: 'User email' },
                password: { type: 'string', description: 'User password' },
                displayName: { type: 'string', description: 'Display name' },
                phoneNumber: { type: 'string', description: 'Phone number' },
                disabled: { type: 'boolean', description: 'Whether user is disabled', default: false },
                emailVerified: { type: 'boolean', description: 'Whether email is verified', default: false }
              },
              required: ['email', 'password']
            },
          },
          {
            name: 'firebase_auth_list_users',
            description: 'List users in Firebase Authentication',
            inputSchema: {
              type: 'object',
              properties: {
                maxResults: { type: 'number', description: 'Maximum number of users to list', default: 100 },
                pageToken: { type: 'string', description: 'Page token for pagination' }
              }
            },
          },
          {
            name: 'firebase_auth_delete_user',
            description: 'Delete a user by UID or email',
            inputSchema: {
              type: 'object',
              properties: {
                uid: { type: 'string', description: 'User ID' },
                email: { type: 'string', description: 'User email (alternative to UID)' }
              }
            },
          },
          {
            name: 'firebase_auth_update_user',
            description: 'Update user properties',
            inputSchema: {
              type: 'object',
              properties: {
                uid: { type: 'string' },
                updates: { type: 'object', description: 'Object with updates (displayName, email, password, etc.)' }
              },
              required: ['uid', 'updates']
            },
          },
          {
            name: 'firebase_auth_search_user',
            description: 'Search user by UID or email',
            inputSchema: {
              type: 'object',
              properties: {
                uid: { type: 'string', description: 'User ID' },
                email: { type: 'string', description: 'User email' }
              }
            },
          },
          {
            name: 'firebase_auth_set_custom_claims',
            description: 'Set custom claims for user',
            inputSchema: {
              type: 'object',
              properties: {
                uid: { type: 'string' },
                claims: { type: 'object', description: 'Object with custom claims' }
              },
              required: ['uid', 'claims']
            },
          },
          {
            name: 'firebase_auth_get_custom_claims',
            description: 'Get custom claims for user',
            inputSchema: {
              type: 'object',
              properties: {
                uid: { type: 'string' }
              },
              required: ['uid']
            },
          },
          {
            name: 'firebase_auth_remove_custom_claims',
            description: 'Remove custom claims for user',
            inputSchema: {
              type: 'object',
              properties: {
                uid: { type: 'string' }
              },
              required: ['uid']
            },
          },
          {
            name: 'firebase_auth_disable_user',
            description: 'Disable user account',
            inputSchema: {
              type: 'object',
              properties: {
                uid: { type: 'string' }
              },
              required: ['uid']
            },
          },
          {
            name: 'firebase_auth_enable_user',
            description: 'Enable user account',
            inputSchema: {
              type: 'object',
              properties: {
                uid: { type: 'string' }
              },
              required: ['uid']
            },
          },
          {
            name: 'firebase_auth_send_password_reset',
            description: 'Send password reset email',
            inputSchema: {
              type: 'object',
              properties: {
                email: { type: 'string', description: 'User email' },
                redirectUrl: { type: 'string', description: 'Redirect URL for the reset link (optional)' }
              },
              required: ['email']
            },
          },
          {
            name: 'firebase_auth_send_email_verification',
            description: 'Send email verification link',
            inputSchema: {
              type: 'object',
              properties: {
                email: { type: 'string' },
                redirectUrl: { type: 'string', description: 'Redirect URL for the verification link (optional)' }
              },
              required: ['email']
            },
          },
          {
            name: 'firebase_auth_bulk_create_users',
            description: 'Bulk create users',
            inputSchema: {
              type: 'object',
              properties: {
                users: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      email: { type: 'string' },
                      password: { type: 'string' },
                      displayName: { type: 'string' },
                      phoneNumber: { type: 'string' },
                      disabled: { type: 'boolean' },
                      emailVerified: { type: 'boolean' }
                    },
                    required: ['email', 'password']
                  }
                }
              },
              required: ['users']
            },
          },
          {
            name: 'firebase_auth_bulk_delete_users',
            description: 'Bulk delete users',
            inputSchema: {
              type: 'object',
              properties: {
                uids: { type: 'array', items: { type: 'string' }, description: 'Array of user IDs' }
              },
              required: ['uids']
            },
          },
          {
            name: 'firebase_auth_export_users',
            description: 'Export users data',
            inputSchema: {
              type: 'object',
              properties: {
                maxResults: { type: 'number', description: 'Maximum number of users to export', default: 500 }
              }
            },
          },
          {
            name: 'firebase_storage_upload_file',
            description: 'Upload a file to Firebase Storage with optional metadata',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: { type: 'string', description: 'Local file path to upload' },
                destination: { type: 'string', description: 'Destination path in storage (optional, uses filename if not provided)' },
                metadata: { type: 'object', description: 'Metadata object for the file' },
                contentType: { type: 'string', description: 'Content type of the file (optional)' },
                public: { type: 'boolean', description: 'Make file publicly accessible', default: false },
                bucketName: { type: 'string', description: 'Storage bucket name (optional, uses default)' }
              },
              required: ['filePath']
            },
          },
          {
            name: 'firebase_storage_upload_from_url',
            description: 'Upload a file from a URL to Firebase Storage',
            inputSchema: {
              type: 'object',
              properties: {
                url: { type: 'string', description: 'URL of the file to upload' },
                destination: { type: 'string', description: 'Destination path in storage' },
                metadata: { type: 'object', description: 'Metadata object for the file' },
                bucketName: { type: 'string', description: 'Storage bucket name (optional, uses default)' }
              },
              required: ['url', 'destination']
            },
          },
          {
            name: 'firebase_storage_bulk_upload',
            description: 'Upload multiple files to Firebase Storage',
            inputSchema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      filePath: { type: 'string' },
                      destination: { type: 'string' },
                      metadata: { type: 'object' },
                      contentType: { type: 'string' },
                      public: { type: 'boolean' }
                    },
                    required: ['filePath']
                  }
                },
                bucketName: { type: 'string', description: 'Storage bucket name (optional, uses default)' },
                continueOnError: { type: 'boolean', description: 'Continue uploading other files if one fails', default: false }
              },
              required: ['files']
            },
          },
          {
            name: 'firebase_storage_download_file',
            description: 'Download a file from Firebase Storage',
            inputSchema: {
              type: 'object',
              properties: {
                source: { type: 'string', description: 'Source path in storage' },
                destination: { type: 'string', description: 'Local destination path (optional, uses same as source if not provided)' },
                bucketName: { type: 'string', description: 'Storage bucket name (optional, uses default)' }
              },
              required: ['source']
            },
          },
          {
            name: 'firebase_storage_get_download_url',
            description: 'Generate a signed download URL for a file',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: { type: 'string', description: 'Path of the file in storage' },
                expiresIn: { type: 'number', description: 'Expiration time in seconds (default: 3600)', default: 3600 },
                bucketName: { type: 'string', description: 'Storage bucket name (optional, uses default)' }
              },
              required: ['filePath']
            },
          },
          {
            name: 'firebase_storage_get_file_metadata',
            description: 'Get metadata of a file without downloading it',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: { type: 'string', description: 'Path of the file in storage' },
                bucketName: { type: 'string', description: 'Storage bucket name (optional, uses default)' }
              },
              required: ['filePath']
            },
          },
          {
            name: 'firebase_storage_delete_file',
            description: 'Delete a file from Firebase Storage',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: { type: 'string', description: 'Path of the file to delete' },
                bucketName: { type: 'string', description: 'Storage bucket name (optional, uses default)' }
              },
              required: ['filePath']
            },
          },
          {
            name: 'firebase_storage_list_files',
            description: 'List files in a directory in Firebase Storage',
            inputSchema: {
              type: 'object',
              properties: {
                prefix: { type: 'string', description: 'Prefix/path to list files from' },
                maxResults: { type: 'number', description: 'Maximum number of files to return', default: 100 },
                includePrefixes: { type: 'boolean', description: 'Include subdirectory prefixes in results', default: false },
                bucketName: { type: 'string', description: 'Storage bucket name (optional, uses default)' }
              }
            },
          },
          {
            name: 'firebase_storage_move_file',
            description: 'Move or rename a file in Firebase Storage',
            inputSchema: {
              type: 'object',
              properties: {
                sourcePath: { type: 'string', description: 'Source path of the file' },
                destinationPath: { type: 'string', description: 'Destination path for the file' },
                bucketName: { type: 'string', description: 'Storage bucket name (optional, uses default)' }
              },
              required: ['sourcePath', 'destinationPath']
            },
          },
          {
            name: 'firebase_storage_update_metadata',
            description: 'Update metadata of a file in Firebase Storage',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: { type: 'string', description: 'Path of the file to update' },
                metadata: { type: 'object', description: 'New metadata object' },
                bucketName: { type: 'string', description: 'Storage bucket name (optional, uses default)' }
              },
              required: ['filePath', 'metadata']
            },
          },
          {
            name: 'firebase_storage_get_bucket_info',
            description: 'Get information about a storage bucket',
            inputSchema: {
              type: 'object',
              properties: {
                bucketName: { type: 'string', description: 'Storage bucket name (optional, uses default)' }
              }
            },
          },
          {
            name: 'firebase_storage_create_bucket',
            description: 'Create a new storage bucket',
            inputSchema: {
              type: 'object',
              properties: {
                bucketName: { type: 'string', description: 'Name of the new bucket' },
                location: { type: 'string', description: 'Location for the bucket (optional)', default: 'US' },
                storageClass: { type: 'string', description: 'Storage class (optional)', default: 'STANDARD' }
              },
              required: ['bucketName']
            },
          },
          {
            name: 'firebase_storage_batch_operations',
            description: 'Perform batch operations on multiple files',
            inputSchema: {
              type: 'object',
              properties: {
                operations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      type: { type: 'string', enum: ['delete', 'copy', 'move'] },
                      source: { type: 'string' },
                      destination: { type: 'string' }
                    },
                    required: ['type', 'source']
                  }
                },
                bucketName: { type: 'string', description: 'Storage bucket name (optional, uses default)' }
              },
              required: ['operations']
            },
          },
          {
            name: 'firebase_storage_validate_file',
            description: 'Validate a file before upload (size, type, etc.)',
            inputSchema: {
              type: 'object',
              properties: {
                filePath: { type: 'string', description: 'Local file path to validate' },
                allowedTypes: { type: 'array', items: { type: 'string' }, description: 'Allowed MIME types' },
                maxSize: { type: 'number', description: 'Maximum file size in bytes' },
                minSize: { type: 'number', description: 'Minimum file size in bytes' }
              },
              required: ['filePath']
            },
          },
          {
            name: 'firebase_auth_import_users',
            description: 'Import users with clear passwords',
            inputSchema: {
              type: 'object',
              properties: {
                users: { type: 'array', description: 'Array of user objects to import', items: { type: 'object', properties: { email: { type: 'string' }, password: { type: 'string' }, displayName: { type: 'string' } } } }
              },
              required: ['users']
            },
          },
          // Firebase Hosting Tools
          {
            name: 'firebase_hosting_deploy',
            description: 'Deploy Firebase Hosting site from build directory with enhanced error handling',
            inputSchema: {
              type: 'object',
              properties: {
                target: { type: 'string', description: 'Specific hosting target for multi-site hosting' },
                message: { type: 'string', description: 'Deployment message/commit description' },
                project: { type: 'string', description: 'Firebase project ID' },
                only: { type: 'string', description: 'Deploy only specific target or channel', default: 'hosting' },
                public: { type: 'string', description: 'Directory to deploy (default: public)' }
              }
            },
          },
          {
            name: 'firebase_hosting_deploy_channel',
            description: 'Deploy to a specific Firebase Hosting preview channel',
            inputSchema: {
              type: 'object',
              properties: {
                channel: { type: 'string', description: 'Preview channel name' },
                expires: { type: 'string', description: 'Channel expiration time (e.g., 7d, 24h)' },
                message: { type: 'string', description: 'Deployment message' },
                target: { type: 'string', description: 'Hosting target' },
                project: { type: 'string', description: 'Firebase project ID' },
                public: { type: 'string', description: 'Directory to deploy' }
              },
              required: ['channel']
            },
          },
          {
            name: 'firebase_hosting_deploy_target',
            description: 'Deploy Firebase Hosting to a specific target (multi-site hosting)',
            inputSchema: {
              type: 'object',
              properties: {
                target: { type: 'string', description: 'Hosting target name' },
                message: { type: 'string', description: 'Deployment message' },
                project: { type: 'string', description: 'Firebase project ID' },
                public: { type: 'string', description: 'Directory to deploy' },
                expires: { type: 'string', description: 'Expiration for preview channels' }
              },
              required: ['target']
            },
          },
          {
            name: 'firebase_hosting_list_sites',
            description: 'List all hosted sites in the Firebase project',
            inputSchema: {
              type: 'object',
              properties: {
                project: { type: 'string', description: 'Firebase project ID' }
              }
            },
          },
          {
            name: 'firebase_hosting_list_channels',
            description: 'List all preview channels for hosting',
            inputSchema: {
              type: 'object',
              properties: {
                target: { type: 'string', description: 'Hosting target (default: live channel)' },
                project: { type: 'string', description: 'Firebase project ID' }
              }
            },
          },
          {
            name: 'firebase_hosting_delete_channel',
            description: 'Delete a Firebase Hosting preview channel',
            inputSchema: {
              type: 'object',
              properties: {
                channel: { type: 'string', description: 'Channel name to delete' },
                target: { type: 'string', description: 'Hosting target' },
                project: { type: 'string', description: 'Firebase project ID' },
                force: { type: 'boolean', description: 'Force deletion without confirmation', default: false }
              },
              required: ['channel']
            },
          },
          {
            name: 'firebase_hosting_get_config',
            description: 'Get Firebase Hosting configuration',
            inputSchema: {
              type: 'object',
              properties: {
                project: { type: 'string', description: 'Firebase project ID' }
              }
            },
          },
          {
            name: 'firebase_hosting_domains_list',
            description: 'List custom domains connected to Firebase Hosting',
            inputSchema: {
              type: 'object',
              properties: {
                target: { type: 'string', description: 'Hosting target' },
                project: { type: 'string', description: 'Firebase project ID' }
              }
            },
          },
          {
            name: 'firebase_hosting_domains_add',
            description: 'Add a custom domain to Firebase Hosting',
            inputSchema: {
              type: 'object',
              properties: {
                domain: { type: 'string', description: 'Domain name to add' },
                target: { type: 'string', description: 'Hosting target' },
                project: { type: 'string', description: 'Firebase project ID' }
              },
              required: ['domain']
            },
          },
          {
            name: 'firebase_hosting_domains_delete',
            description: 'Remove a custom domain from Firebase Hosting',
            inputSchema: {
              type: 'object',
              properties: {
                domain: { type: 'string', description: 'Domain name to remove' },
                target: { type: 'string', description: 'Hosting target' },
                project: { type: 'string', description: 'Firebase project ID' }
              },
              required: ['domain']
            },
          },
          {
            name: 'firebase_hosting_init',
            description: 'Initialize Firebase Hosting configuration',
            inputSchema: {
              type: 'object',
              properties: {
                project: { type: 'string', description: 'Firebase project ID' },
                public: { type: 'string', description: 'Public directory name', default: 'public' },
                spa: { type: 'boolean', description: 'Set up as Single Page Application', default: true }
              }
            },
          },
          {
            name: 'firebase_hosting_status',
            description: 'Check Firebase Hosting deployment status',
            inputSchema: {
              type: 'object',
              properties: {
                target: { type: 'string', description: 'Hosting target' },
                project: { type: 'string', description: 'Firebase project ID' }
              }
            },
          },
          {
            name: 'firebase_hosting_serve',
            description: 'Serve Firebase Hosting site locally for development',
            inputSchema: {
              type: 'object',
              properties: {
                port: { type: 'number', description: 'Port number to serve on', default: 5000 },
                target: { type: 'string', description: 'Hosting target' },
                project: { type: 'string', description: 'Firebase project ID' },
                host: { type: 'string', description: 'Host to bind to', default: 'localhost' }
              }
            },
          },
          {
            name: 'firebase_hosting_rewrite_list',
            description: 'List URL rewrites and redirects for hosting',
            inputSchema: {
              type: 'object',
              properties: {
                target: { type: 'string', description: 'Hosting target' },
                project: { type: 'string', description: 'Firebase project ID' }
              }
            },
          },
          {
            name: 'firebase_hosting_rewrite_add',
            description: 'Add URL rewrite or redirect',
            inputSchema: {
              type: 'object',
              properties: {
                source: { type: 'string', description: 'Source URL pattern' },
                destination: { type: 'string', description: 'Destination URL' },
                type: { type: 'string', enum: ['rewrite', 'redirect'], description: 'Type of rewrite' },
                target: { type: 'string', description: 'Hosting target' },
                project: { type: 'string', description: 'Firebase project ID' }
              },
              required: ['source', 'destination', 'type']
            },
          },
          {
            name: 'firebase_hosting_headers_add',
            description: 'Add custom headers for hosting',
            inputSchema: {
              type: 'object',
              properties: {
                source: { type: 'string', description: 'URL pattern to match' },
                headers: { type: 'object', description: 'Headers object' },
                target: { type: 'string', description: 'Hosting target' },
                project: { type: 'string', description: 'Firebase project ID' }
              },
              required: ['source', 'headers']
            },
          },
          {
            name: 'firebase_hosting_ssl_certificates',
            description: 'Manage SSL certificates for custom domains',
            inputSchema: {
              type: 'object',
              properties: {
                action: { type: 'string', enum: ['list', 'provision', 'delete'], description: 'Action to perform on certificate' },
                domain: { type: 'string', description: 'Domain name for SSL certificate' },
                target: { type: 'string', description: 'Hosting target' },
                project: { type: 'string', description: 'Firebase project ID' }
              }
            },
          },
        ],
      };
    });

    this.server.setRequestHandler('tools/call', async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'firebase_deploy_functions':
            return await this.deployFunctions(args);
          case 'firebase_emulators_start':
            return await this.startEmulators(args);
          case 'firebase_firestore_query':
            return await this.queryFirestore(args);
          case 'firebase_functions_logs':
            return await this.getFunctionLogs(args);
          case 'firebase_project_info':
            return await this.getProjectInfo(args);
          case 'firebase_rules_deploy':
            return await this.deployRules(args);
          case 'firebase_auth_create_user':
            return await this.firebaseAuthCreateUser(args);
          case 'firebase_auth_list_users':
            return await this.firebaseAuthListUsers(args);
          case 'firebase_auth_delete_user':
            return await this.firebaseAuthDeleteUser(args);
          case 'firebase_auth_update_user':
            return await this.firebaseAuthUpdateUser(args);
          case 'firebase_auth_search_user':
            return await this.firebaseAuthSearchUser(args);
          case 'firebase_auth_set_custom_claims':
            return await this.firebaseAuthSetCustomClaims(args);
          case 'firebase_auth_get_custom_claims':
            return await this.firebaseAuthGetCustomClaims(args);
          case 'firebase_auth_remove_custom_claims':
            return await this.firebaseAuthRemoveCustomClaims(args);
          case 'firebase_auth_disable_user':
            return await this.firebaseAuthDisableUser(args);
          case 'firebase_auth_enable_user':
            return await this.firebaseAuthEnableUser(args);
          case 'firebase_auth_send_password_reset':
            return await this.firebaseAuthSendPasswordReset(args);
          case 'firebase_auth_send_email_verification':
            return await this.firebaseAuthSendEmailVerification(args);
          case 'firebase_auth_bulk_create_users':
            return await this.firebaseAuthBulkCreateUsers(args);
          case 'firebase_auth_bulk_delete_users':
            return await this.firebaseAuthBulkDeleteUsers(args);
          case 'firebase_auth_export_users':
            return await this.firebaseAuthExportUsers(args);
          case 'firebase_storage_upload_file':
            return await this.firebaseStorageUploadFile(args);
          case 'firebase_storage_upload_from_url':
            return await this.firebaseStorageUploadFromUrl(args);
          case 'firebase_storage_bulk_upload':
            return await this.firebaseStorageBulkUpload(args);
          case 'firebase_storage_download_file':
            return await this.firebaseStorageDownloadFile(args);
          case 'firebase_storage_get_download_url':
            return await this.firebaseStorageGetDownloadUrl(args);
          case 'firebase_storage_get_file_metadata':
            return await this.firebaseStorageGetFileMetadata(args);
          case 'firebase_storage_delete_file':
            return await this.firebaseStorageDeleteFile(args);
          case 'firebase_storage_list_files':
            return await this.firebaseStorageListFiles(args);
          case 'firebase_storage_move_file':
            return await this.firebaseStorageMoveFile(args);
          case 'firebase_storage_update_metadata':
            return await this.firebaseStorageUpdateMetadata(args);
          case 'firebase_storage_get_bucket_info':
            return await this.firebaseStorageGetBucketInfo(args);
          case 'firebase_storage_create_bucket':
            return await this.firebaseStorageCreateBucket(args);
          case 'firebase_storage_batch_operations':
            return await this.firebaseStorageBatchOperations(args);
          case 'firebase_storage_validate_file':
            return await this.firebaseStorageValidateFile(args);
          case 'firebase_auth_import_users':
            return await this.firebaseAuthImportUsers(args);
          // Firebase Hosting Tools
          case 'firebase_hosting_deploy':
            return await this.firebaseHostingDeploy(args);
          case 'firebase_hosting_deploy_channel':
            return await this.firebaseHostingDeployChannel(args);
          case 'firebase_hosting_deploy_target':
            return await this.firebaseHostingDeployTarget(args);
          case 'firebase_hosting_list_sites':
            return await this.firebaseHostingListSites(args);
          case 'firebase_hosting_list_channels':
            return await this.firebaseHostingListChannels(args);
          case 'firebase_hosting_delete_channel':
            return await this.firebaseHostingDeleteChannel(args);
          case 'firebase_hosting_get_config':
            return await this.firebaseHostingGetConfig(args);
          case 'firebase_hosting_domains_list':
            return await this.firebaseHostingDomainsList(args);
          case 'firebase_hosting_domains_add':
            return await this.firebaseHostingDomainsAdd(args);
          case 'firebase_hosting_domains_delete':
            return await this.firebaseHostingDomainsDelete(args);
          case 'firebase_hosting_init':
            return await this.firebaseHostingInit(args);
          case 'firebase_hosting_status':
            return await this.firebaseHostingStatus(args);
          case 'firebase_hosting_serve':
            return await this.firebaseHostingServe(args);
          case 'firebase_hosting_rewrite_list':
            return await this.firebaseHostingRewriteList(args);
          case 'firebase_hosting_rewrite_add':
            return await this.firebaseHostingRewriteAdd(args);
          case 'firebase_hosting_headers_add':
            return await this.firebaseHostingHeadersAdd(args);
          case 'firebase_hosting_ssl_certificates':
            return await this.firebaseHostingSSLCertificates(args);
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
            uri: 'firebase://project/info',
            mimeType: 'application/json',
            name: 'Firebase Project Information',
            description: 'Current Firebase project configuration and settings',
          },
          {
            uri: 'firebase://functions/list',
            mimeType: 'application/json',
            name: 'Cloud Functions List',
            description: 'Available Firebase Cloud Functions',
          },
          {
            uri: 'firebase://firestore/schema',
            mimeType: 'application/json',
            name: 'Firestore Schema',
            description: 'Database schema and collection structure',
          },
        ],
      };
    });

    this.server.setRequestHandler('resources/read', async (request) => {
      const { uri } = request.params;

      try {
        switch (uri) {
          case 'firebase://project/info':
            return await this.getProjectInfoResource();
          case 'firebase://functions/list':
            return await this.getFunctionsListResource();
          case 'firebase://firestore/schema':
            return await this.getFirestoreSchemaResource();
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

  async deployFunctions(args = {}) {
    const { project, functions } = args;

    let command = 'firebase deploy --only functions';
    if (project) {
      command += ` --project ${project}`;
    }
    if (functions && functions.length > 0) {
      command += `:${functions.join(',')}`;
    }

    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 10, // 10MB buffer
    });

    return {
      content: [
        {
          type: 'text',
          text: `Functions deployed successfully:\n${output}`,
        },
      ],
    };
  }

  async startEmulators(args = {}) {
    const { services, port = 4000 } = args;

    let command = `firebase emulators:start --ui-port=${port}`;

    if (services && services.length > 0) {
      command += ` --only ${services.join(',')}`;
    }

    // Start emulators in background
    const child = spawn('firebase', [
      'emulators:start',
      `--ui-port=${port}`,
      ...(services ? ['--only', services.join(',')] : []),
    ], {
      cwd: process.cwd(),
      detached: true,
      stdio: 'ignore',
    });

    child.unref();

    return {
      content: [
        {
          type: 'text',
          text: `Firebase emulators started on port ${port}. PID: ${child.pid}`,
        },
      ],
    };
  }

  async queryFirestore(args) {
    const { collection, where, orderBy, limit = 10, project } = args;

    try {
      // Use Firebase Admin SDK
      let firestore;
      if (project) {
        const app = admin.initializeApp({
          projectId: project
        }, `temp-${project}`);
        firestore = app.firestore();
      } else {
        firestore = admin.firestore();
      }

      let query = firestore.collection(collection);

      // Handle where conditions
      if (where) {
        if (Array.isArray(where)) {
          // Multiple conditions
          for (const condition of where) {
            query = query.where(condition.field, condition.operator, condition.value);
          }
        } else if (typeof where === 'object') {
          // Single condition
          query = query.where(where.field, where.operator, where.value);
        }
      }

      // Handle ordering
      if (orderBy && Array.isArray(orderBy)) {
        for (const order of orderBy) {
          query = query.orderBy(order.field, order.direction || 'asc');
        }
      }

      // Apply limit
      query = query.limit(limit);

      const snapshot = await query.get();
      const results = [];

      snapshot.forEach(doc => {
        results.push({
          id: doc.id,
          data: doc.data()
        });
      });

      // Clean up temporary app if it was created
      if (project) {
        await admin.getApp(`temp-${project}`).delete();
      }

      return {
        content: [
          {
            type: 'text',
            text: `Firestore query results for collection "${collection}":\n${JSON.stringify(results, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      // Clean up temporary app on error
      if (project) {
        try {
          await admin.getApp(`temp-${project}`).delete();
        } catch (e) {
          // Ignore cleanup error
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: `Error querying Firestore: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async getFunctionLogs(args = {}) {
    const { function: functionName, limit = 50, project } = args;

    let command = `firebase functions:log --limit=${limit}`;

    if (functionName) {
      command += ` --only=${functionName}`;
    }
    if (project) {
      command += ` --project=${project}`;
    }

    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 5, // 5MB buffer
    });

    return {
      content: [
        {
          type: 'text',
          text: `Function logs:\n${output}`,
        },
      ],
    };
  }

  async getProjectInfo(args = {}) {
    const output = execSync('firebase projects:list --json', {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    // Also get current project
    let currentProject = 'default';
    try {
      const currentOutput = execSync('firebase use', {
        cwd: process.cwd(),
        encoding: 'utf8',
      });
      const match = currentOutput.match(/Now using project (\S+)/);
      if (match) {
        currentProject = match[1];
      }
    } catch (error) {
      // Ignore error, use default
    }

    return {
      content: [
        {
          type: 'text',
          text: `Current project: ${currentProject}\n\nProject list:\n${output}`,
        },
      ],
    };
  }

  async deployRules(args = {}) {
    const { project, validate_only = false } = args;

    let command = 'firebase deploy --only firestore:rules,storage:rules';

    if (project) {
      command += ` --project=${project}`;
    }
    if (validate_only) {
      command += ' --validate-only';
    }

    const output = execSync(command, {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    return {
      content: [
        {
          type: 'text',
          text: `Security rules ${validate_only ? 'validated' : 'deployed'} successfully:\n${output}`,
        },
      ],
    };
  }
  async firebaseAuthCreateUser(args) {
    const { email, password, displayName, phoneNumber, disabled, emailVerified } = args;
    try {
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
        phoneNumber,
        disabled,
        emailVerified,
      });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              uid: userRecord.uid,
              email: userRecord.email,
              displayName: userRecord.displayName,
              phoneNumber: userRecord.phoneNumber,
              photoURL: userRecord.photoURL,
              disabled: userRecord.disabled,
              emailVerified: userRecord.emailVerified,
              metadata: userRecord.metadata,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseAuthListUsers(args) {
    const { maxResults = 100, pageToken } = args;
    try {
      const listUsersResult = await admin.auth().listUsers(maxResults, pageToken);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              users: listUsersResult.users.map(user => ({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                phoneNumber: user.phoneNumber,
                disabled: user.disabled,
                emailVerified: user.emailVerified,
                customClaims: user.customClaims,
                metadata: {
                  creationTime: user.metadata.creationTime,
                  lastSignInTime: user.metadata.lastSignInTime,
                },
              })),
              pageToken: listUsersResult.pageToken
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseAuthDeleteUser(args) {
    const { uid, email } = args;
    if (!uid && !email) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Provide uid or email' }, null, 2)
          }
        ],
        isError: true
      };
    }
    try {
      const user = uid ? uid : (await admin.auth().getUserByEmail(email)).uid;
      await admin.auth().deleteUser(user);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, deleted: user }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseAuthUpdateUser(args) {
    const { uid, updates } = args;
    try {
      const userRecord = await admin.auth().updateUser(uid, updates);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(userRecord, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseAuthSearchUser(args) {
    const { uid, email } = args;
    if (!uid && !email) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'Provide uid or email' }, null, 2)
          }
        ],
        isError: true
      };
    }
    try {
      const userRecord = uid ? await admin.auth().getUser(uid) : await admin.auth().getUserByEmail(email);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(userRecord, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseAuthSetCustomClaims(args) {
    const { uid, claims } = args;
    try {
      await admin.auth().setCustomUserClaims(uid, claims);
      const user = await admin.auth().getUser(uid);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, uid, customClaims: user.customClaims }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseAuthGetCustomClaims(args) {
    const { uid } = args;
    try {
      const user = await admin.auth().getUser(uid);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ uid, customClaims: user.customClaims }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseAuthRemoveCustomClaims(args) {
    const { uid } = args;
    try {
      await admin.auth().setCustomUserClaims(uid, null);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, uid, customClaims: null }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseAuthDisableUser(args) {
    const { uid } = args;
    try {
      await admin.auth().updateUser(uid, { disabled: true });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, uid, disabled: true }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseAuthEnableUser(args) {
    const { uid } = args;
    try {
      await admin.auth().updateUser(uid, { disabled: false });
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, uid, disabled: false }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseAuthSendPasswordReset(args) {
    const { email, redirectUrl } = args;
    try {
      let link = null;
      if (redirectUrl) {
        link = await admin.auth().generatePasswordResetLink(email, { url: redirectUrl });
      } else {
        await admin.auth().sendPasswordResetEmail(email);
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, email, link: link }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseAuthSendEmailVerification(args) {
    const { email, redirectUrl } = args;
    try {
      let link = null;
      if (redirectUrl) {
        link = await admin.auth().generateEmailVerificationLink(email, { url: redirectUrl });
      } else {
        const user = await admin.auth().getUserByEmail(email);
        await admin.auth().updateUser(user.uid, { emailVerified: true });
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, email, link: link }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseAuthBulkCreateUsers(args) {
    const { users } = args;
    const results = [];
    for (const user of users) {
      try {
        const record = await admin.auth().createUser(user);
        results.push({ success: true, uid: record.uid, email: record.email });
      } catch (error) {
        results.push({ success: false, email: user.email, error: error.message });
      }
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ results }, null, 2)
        }
      ]
    };
  }

  async firebaseAuthBulkDeleteUsers(args) {
    const { uids } = args;
    const results = [];
    for (const uid of uids) {
      try {
        await admin.auth().deleteUser(uid);
        results.push({ success: true, uid });
      } catch (error) {
        results.push({ success: false, uid, error: error.message });
      }
    }
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ results }, null, 2)
        }
      ]
    };
  }

  async firebaseAuthExportUsers(args) {
    const { maxResults = 500 } = args;
    try {
      const allUsers = [];
      let pageToken;
      do {
        const list = await admin.auth().listUsers(Math.min(maxResults, 100), pageToken);
        allUsers.push(...list.users);
        pageToken = list.pageToken;
      } while (pageToken && allUsers.length < maxResults);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              users: allUsers.map(user => ({
                uid: user.uid,
                email: user.email,
                displayName: user.displayName,
                disabled: user.disabled,
                emailVerified: user.emailVerified,
                customClaims: user.customClaims,
                metadata: user.metadata
              }))
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  // Firebase Storage helper methods
  getBucket(bucketName) {
    return bucketName ? admin.storage().bucket(bucketName) : admin.storage().bucket();
  }

  async firebaseStorageUploadFile(args) {
    try {
      const { filePath, destination, metadata = {}, contentType, public: isPublic, bucketName } = args;
      const bucket = this.getBucket(bucketName);

      const fileName = destination || path.basename(filePath);
      const file = bucket.file(fileName);

      const options = {
        metadata: {
          ...metadata,
        },
      };

      if (contentType) {
        options.metadata.contentType = contentType;
      }

      const uploadResponse = await bucket.upload(filePath, options);

      if (isPublic) {
        await file.makePublic();
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              fileName,
              size: uploadResponse[0].metadata.size,
              contentType: uploadResponse[0].metadata.contentType,
              publicUrl: isPublic ? `https://storage.googleapis.com/${bucket.name}/${fileName}` : null,
              metadata: uploadResponse[0].metadata,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseStorageUploadFromUrl(args) {
    try {
      const { url, destination, metadata = {}, bucketName } = args;
      const bucket = this.getBucket(bucketName);

      // Download from URL
      const response = await new Promise((resolve, reject) => {
        https.get(url, resolve).on('error', reject);
      });

      const file = bucket.file(destination);
      const stream = file.createWriteStream({
        metadata: metadata,
      });

      response.pipe(stream);

      return new Promise((resolve, reject) => {
        stream.on('finish', () => {
          resolve({
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  destination,
                  url,
                  size: file.metadata?.size,
                }, null, 2)
              }
            ]
          });
        });
        stream.on('error', (error) => {
          resolve({
            content: [
              {
                type: 'text',
                text: JSON.stringify({ error: error.message }, null, 2)
              }
            ],
            isError: true
          });
        });
      });
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseStorageBulkUpload(args) {
    try {
      const { files, bucketName, continueOnError = false } = args;
      const results = [];
      let successCount = 0, errorCount = 0;

      for (const fileConfig of files) {
        try {
          const uploadResult = await this.firebaseStorageUploadFile({
            ...fileConfig,
            bucketName,
          });
          results.push({
            filePath: fileConfig.filePath,
            success: true,
            destination: fileConfig.destination || path.basename(fileConfig.filePath),
          });
          successCount++;
        } catch (error) {
          const errorInfo = {
            filePath: fileConfig.filePath,
            success: false,
            error: error.message,
          };
          results.push(errorInfo);
          errorCount++;
          if (!continueOnError) {
            break;
          }
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              totalFiles: files.length,
              successCount,
              errorCount,
              results,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseStorageDownloadFile(args) {
    try {
      const { source, destination, bucketName } = args;
      const bucket = this.getBucket(bucketName);
      const file = bucket.file(source);

      const localPath = destination || path.join(process.cwd(), path.basename(source));

      await file.download({ destination: localPath });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              source,
              destination: localPath,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseStorageGetDownloadUrl(args) {
    try {
      const { filePath, expiresIn = 3600, bucketName } = args;
      const bucket = this.getBucket(bucketName);
      const file = bucket.file(filePath);

      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + (expiresIn * 1000),
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              filePath,
              downloadUrl: url,
              expiresIn,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseStorageGetFileMetadata(args) {
    try {
      const { filePath, bucketName } = args;
      const bucket = this.getBucket(bucketName);
      const file = bucket.file(filePath);

      const [metadata] = await file.getMetadata();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              filePath,
              metadata,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseStorageDeleteFile(args) {
    try {
      const { filePath, bucketName } = args;
      const bucket = this.getBucket(bucketName);
      const file = bucket.file(filePath);

      await file.delete();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              filePath,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseStorageListFiles(args) {
    try {
      const { prefix = '', maxResults = 100, includePrefixes = false, bucketName } = args;
      const bucket = this.getBucket(bucketName);

      const [files] = await bucket.getFiles({
        prefix,
        maxResults,
        autoPaginate: false,
      });

      const fileList = files.map(file => ({
        name: file.name,
        size: file.metadata.size,
        contentType: file.metadata.contentType,
        updated: file.metadata.updated,
      }));

      let prefixes = [];
      if (includePrefixes) {
        const delimiter = '/';
        const [allFiles] = await bucket.getFiles({
          prefix,
          delimiter,
          autoPaginate: false,
        });
        prefixes = allFiles[1]?.prefixes || [];
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              prefix,
              files: fileList,
              prefixes: includePrefixes ? prefixes : null,
              totalCount: fileList.length,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseStorageMoveFile(args) {
    try {
      const { sourcePath, destinationPath, bucketName } = args;
      const bucket = this.getBucket(bucketName);

      const file = bucket.file(sourcePath);
      const destinationFile = bucket.file(destinationPath);

      await file.move(destinationPath);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              sourcePath,
              destinationPath,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseStorageUpdateMetadata(args) {
    try {
      const { filePath, metadata, bucketName } = args;
      const bucket = this.getBucket(bucketName);
      const file = bucket.file(filePath);

      await file.setMetadata(metadata);

      const [updatedMetadata] = await file.getMetadata();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              filePath,
              metadata: updatedMetadata,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseStorageGetBucketInfo(args) {
    try {
      const { bucketName } = args;
      const bucket = this.getBucket(bucketName);

      const [metadata] = await bucket.getMetadata();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              bucketName: bucket.name,
              metadata,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseStorageCreateBucket(args) {
    try {
      const { bucketName, location = 'US', storageClass = 'STANDARD' } = args;
      const bucket = admin.storage().bucket(bucketName);

      await bucket.create({
        location,
        storageClass,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              bucketName,
              location,
              storageClass,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseStorageBatchOperations(args) {
    try {
      const { operations, bucketName } = args;
      const results = [];

      for (const operation of operations) {
        try {
          const { type, source, destination } = operation;

          if (type === 'delete') {
            await this.firebaseStorageDeleteFile({ filePath: source, bucketName });
            results.push({ success: true, operation: 'delete', source });
          } else if (type === 'copy') {
            const bucket = this.getBucket(bucketName);
            await bucket.file(source).copy(destination);
            results.push({ success: true, operation: 'copy', source, destination });
          } else if (type === 'move') {
            await this.firebaseStorageMoveFile({ sourcePath: source, destinationPath: destination, bucketName });
            results.push({ success: true, operation: 'move', source, destination });
          }
        } catch (error) {
          results.push({
            success: false,
            operation: operation.type,
            source: operation.source,
            error: error.message,
          });
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              totalOperations: operations.length,
              results,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseStorageValidateFile(args) {
    try {
      const { filePath, allowedTypes = [], maxSize, minSize = 0 } = args;

      // Check if file exists and get stats
      const stats = await fs.stat(filePath);

      const fileSize = stats.size;
      const detectedType = mime.lookup(filePath) || 'application/octet-stream';

      const validation = {
        filePath,
        size: fileSize,
        detectedType,
        valid: true,
        reasons: [],
      };

      // Size validation
      if (maxSize && fileSize > maxSize) {
        validation.valid = false;
        validation.reasons.push(`File size ${fileSize} exceeds maximum ${maxSize}`);
      }
      if (fileSize < minSize) {
        validation.valid = false;
        validation.reasons.push(`File size ${fileSize} below minimum ${minSize}`);
      }

      // Type validation
      if (allowedTypes.length > 0 && !allowedTypes.includes(detectedType)) {
        validation.valid = false;
        validation.reasons.push(`File type ${detectedType} not in allowed types: ${allowedTypes.join(', ')}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              validation,
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: error.message }, null, 2)
          }
        ],
        isError: true
      };
    }
  }

  async firebaseAuthImportUsers(args) {
    // Import is same as bulk create for simplicity, assuming clear passwords
    return this.firebaseAuthBulkCreateUsers(args);
  }

  async getProjectInfoResource() {
    try {
      const firebaseJson = await fs.readFile('firebase.json', 'utf8');
      const config = JSON.parse(firebaseJson);

      return {
        contents: [
          {
            uri: 'firebase://project/info',
            mimeType: 'application/json',
            text: JSON.stringify({
              firebase: config,
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: 'firebase://project/info',
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

  async getFunctionsListResource() {
    try {
      const functionsConfig = await fs.readFile('functions/package.json', 'utf8');
      const packageJson = JSON.parse(functionsConfig);

      return {
        contents: [
          {
            uri: 'firebase://functions/list',
            mimeType: 'application/json',
            text: JSON.stringify({
              functions: packageJson.dependencies || {},
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: 'firebase://functions/list',
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

  async getFirestoreSchemaResource() {
    try {
      const rules = await fs.readFile('firestore.rules', 'utf8');

      return {
        contents: [
          {
            uri: 'firebase://firestore/schema',
            mimeType: 'application/json',
            text: JSON.stringify({
              schema: 'firestore.rules content available',
              rules_preview: rules.substring(0, 500) + '...',
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri: 'firebase://firestore/schema',
            mimeType: 'application/json',
            text: JSON.stringify({
              error: error.message,
              timestamp: new Date().toISOString(),
            }, null, 2),
          },
        ],
      };
    }

    // Firebase Hosting Methods
  }

  async firebaseHostingDeploy(args = {}) {
    try {
      const { target, message, project, only = 'hosting', public: publicDir } = args;

      let command = `firebase deploy --only ${only}`;
      if (project) command += ` --project=${project}`;
      if (target) command += ` --target=${target}`;
      if (message) command += ` --message="${message}"`;
      if (publicDir) command += ` --public=${publicDir}`;

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Hosting deployment successful:\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Deployment failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingDeployChannel(args = {}) {
    try {
      const { channel, expires, message, target, project, public: publicDir } = args;

      let command = `firebase hosting:channel:deploy ${channel}`;
      if (expires) command += ` --expires=${expires}`;
      if (message) command += ` --message="${message}"`;
      if (target) command += ` --target=${target}`;
      if (project) command += ` --project=${project}`;
      if (publicDir) command += ` --public=${publicDir}`;

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Channel deployment successful:\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Channel deployment failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingDeployTarget(args = {}) {
    try {
      const { target, message, project, public: publicDir, expires } = args;

      let command = `firebase hosting:target:deploy ${target}`;
      if (message) command += ` --message="${message}"`;
      if (project) command += ` --project=${project}`;
      if (publicDir) command += ` --public=${publicDir}`;
      if (expires) command += ` --expires=${expires}`;

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 10,
      });

      return {
        content: [
          {
            type: 'text',
            text: `Target deployment successful:\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Target deployment failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingListSites(args = {}) {
    try {
      const { project } = args;

      let command = 'firebase hosting:sites:list --json';
      if (project) command += ` --project=${project}`;

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      return {
        content: [
          {
            type: 'text',
            text: `Hosted sites:\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list sites: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingListChannels(args = {}) {
    try {
      const { target, project } = args;

      let command = 'firebase hosting:channel:list --json';
      if (target) command += ` --target=${target}`;
      if (project) command += ` --project=${project}`;

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      return {
        content: [
          {
            type: 'text',
            text: `Preview channels:\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list channels: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingDeleteChannel(args = {}) {
    try {
      const { channel, target, project, force = false } = args;

      let command = `firebase hosting:channel:delete ${channel}`;
      if (target) command += ` --target=${target}`;
      if (project) command += ` --project=${project}`;
      if (force) command += ' --force';

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      return {
        content: [
          {
            type: 'text',
            text: `Channel deleted successfully:\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to delete channel: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingGetConfig(args = {}) {
    try {
      const { project } = args;

      let command = 'firebase hosting:config:get --json';
      if (project) command += ` --project=${project}`;

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      return {
        content: [
          {
            type: 'text',
            text: `Hosting configuration:\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get config: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingDomainsList(args = {}) {
    try {
      const { target, project } = args;

      let command = 'firebase hosting:domains:list --json';
      if (target) command += ` --target=${target}`;
      if (project) command += ` --project=${project}`;

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      return {
        content: [
          {
            type: 'text',
            text: `Custom domains:\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list domains: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingDomainsAdd(args = {}) {
    try {
      const { domain, target, project } = args;

      let command = `firebase hosting:domains:add ${domain}`;
      if (target) command += ` --target=${target}`;
      if (project) command += ` --project=${project}`;

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      return {
        content: [
          {
            type: 'text',
            text: `Domain added successfully:\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to add domain: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingDomainsDelete(args = {}) {
    try {
      const { domain, target, project } = args;

      let command = `firebase hosting:domains:delete ${domain}`;
      if (target) command += ` --target=${target}`;
      if (project) command += ` --project=${project}`;

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      return {
        content: [
          {
            type: 'text',
            text: `Domain deleted successfully:\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to delete domain: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingInit(args = {}) {
    try {
      const { project, public: publicDir = 'public', spa = true } = args;

      let command = 'firebase init hosting';
      if (project) command += ` --project=${project}`;
      if (spa) command += ' --spa';

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
        input: `${publicDir}\n`, // Provide public directory as input
      });

      return {
        content: [
          {
            type: 'text',
            text: `Hosting initialized successfully:\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to initialize hosting: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingStatus(args = {}) {
    try {
      const { target, project } = args;

      let command = 'firebase hosting:sites:list --json';
      if (target) command += ` --target=${target}`;
      if (project) command += ` --project=${project}`;

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      const status = JSON.parse(output);
      return {
        content: [
          {
            type: 'text',
            text: `Hosting status:\n${JSON.stringify(status, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get hosting status: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingServe(args = {}) {
    try {
      const { port = 5000, target, project, host = 'localhost' } = args;

      let command = `firebase serve --port=${port} --host=${host} --only=hosting`;
      if (target) command += ` --target=${target}`;
      if (project) command += ` --project=${project}`;

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      return {
        content: [
          {
            type: 'text',
            text: `Hosting server started on http://${host}:${port}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to start server: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingRewriteList(args = {}) {
    try {
      // Rewrites are in firebase.json, read the file
      const firebaseJson = await fs.readFile('firebase.json', 'utf8');
      const config = JSON.parse(firebaseJson);
      const hosting = config.hosting || [];

      const rewrites = hosting.flatMap(site =>
        site.rewrites ? site.rewrites.map(r => ({ target: site.target, ...r })) : []
      );

      return {
        content: [
          {
            type: 'text',
            text: `URL rewrites and redirects:\n${JSON.stringify(rewrites, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list rewrites: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingRewriteAdd(args = {}) {
    try {
      const { source, destination, type, target, project } = args;

      // Read firebase.json
      const firebaseJson = await fs.readFile('firebase.json', 'utf8');
      const config = JSON.parse(firebaseJson);
      if (!config.hosting) config.hosting = [{}];
      if (!config.hosting[0].rewrites) config.hosting[0].rewrites = [];

      const rewrite = { source };
      if (type === 'redirect') {
        rewrite.redirect = destination;
      } else {
        rewrite.rewrite = destination;
      }

      config.hosting[0].rewrites.push(rewrite);

      // Write back
      await fs.writeFile('firebase.json', JSON.stringify(config, null, 2), 'utf8');

      return {
        content: [
          {
            type: 'text',
            text: `Rewrite added successfully: ${JSON.stringify(rewrite, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to add rewrite: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingHeadersAdd(args = {}) {
    try {
      const { source, headers, target, project } = args;

      // Read firebase.json
      const firebaseJson = await fs.readFile('firebase.json', 'utf8');
      const config = JSON.parse(firebaseJson);
      if (!config.hosting) config.hosting = [{}];
      if (!config.hosting[0].headers) config.hosting[0].headers = [];

      config.hosting[0].headers.push({ source, headers });

      // Write back
      await fs.writeFile('firebase.json', JSON.stringify(config, null, 2), 'utf8');

      return {
        content: [
          {
            type: 'text',
            text: `Headers added successfully for ${source}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to add headers: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async firebaseHostingSSLCertificates(args = {}) {
    try {
      const { action, domain, target, project } = args;

      let command;
      if (action === 'list') {
        command = 'firebase hosting:ssl:list --json';
      } else if (action === 'provision') {
        command = `firebase hosting:ssl:create --domain=${domain}`;
      } else if (action === 'delete') {
        command = `firebase hosting:ssl:delete --domain=${domain}`;
      } else {
        throw new Error('Invalid action for SSL certificates');
      }

      if (target) command += ` --target=${target}`;
      if (project) command += ` --project=${project}`;

      const output = execSync(command, {
        cwd: process.cwd(),
        encoding: 'utf8',
      });

      return {
        content: [
          {
            type: 'text',
            text: `SSL certificate ${action} completed:\n${output}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `SSL certificate operation failed: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Firebase MCP server started');
  }
}