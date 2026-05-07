import {
  withRetry,
  isRetryable,
  calculateBackoff,
  transformError,
  sleep,
} from '../src/error-handler.js';
import { ErrorCode, PowerError } from '../src/types.js';

describe('Error Handler', () => {
  describe('calculateBackoff', () => {
    const options = { maxRetries: 3, initialBackoffMs: 1000, maxBackoffMs: 30000 };

    it('should calculate exponential backoff correctly', () => {
      expect(calculateBackoff(1, options)).toBe(1000);
      expect(calculateBackoff(2, options)).toBe(2000);
      expect(calculateBackoff(3, options)).toBe(4000);
    });

    it('should cap at maxBackoffMs', () => {
      const smallMax = { ...options, maxBackoffMs: 3000 };
      expect(calculateBackoff(3, smallMax)).toBe(3000);
    });
  });

  describe('isRetryable', () => {
    it('should return true for rate limit errors (429)', () => {
      expect(isRetryable({ status: 429 })).toBe(true);
    });

    it('should return true for server errors (5xx)', () => {
      expect(isRetryable({ status: 500 })).toBe(true);
      expect(isRetryable({ status: 503 })).toBe(true);
    });

    it('should return false for auth errors (401)', () => {
      expect(isRetryable({ status: 401 })).toBe(false);
    });

    it('should return false for not found (404)', () => {
      expect(isRetryable({ status: 404 })).toBe(false);
    });

    it('should return true for network errors', () => {
      const error = new Error('connect ECONNREFUSED');
      (error as NodeJS.ErrnoException).code = 'ECONNREFUSED';
      expect(isRetryable(error)).toBe(true);
    });

    it('should return true for timeout errors', () => {
      const error = new Error('request timeout');
      (error as NodeJS.ErrnoException).code = 'ETIMEDOUT';
      expect(isRetryable(error)).toBe(true);
    });

    it('should return true for retryable PowerError', () => {
      const error = new PowerError(ErrorCode.RATE_LIMITED, 'rate limited', undefined, true);
      expect(isRetryable(error)).toBe(true);
    });

    it('should return false for non-retryable PowerError', () => {
      const error = new PowerError(ErrorCode.AUTH_INVALID, 'invalid', undefined, false);
      expect(isRetryable(error)).toBe(false);
    });
  });

  describe('transformError', () => {
    it('should return PowerError as-is', () => {
      const original = new PowerError(ErrorCode.AUTH_EXPIRED, 'expired');
      expect(transformError(original)).toBe(original);
    });

    it('should map 401 to AUTH_EXPIRED', () => {
      const result = transformError({ status: 401 });
      expect(result).toBeInstanceOf(PowerError);
      expect(result.code).toBe(ErrorCode.AUTH_EXPIRED);
    });

    it('should map 403 to SCOPE_MISSING', () => {
      const result = transformError({ status: 403 });
      expect(result.code).toBe(ErrorCode.SCOPE_MISSING);
    });

    it('should map 404 to REPO_NOT_FOUND', () => {
      const result = transformError({ status: 404 });
      expect(result.code).toBe(ErrorCode.REPO_NOT_FOUND);
    });

    it('should map 429 to RATE_LIMITED with retryable=true', () => {
      const result = transformError({ status: 429 });
      expect(result.code).toBe(ErrorCode.RATE_LIMITED);
      expect(result.retryable).toBe(true);
    });

    it('should map network errors to NETWORK_UNREACHABLE', () => {
      const error = new Error('timeout');
      (error as NodeJS.ErrnoException).code = 'ETIMEDOUT';
      const result = transformError(error);
      expect(result.code).toBe(ErrorCode.NETWORK_UNREACHABLE);
    });

    it('should map unknown errors to UNKNOWN', () => {
      const result = transformError(new Error('something weird'));
      expect(result.code).toBe(ErrorCode.UNKNOWN);
    });

    it('should never expose sensitive data in error messages', () => {
      const result = transformError({ status: 401 });
      expect(result.message).not.toContain('ghp_');
      expect(result.message).not.toMatch(/ghp_[a-zA-Z0-9]+/);
    });
  });

  describe('withRetry', () => {
    it('should return result on first success', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await withRetry(operation, {
        maxRetries: 3,
        initialBackoffMs: 10,
        maxBackoffMs: 100,
      });
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on transient error and succeed', async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce({ status: 500 })
        .mockResolvedValue('success');

      const result = await withRetry(operation, {
        maxRetries: 3,
        initialBackoffMs: 10,
        maxBackoffMs: 100,
      });
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should throw immediately on non-retryable error', async () => {
      const operation = jest.fn().mockRejectedValue({ status: 401 });

      await expect(
        withRetry(operation, { maxRetries: 3, initialBackoffMs: 10, maxBackoffMs: 100 })
      ).rejects.toThrow(PowerError);
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should throw after exhausting retries', async () => {
      const operation = jest.fn().mockRejectedValue({ status: 500 });

      await expect(
        withRetry(operation, { maxRetries: 3, initialBackoffMs: 10, maxBackoffMs: 100 })
      ).rejects.toThrow(PowerError);
      expect(operation).toHaveBeenCalledTimes(3);
    });
  });

  describe('sleep', () => {
    it('should resolve after specified time', async () => {
      const start = Date.now();
      await sleep(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(40);
    });
  });
});
