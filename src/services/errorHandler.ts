export enum ErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  PERMISSION_ERROR = 'PERMISSION_ERROR',
  NOT_FOUND_ERROR = 'NOT_FOUND_ERROR',
  FIREBASE_ERROR = 'FIREBASE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface AppError {
  type: ErrorType;
  code: string;
  message: string;
  userMessage: string;
  originalError?: Error | any;
  statusCode?: number;
  timestamp: string;
  context?: Record<string, any>;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorMappings: Map<string, { type: ErrorType; userMessage: string }>;

  constructor() {
    this.errorMappings = new Map([
      // Firebase Auth errors
      ['auth/user-not-found', { type: ErrorType.AUTHENTICATION_ERROR, userMessage: 'Account not found. Please check your email.' }],
      ['auth/wrong-password', { type: ErrorType.AUTHENTICATION_ERROR, userMessage: 'Incorrect password. Please try again.' }],
      ['auth/email-already-in-use', { type: ErrorType.VALIDATION_ERROR, userMessage: 'This email is already registered.' }],
      ['auth/weak-password', { type: ErrorType.VALIDATION_ERROR, userMessage: 'Password is too weak. Please choose a stronger password.' }],
      ['auth/invalid-email', { type: ErrorType.VALIDATION_ERROR, userMessage: 'Please enter a valid email address.' }],
      ['auth/user-disabled', { type: ErrorType.AUTHENTICATION_ERROR, userMessage: 'Your account has been disabled.' }],
      ['auth/too-many-requests', { type: ErrorType.AUTHENTICATION_ERROR, userMessage: 'Too many failed attempts. Please try again later.' }],
      ['auth/operation-not-allowed', { type: ErrorType.PERMISSION_ERROR, userMessage: 'This operation is not allowed.' }],

      // Firestore errors
      ['permission-denied', { type: ErrorType.PERMISSION_ERROR, userMessage: 'You don\'t have permission to perform this action.' }],
      ['not-found', { type: ErrorType.NOT_FOUND_ERROR, userMessage: 'The requested data was not found.' }],
      ['cancelled', { type: ErrorType.UNKNOWN_ERROR, userMessage: 'The operation was cancelled.' }],

      // Network errors
      ['network-request-failed', { type: ErrorType.NETWORK_ERROR, userMessage: 'Network connection failed. Please check your internet connection.' }],
      ['unavailable', { type: ErrorType.NETWORK_ERROR, userMessage: 'Service is temporarily unavailable. Please try again later.' }],
    ]);
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  createError(
    type: ErrorType,
    code: string,
    message: string,
    userMessage?: string,
    originalError?: Error | any,
    statusCode?: number,
    context?: Record<string, any>
  ): AppError {
    const error: AppError = {
      type,
      code,
      message,
      userMessage: userMessage || message,
      originalError,
      statusCode,
      timestamp: new Date().toISOString(),
      context,
    };

    // Log error for debugging
    console.error('[ErrorHandler]', {
      type: error.type,
      code: error.code,
      message: error.message,
      context: error.context,
      originalError: error.originalError,
    });

    return error;
  }

  handleFirebaseError(error: any, context?: Record<string, any>): AppError {
    const errorCode = error.code || 'unknown-error';
    const mapping = this.errorMappings.get(errorCode);

    if (mapping) {
      return this.createError(
        mapping.type,
        errorCode,
        error.message || 'Firebase operation failed',
        mapping.userMessage,
        error,
        undefined,
        context
      );
    }

    return this.createError(
      ErrorType.FIREBASE_ERROR,
      errorCode,
      error.message || 'Firebase operation failed',
      'An unexpected error occurred. Please try again.',
      error,
      undefined,
      context
    );
  }

  handleNetworkError(error: any, context?: Record<string, any>): AppError {
    return this.createError(
      ErrorType.NETWORK_ERROR,
      'network-error',
      error.message || 'Network request failed',
      'Unable to connect. Please check your internet connection and try again.',
      error,
      undefined,
      context
    );
  }

  handleValidationError(field: string, message: string, context?: Record<string, any>): AppError {
    return this.createError(
      ErrorType.VALIDATION_ERROR,
      'validation-error',
      `Validation failed for ${field}: ${message}`,
      message,
      undefined,
      400,
      { ...context, field }
    );
  }

  handleGenericError(error: any, context?: Record<string, any>): AppError {
    if (error.code && typeof error.code === 'string') {
      return this.handleFirebaseError(error, context);
    }

    if (error.message && error.message.includes('network')) {
      return this.handleNetworkError(error, context);
    }

    return this.createError(
      ErrorType.UNKNOWN_ERROR,
      'unknown-error',
      error.message || 'An unexpected error occurred',
      'Something went wrong. Please try again or contact support if the problem persists.',
      error,
      undefined,
      context
    );
  }

  // Utility method to check if error is retryable
  isRetryable(error: AppError): boolean {
    return (
      error.type === ErrorType.NETWORK_ERROR ||
      error.type === ErrorType.UNKNOWN_ERROR ||
      (error.statusCode !== undefined && error.statusCode >= 500)
    );
  }

  // Utility method to get user-friendly error message
  getUserMessage(error: AppError): string {
    return error.userMessage || 'An unexpected error occurred.';
  }

  // Utility method to log errors for analytics/monitoring
  logError(error: AppError): void {
    // In a production app, you might want to send this to an error reporting service
    console.error('[Error Logged]', {
      type: error.type,
      code: error.code,
      timestamp: error.timestamp,
      context: error.context,
    });
  }
}

// Convenience functions for common error types
export const errorHandler = ErrorHandler.getInstance();

export const createNetworkError = (message: string, context?: Record<string, any>): AppError => {
  return errorHandler.createError(
    ErrorType.NETWORK_ERROR,
    'network-error',
    message,
    'Network connection failed. Please check your internet and try again.',
    undefined,
    undefined,
    context
  );
};

export const createAuthenticationError = (message: string, context?: Record<string, any>): AppError => {
  return errorHandler.createError(
    ErrorType.AUTHENTICATION_ERROR,
    'auth-error',
    message,
    'Authentication failed. Please sign in again.',
    undefined,
    401,
    context
  );
};

export const createValidationError = (field: string, message: string, context?: Record<string, any>): AppError => {
  return errorHandler.handleValidationError(field, message, context);
};