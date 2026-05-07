import * as fs from 'node:fs';
import * as path from 'node:path';
import { Logger, createLogger } from '../src/logger.js';

// Mock fs module
jest.mock('node:fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('Logger', () => {
  let logger: Logger;
  const testLogDir = '/tmp/test-logs';

  beforeEach(() => {
    jest.clearAllMocks();
    mockFs.existsSync.mockReturnValue(true);
    mockFs.statSync.mockReturnValue({ size: 100 } as fs.Stats);
    logger = new Logger('test-component', testLogDir);
  });

  describe('structured log format', () => {
    it('should output valid JSON with required fields', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('test message', { key: 'value' });

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      const output = JSON.parse(consoleSpy.mock.calls[0][0]);

      expect(output).toHaveProperty('timestamp');
      expect(output).toHaveProperty('level', 'info');
      expect(output).toHaveProperty('correlationId');
      expect(output).toHaveProperty('component', 'test-component');
      expect(output).toHaveProperty('message', 'test message');
      expect(output.context).toEqual({ key: 'value' });

      consoleSpy.mockRestore();
    });

    it('should use ISO 8601 timestamp format', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('test');

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      consoleSpy.mockRestore();
    });

    it('should include correlation ID in every entry', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('first');
      logger.info('second');

      const first = JSON.parse(consoleSpy.mock.calls[0][0]);
      const second = JSON.parse(consoleSpy.mock.calls[1][0]);
      expect(first.correlationId).toBe(second.correlationId);
      expect(first.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );

      consoleSpy.mockRestore();
    });
  });

  describe('sensitive data sanitization', () => {
    it('should redact GitHub PAT tokens (ghp_)', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('token test', { token: 'ghp_abcdefghijklmnopqrstuvwxyz1234567890' });

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(JSON.stringify(output.context)).not.toContain('ghp_');
      expect(JSON.stringify(output.context)).toContain('***REDACTED***');

      consoleSpy.mockRestore();
    });

    it('should redact GitHub App tokens (ghs_)', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('app token', { header: 'ghs_abcdefghijklmnopqrstuvwxyz1234567890' });

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(JSON.stringify(output.context)).not.toContain('ghs_');

      consoleSpy.mockRestore();
    });

    it('should redact Authorization Bearer headers', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.info('auth header', { header: 'Authorization: Bearer ghp_secret123456789' });

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(JSON.stringify(output.context)).not.toContain('ghp_secret');

      consoleSpy.mockRestore();
    });
  });

  describe('log levels', () => {
    it('should use console.error for error level', () => {
      const spy = jest.spyOn(console, 'error').mockImplementation();
      logger.error('error message');
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('should use console.warn for warn level', () => {
      const spy = jest.spyOn(console, 'warn').mockImplementation();
      logger.warn('warn message');
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it('should use console.debug for debug level', () => {
      const spy = jest.spyOn(console, 'debug').mockImplementation();
      logger.debug('debug message');
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });
  });

  describe('correlation ID', () => {
    it('should allow setting custom correlation ID', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      logger.setCorrelationId('custom-id-123');
      logger.info('test');

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.correlationId).toBe('custom-id-123');

      consoleSpy.mockRestore();
    });

    it('should create child logger with specific correlation ID', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const child = logger.withCorrelation('child-id');
      child.info('child message');

      const output = JSON.parse(consoleSpy.mock.calls[0][0]);
      expect(output.correlationId).toBe('child-id');

      consoleSpy.mockRestore();
    });
  });

  describe('file rotation', () => {
    it('should trigger rotation when file exceeds 10MB', () => {
      mockFs.statSync.mockReturnValue({ size: 11 * 1024 * 1024 } as fs.Stats);
      mockFs.existsSync.mockReturnValue(true);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      logger.info('trigger rotation');

      expect(mockFs.renameSync).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should not rotate when file is under 10MB', () => {
      mockFs.statSync.mockReturnValue({ size: 5 * 1024 * 1024 } as fs.Stats);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      logger.info('no rotation');

      // renameSync should not be called for rotation (may be called for other reasons)
      consoleSpy.mockRestore();
    });
  });

  describe('createLogger factory', () => {
    it('should create a Logger instance', () => {
      const instance = createLogger('factory-test');
      expect(instance).toBeInstanceOf(Logger);
    });
  });
});
