import { validateConfig } from '../src/config-validator';

describe('Config Validation', () => {
  it('should report missing authConfig.tokenEnvVar', () => {
    const result = validateConfig({
      authType: 'pat',
      authConfig: { type: 'pat', tokenEnvVar: '' },
      repository: 'owner/repo',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0].category).toBe('auth');
  });

  it('should report all errors categorized', () => {
    const result = validateConfig({
      authType: 'invalid',
      authConfig: { type: 'pat', tokenEnvVar: '' },
      repository: 'bad-format',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(1);
  });

  it('should pass for valid config', () => {
    const result = validateConfig({
      authType: 'pat',
      authConfig: { type: 'pat', tokenEnvVar: 'GITHUB_TOKEN' },
      repository: 'owner/repo',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
