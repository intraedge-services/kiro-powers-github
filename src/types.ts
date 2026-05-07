import { z } from 'zod';

// ============================================================
// Error Codes
// ============================================================

export enum ErrorCode {
  AUTH_EXPIRED = 'AUTH_EXPIRED',
  AUTH_INVALID = 'AUTH_INVALID',
  SCOPE_MISSING = 'SCOPE_MISSING',
  RATE_LIMITED = 'RATE_LIMITED',
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',
  NETWORK_UNREACHABLE = 'NETWORK_UNREACHABLE',
  REPO_NOT_FOUND = 'REPO_NOT_FOUND',
  CONFIG_INVALID = 'CONFIG_INVALID',
  CONFIG_MISSING_FIELD = 'CONFIG_MISSING_FIELD',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  SERVER_ERROR = 'SERVER_ERROR',
  UNKNOWN = 'UNKNOWN',
}

// ============================================================
// Error Class
// ============================================================

export class PowerError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly remediation?: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'PowerError';
  }
}

// ============================================================
// Log Types
// ============================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  correlationId: string;
  component: string;
  message: string;
  context?: Record<string, unknown>;
}

// ============================================================
// Configuration Types
// ============================================================

export interface PatConfig {
  type: 'pat';
  tokenEnvVar: string;
}

export interface GitHubAppConfig {
  type: 'github-app';
  appId: string;
  installationId: string;
  privateKeyPath: string;
}

export type AuthConfig = PatConfig | GitHubAppConfig;

export interface LabelDefinition {
  name: string;
  color: string;
  description: string;
}

export interface SyncDefaults {
  mappingStrategy: 'milestones' | 'labels' | 'custom-fields' | 'ask';
  autoSync: boolean;
}

export interface RetryConfig {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  timeoutMs: number;
}

export interface PowerConfig {
  authType: 'pat' | 'github-app';
  authConfig: AuthConfig;
  repository: string;
  projectName?: string;
  projectId?: string;
  labelSet: LabelDefinition[];
  template?: string;
  enableGitHubActions: boolean;
  syncDefaults: SyncDefaults;
  retryConfig: RetryConfig;
}

// ============================================================
// Validation Types
// ============================================================

export interface TokenValidation {
  valid: boolean;
  scopes: string[];
  missingScopes: string[];
  username?: string;
  expiresAt?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: ErrorCode;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

// ============================================================
// Retry Types
// ============================================================

export interface RetryOptions {
  maxRetries: number;
  initialBackoffMs: number;
  maxBackoffMs: number;
  correlationId?: string;
}

// ============================================================
// Zod Schemas
// ============================================================

export const PowerConfigSchema = z.object({
  authType: z.enum(['pat', 'github-app']),
  authConfig: z.discriminatedUnion('type', [
    z.object({
      type: z.literal('pat'),
      tokenEnvVar: z.string().min(1, 'Token environment variable name is required'),
    }),
    z.object({
      type: z.literal('github-app'),
      appId: z.string().min(1, 'App ID is required'),
      installationId: z.string().min(1, 'Installation ID is required'),
      privateKeyPath: z.string().min(1, 'Private key path is required'),
    }),
  ]),
  repository: z
    .string()
    .regex(
      /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/,
      'Repository must be in format owner/repo'
    ),
  projectName: z.string().optional(),
  projectId: z.string().optional(),
  labelSet: z
    .array(
      z.object({
        name: z.string().min(1),
        color: z.string().regex(/^[0-9a-fA-F]{6}$/, 'Color must be 6-digit hex'),
        description: z.string(),
      })
    )
    .default([]),
  template: z.string().optional(),
  enableGitHubActions: z.boolean().default(false),
  syncDefaults: z
    .object({
      mappingStrategy: z.enum(['milestones', 'labels', 'custom-fields', 'ask']).default('ask'),
      autoSync: z.boolean().default(true),
    })
    .default({}),
  retryConfig: z
    .object({
      maxRetries: z.number().int().min(1).max(10).default(3),
      initialBackoffMs: z.number().int().min(100).max(10000).default(1000),
      maxBackoffMs: z.number().int().min(1000).max(60000).default(30000),
      timeoutMs: z.number().int().min(5000).max(120000).default(30000),
    })
    .default({}),
});

// ============================================================
// Default Constants
// ============================================================

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialBackoffMs: 1000,
  maxBackoffMs: 30000,
  timeoutMs: 30000,
};

export const DEFAULT_LABELS: LabelDefinition[] = [
  { name: 'epic', color: '7057ff', description: 'Epic-level work item' },
  { name: 'story', color: '0075ca', description: 'User story' },
  { name: 'task', color: '008672', description: 'Implementation task' },
  { name: 'bug', color: 'd73a4a', description: 'Bug report' },
  { name: 'enhancement', color: 'a2eeef', description: 'Enhancement request' },
  { name: 'priority-high', color: 'b60205', description: 'High priority' },
  { name: 'priority-medium', color: 'fbca04', description: 'Medium priority' },
  { name: 'priority-low', color: '0e8a16', description: 'Low priority' },
];
