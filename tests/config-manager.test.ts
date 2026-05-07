import * as fs from 'node:fs';
import { ConfigManager } from '../src/config-manager.js';
import { ErrorCode, PowerError, DEFAULT_LABELS } from '../src/types.js';
import { Logger } from '../src/logger.js';

jest.mock('node:fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('ConfigManager', () => {
  let configManager: ConfigManager;
  let mockLogger: Logger;

  const validConfig = {
    authType: 'pat',
    authConfig: { type: 'pat', tokenEnvVar: 'GITHUB_TOKEN' },
    repository: 'owner/repo',
    projectName: 'My Project',
    labelSet: DEFAULT_LABELS,
    enableGitHubActions: false,
    syncDefaults: { mappingStrategy: 'ask', autoSync: true },
    retryConfig: { maxRetries: 3, initialBackoffMs: 1000, maxBackoffMs: 30000, timeoutMs: 30000 },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as unknown as Logger;
    configManager = new ConfigManager(mockLogger);
  });

  describe('loadConfig', () => {
    it('should load valid configuration successfully', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

      const config = configManager.loadConfig();
      expect(config.repository).toBe('owner/repo');
      expect(config.authType).toBe('pat');
    });

    it('should throw CONFIG_MISSING_FIELD when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => configManager.loadConfig()).toThrow(PowerError);
      try {
        configManager.loadConfig();
      } catch (error) {
        expect((error as PowerError).code).toBe(ErrorCode.CONFIG_MISSING_FIELD);
      }
    });

    it('should throw CONFIG_INVALID for malformed JSON', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('not valid json{{{');

      expect(() => configManager.loadConfig()).toThrow(PowerError);
      try {
        configManager.loadConfig();
      } catch (error) {
        expect((error as PowerError).code).toBe(ErrorCode.CONFIG_INVALID);
      }
    });

    it('should throw CONFIG_INVALID for missing required fields', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify({ authType: 'pat' }));

      expect(() => configManager.loadConfig()).toThrow(PowerError);
    });
  });

  describe('validateConfig', () => {
    it('should return valid for correct config', () => {
      const result = configManager.validateConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid repository format', () => {
      const invalid = { ...validConfig, repository: 'no-slash-here' };
      const result = configManager.validateConfig(invalid);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'repository')).toBe(true);
    });

    it('should reject invalid authType', () => {
      const invalid = { ...validConfig, authType: 'invalid' };
      const result = configManager.validateConfig(invalid);
      expect(result.valid).toBe(false);
    });

    it('should accept config with defaults applied', () => {
      const minimal = {
        authType: 'pat',
        authConfig: { type: 'pat', tokenEnvVar: 'MY_TOKEN' },
        repository: 'user/project',
      };
      const result = configManager.validateConfig(minimal);
      expect(result.valid).toBe(true);
    });
  });

  describe('getToken', () => {
    it('should retrieve token from environment variable', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));
      process.env.GITHUB_TOKEN = 'ghp_test_token_value';

      const token = configManager.getToken();
      expect(token).toBe('ghp_test_token_value');

      delete process.env.GITHUB_TOKEN;
    });

    it('should throw AUTH_INVALID when env var is not set', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));
      delete process.env.GITHUB_TOKEN;

      expect(() => configManager.getToken()).toThrow(PowerError);
      try {
        configManager.getToken();
      } catch (error) {
        expect((error as PowerError).code).toBe(ErrorCode.AUTH_INVALID);
      }
    });

    it('should throw AUTH_INVALID when env var is empty', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));
      process.env.GITHUB_TOKEN = '';

      expect(() => configManager.getToken()).toThrow(PowerError);

      delete process.env.GITHUB_TOKEN;
    });
  });

  describe('getFeatureFlag', () => {
    it('should return false for enableGitHubActions when disabled', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

      expect(configManager.getFeatureFlag('enableGitHubActions')).toBe(false);
    });

    it('should return true for enableGitHubActions when enabled', () => {
      const enabledConfig = { ...validConfig, enableGitHubActions: true };
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(enabledConfig));

      expect(configManager.getFeatureFlag('enableGitHubActions')).toBe(true);
    });

    it('should return false for unknown flags', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(JSON.stringify(validConfig));

      expect(configManager.getFeatureFlag('unknownFlag')).toBe(false);
    });
  });

  describe('writeConfig', () => {
    it('should write config atomically (temp + rename)', () => {
      mockFs.existsSync.mockReturnValue(true);

      configManager.writeConfig(validConfig as any);

      expect(mockFs.writeFileSync).toHaveBeenCalledWith(
        'github-power/config.json.tmp',
        expect.any(String),
        'utf-8'
      );
      expect(mockFs.renameSync).toHaveBeenCalledWith(
        'github-power/config.json.tmp',
        'github-power/config.json'
      );
    });
  });

  describe('hasConfig', () => {
    it('should return true when config file exists', () => {
      mockFs.existsSync.mockReturnValue(true);
      expect(configManager.hasConfig()).toBe(true);
    });

    it('should return false when config file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);
      expect(configManager.hasConfig()).toBe(false);
    });
  });
});
