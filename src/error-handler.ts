import { ErrorCode, PowerError, RetryOptions } from './types.js';
import type { Logger } from './logger.js';

/**
 * Sleep for a specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay.
 * Formula: min(initialBackoffMs * 2^(attempt-1), maxBackoffMs)
 */
export function calculateBackoff(attempt: number, options: RetryOptions): number {
  return Math.min(options.initialBackoffMs * Math.pow(2, attempt - 1), options.maxBackoffMs);
}

/**
 * Determine if an error is retryable (transient).
 */
export function isRetryable(error: unknown): boolean {
  if (error instanceof PowerError) {
    return error.retryable;
  }

  if (isHttpError(error)) {
    const status = getHttpStatus(error);
    return status === 429 || status >= 500;
  }

  if (isNetworkError(error)) {
    return true;
  }

  return false;
}

/**
 * Check if error is an HTTP error with a status code.
 */
function isHttpError(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as Record<string, unknown>).status === 'number'
  );
}

/**
 * Extract HTTP status code from error.
 */
function getHttpStatus(error: unknown): number {
  return (error as Record<string, number>).status;
}

/**
 * Check if error is a network-level error (timeout, DNS, connection refused).
 */
function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    const code = (error as NodeJS.ErrnoException).code;
    return (
      code === 'ECONNREFUSED' ||
      code === 'ECONNRESET' ||
      code === 'ETIMEDOUT' ||
      code === 'ENOTFOUND' ||
      code === 'UND_ERR_CONNECT_TIMEOUT' ||
      error.message.includes('timeout')
    );
  }
  return false;
}

/**
 * Transform a raw error into a user-safe PowerError.
 * Never exposes internal details, always provides remediation.
 */
export function transformError(error: unknown): PowerError {
  if (error instanceof PowerError) {
    return error;
  }

  if (isHttpError(error)) {
    return mapHttpError(error);
  }

  if (isNetworkError(error)) {
    return new PowerError(
      ErrorCode.NETWORK_UNREACHABLE,
      'Unable to reach GitHub API. Check your network connection.',
      'Verify internet connectivity and try again',
      true
    );
  }

  // Unknown error — generic message
  return new PowerError(
    ErrorCode.UNKNOWN,
    'An unexpected error occurred',
    'Check logs for details',
    false
  );
}

/**
 * Map HTTP status codes to appropriate PowerError instances.
 */
function mapHttpError(error: unknown): PowerError {
  const status = getHttpStatus(error);

  switch (status) {
    case 401:
      return new PowerError(
        ErrorCode.AUTH_EXPIRED,
        'Authentication failed. Your token may be expired or invalid.',
        'Regenerate your GitHub token and update the environment variable',
        false
      );
    case 403:
      return new PowerError(
        ErrorCode.SCOPE_MISSING,
        'Insufficient permissions. Your token lacks required scopes.',
        'Ensure your token has "repo" and "project" scopes',
        false
      );
    case 404:
      return new PowerError(
        ErrorCode.REPO_NOT_FOUND,
        'Repository not found or not accessible.',
        'Verify the repository name (owner/repo) and your access permissions',
        false
      );
    case 422:
      return new PowerError(
        ErrorCode.VALIDATION_FAILED,
        'Request validation failed. The input data is invalid.',
        'Check the request parameters and try again',
        false
      );
    case 429:
      return new PowerError(
        ErrorCode.RATE_LIMITED,
        'GitHub API rate limit exceeded.',
        'Wait for the rate limit to reset and try again',
        true
      );
    default:
      if (status >= 500) {
        return new PowerError(
          ErrorCode.SERVER_ERROR,
          'GitHub API server error. This is usually temporary.',
          'Wait a moment and try again',
          true
        );
      }
      return new PowerError(
        ErrorCode.UNKNOWN,
        'An unexpected API error occurred',
        'Check logs for details',
        false
      );
  }
}

/**
 * Execute an operation with retry logic and exponential backoff.
 * Only retries on transient errors (rate limits, server errors, network issues).
 * Non-retryable errors fail immediately.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions,
  logger?: Logger
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (!isRetryable(error)) {
        throw transformError(error);
      }

      if (attempt < options.maxRetries) {
        const delay = calculateBackoff(attempt, options);
        logger?.warn(
          `Retry attempt ${attempt}/${options.maxRetries}, waiting ${delay}ms`,
          { attempt, delay, correlationId: options.correlationId }
        );
        await sleep(delay);
      }
    }
  }

  throw transformError(lastError);
}

/**
 * Setup global error handlers for uncaught exceptions and unhandled rejections.
 * Ensures the process fails closed — never continues in an uncertain state.
 */
export function setupGlobalErrorHandler(logger: Logger): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught exception — halting operation', {
      error: error.message,
      stack: error.stack,
    });
  });

  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled rejection — halting operation', {
      reason: String(reason),
    });
  });
}
