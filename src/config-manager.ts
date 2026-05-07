import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  PowerConfig,
  PowerConfigSchema,
  ErrorCode,
  PowerError,
  ValidationResult,
  TokenValidation,
  DEFAULT_LABELS,
  DEFAULT_RETRY_CONFIG,
} from './types.js';
import type { Logger } from './logger.js';

const CONFIG_PATH = 'github-power/config.json';
const SYNC_STATE_PATH = 'github-power/sync-state.json';
const LOGS_DIR = 'github-power/logs';

/**
 * Configuration Manager — handles loading, validation, guided setup, and credential isolation.
 * Security-critical logic (token retrieval, validation) is isolated in this module.
 */
export class ConfigManager {
  private config: PowerConfig | null = null;
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  /**
   * Load and validate configuration from file.
   * Returns validated PowerConfig or throws PowerError.
   */
  loadConfig(): PowerConfig {
    if (this.config) return this.config;

    if (!fs.existsSync(CONFIG_PATH)) {
      throw new PowerError(
        ErrorCode.CONFIG_MISSING_FIELD,
        'Configuration file not found. Run guided setup first.',
        'Use the guided_setup tool to configure the GitHub Power'
      );
    }

    let raw: unknown;
    try {
      const content = fs.readFileSync(CONFIG_PATH, 'utf-8');
      raw = JSON.parse(content);
    } catch (error) {
      throw new PowerError(
        ErrorCode.CONFIG_INVALID,
        'Configuration file is malformed or unreadable.',
        'Check github-power/config.json for JSON syntax errors'
      );
    }

    const result = this.validateConfig(raw);
    if (!result.valid) {
      const errorMessages = result.errors.map((e) => `${e.field}: ${e.message}`).join('; ');
      throw new PowerError(
        ErrorCode.CONFIG_INVALID,
        `Configuration validation failed: ${errorMessages}`,
        'Fix the configuration errors in github-power/config.json'
      );
    }

    this.config = PowerConfigSchema.parse(raw) as PowerConfig;
    this.logger.info('Configuration loaded successfully', { repository: this.config.repository });
    return this.config;
  }

  /**
   * Validate raw configuration data against the Zod schema.
   */
  validateConfig(raw: unknown): ValidationResult {
    const result = PowerConfigSchema.safeParse(raw);

    if (result.success) {
      return { valid: true, errors: [], warnings: [] };
    }

    return {
      valid: false,
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
        code: ErrorCode.CONFIG_INVALID,
      })),
      warnings: [],
    };
  }

  /**
   * Retrieve the GitHub token from environment variable.
   * Credential isolation: token is ONLY accessed here, never stored in state or logs.
   */
  getToken(): string {
    const config = this.loadConfig();

    if (config.authConfig.type !== 'pat') {
      throw new PowerError(
        ErrorCode.AUTH_INVALID,
        'GitHub App authentication not yet implemented',
        'Use PAT authentication for now'
      );
    }

    const envVar = config.authConfig.tokenEnvVar;
    const token = process.env[envVar];

    if (!token || token.trim() === '') {
      throw new PowerError(
        ErrorCode.AUTH_INVALID,
        `Environment variable "${envVar}" is not set or empty.`,
        `Set the environment variable: export ${envVar}=ghp_your_token_here`
      );
    }

    return token;
  }

  /**
   * Validate token has required scopes by calling GitHub API.
   * Placeholder — actual API call implemented in Unit 2 with MCP tools.
   */
  async validateToken(_token: string): Promise<TokenValidation> {
    // Placeholder: will be implemented with actual GitHub API call in Unit 2
    return {
      valid: true,
      scopes: ['repo', 'project'],
      missingScopes: [],
    };
  }

  /**
   * Validate repository exists and is accessible.
   * Placeholder — actual API call implemented in Unit 2.
   */
  async validateRepository(_owner: string, _repo: string): Promise<boolean> {
    // Placeholder: will be implemented with actual GitHub API call in Unit 2
    return true;
  }

  /**
   * Execute the 8-step guided setup flow.
   * Returns a complete PowerConfig object ready to be saved.
   */
  runGuidedSetup(answers: GuidedSetupAnswers): PowerConfig {
    const config: PowerConfig = {
      authType: answers.authType,
      authConfig: answers.authConfig,
      repository: answers.repository,
      projectName: answers.projectName,
      labelSet: answers.labelSet ?? DEFAULT_LABELS,
      template: answers.template,
      enableGitHubActions: answers.enableGitHubActions ?? false,
      syncDefaults: answers.syncDefaults ?? { mappingStrategy: 'ask', autoSync: true },
      retryConfig: answers.retryConfig ?? DEFAULT_RETRY_CONFIG,
    };

    // Validate the assembled config
    const validation = this.validateConfig(config);
    if (!validation.valid) {
      throw new PowerError(
        ErrorCode.CONFIG_INVALID,
        'Setup produced invalid configuration',
        'Review your setup answers and try again'
      );
    }

    // Write config atomically
    this.writeConfig(config);
    this.config = config;
    this.logger.info('Guided setup complete', { repository: config.repository });

    return config;
  }

  /**
   * Check if a feature flag is enabled.
   */
  getFeatureFlag(flag: string): boolean {
    const config = this.loadConfig();

    switch (flag) {
      case 'enableGitHubActions':
        return config.enableGitHubActions;
      default:
        return false;
    }
  }

  /**
   * Write configuration to file atomically (write to temp, then rename).
   */
  writeConfig(config: PowerConfig): void {
    this.ensureDirectories();
    const tempPath = `${CONFIG_PATH}.tmp`;
    const content = JSON.stringify(config, null, 2);

    fs.writeFileSync(tempPath, content, 'utf-8');
    fs.renameSync(tempPath, CONFIG_PATH);

    this.logger.info('Configuration saved', { path: CONFIG_PATH });
  }

  /**
   * Ensure required directories exist.
   */
  ensureDirectories(): void {
    const dirs = [
      path.dirname(CONFIG_PATH),
      path.dirname(SYNC_STATE_PATH),
      LOGS_DIR,
    ];

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * Check if configuration exists (for detecting first-time setup).
   */
  hasConfig(): boolean {
    return fs.existsSync(CONFIG_PATH);
  }

  /**
   * Get the repository owner and name from config.
   */
  getRepository(): { owner: string; repo: string } {
    const config = this.loadConfig();
    const [owner, repo] = config.repository.split('/');
    return { owner, repo };
  }
}

/**
 * Input type for guided setup answers.
 */
export interface GuidedSetupAnswers {
  authType: 'pat' | 'github-app';
  authConfig: PowerConfig['authConfig'];
  repository: string;
  projectName?: string;
  labelSet?: PowerConfig['labelSet'];
  template?: string;
  enableGitHubActions?: boolean;
  syncDefaults?: PowerConfig['syncDefaults'];
  retryConfig?: PowerConfig['retryConfig'];
}
