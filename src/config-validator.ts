import { z } from 'zod';

const PatConfigSchema = z.object({
  type: z.literal('pat'),
  tokenEnvVar: z.string().min(1, 'Token environment variable name is required'),
});

const PowerConfigSchema = z.object({
  authType: z.enum(['pat', 'github-app']),
  authConfig: PatConfigSchema,
  repository: z.string().regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, 'Repository must be in format owner/repo'),
});

export interface ConfigValidationError {
  field: string;
  message: string;
  category: 'auth' | 'repository' | 'hooks' | 'sync';
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigValidationError[];
}

function categorizeField(field: string): 'auth' | 'repository' | 'hooks' | 'sync' {
  if (field.startsWith('authType') || field.startsWith('authConfig')) return 'auth';
  if (field.startsWith('repository')) return 'repository';
  if (field.startsWith('hooks')) return 'hooks';
  return 'sync';
}

export function validateConfig(raw: unknown): ConfigValidationResult {
  const result = PowerConfigSchema.safeParse(raw);

  if (result.success) {
    return { valid: true, errors: [] };
  }

  const errors: ConfigValidationError[] = result.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
    category: categorizeField(issue.path[0]?.toString() ?? ''),
  }));

  return { valid: false, errors };
}
