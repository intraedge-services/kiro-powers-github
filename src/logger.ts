import * as fs from 'node:fs';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { LogEntry, LogLevel } from './types.js';

/**
 * Patterns that indicate sensitive data — must be sanitized before logging.
 */
const SENSITIVE_PATTERNS: RegExp[] = [
  /ghp_[a-zA-Z0-9]{36,}/g,
  /ghs_[a-zA-Z0-9]{36,}/g,
  /github_pat_[a-zA-Z0-9_]{22,}/g,
  /Authorization:\s*Bearer\s+\S+/gi,
  /token\s*[:=]\s*["']?\S+["']?/gi,
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROTATED_FILES = 3;

/**
 * Structured logger with JSON output, file rotation, and sensitive data sanitization.
 */
export class Logger {
  private correlationId: string;
  private readonly component: string;
  private readonly logFilePath: string;

  constructor(component: string, logDir: string = 'github-power/logs') {
    this.component = component;
    this.correlationId = uuidv4();
    this.logFilePath = path.join(logDir, 'power.log');
    this.ensureLogDir(logDir);
  }

  /**
   * Create a child logger with a specific correlation ID.
   */
  withCorrelation(correlationId: string): Logger {
    const child = new Logger(this.component, path.dirname(this.logFilePath));
    child.correlationId = correlationId;
    return child;
  }

  /**
   * Set the correlation ID for this logger instance.
   */
  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  /**
   * Get the current correlation ID.
   */
  getCorrelationId(): string {
    return this.correlationId;
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  /**
   * Write a structured log entry to console and file.
   */
  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      correlationId: this.correlationId,
      component: this.component,
      message,
      context: context ? this.sanitize(context) : undefined,
    };

    const line = JSON.stringify(entry);
    this.writeToConsole(level, line);
    this.writeToFile(line);
  }

  /**
   * Append a sync audit entry to aidlc-docs/audit.md.
   */
  auditSync(
    operationType: string,
    result: 'success' | 'partial' | 'failed',
    details: string,
    items?: { created: number; updated: number; skipped: number; failed: number }
  ): void {
    const auditPath = 'aidlc-docs/audit.md';
    const timestamp = new Date().toISOString();

    let entry = `\n## GitHub Power Sync - ${operationType}\n`;
    entry += `**Timestamp**: ${timestamp}\n`;
    entry += `**Operation**: ${operationType}\n`;
    entry += `**Result**: ${result}\n`;
    entry += `**Details**: ${details}\n`;
    if (items) {
      entry += `**Items**: Created: ${items.created}, Updated: ${items.updated}, Skipped: ${items.skipped}, Failed: ${items.failed}\n`;
    }
    entry += '\n---\n';

    try {
      if (fs.existsSync(auditPath)) {
        fs.appendFileSync(auditPath, entry, 'utf-8');
      }
    } catch {
      // Audit logging is best-effort — don't fail the operation
      this.warn('Failed to write audit entry', { auditPath });
    }
  }

  /**
   * Sanitize data by replacing sensitive patterns with masked values.
   */
  private sanitize(data: Record<string, unknown>): Record<string, unknown> {
    const serialized = JSON.stringify(data);
    let sanitized = serialized;

    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, '***REDACTED***');
    }

    try {
      return JSON.parse(sanitized) as Record<string, unknown>;
    } catch {
      return { sanitized: '***REDACTED***' };
    }
  }

  /**
   * Write log line to console with level-appropriate formatting.
   */
  private writeToConsole(level: LogLevel, line: string): void {
    switch (level) {
      case 'error':
        console.error(line);
        break;
      case 'warn':
        console.warn(line);
        break;
      case 'debug':
        console.debug(line);
        break;
      default:
        console.log(line);
    }
  }

  /**
   * Write log line to file, rotating if needed.
   */
  private writeToFile(line: string): void {
    try {
      this.rotateIfNeeded();
      fs.appendFileSync(this.logFilePath, line + '\n', 'utf-8');
    } catch {
      // File logging is best-effort — don't crash on write failure
    }
  }

  /**
   * Rotate log file if it exceeds MAX_FILE_SIZE.
   * Keeps up to MAX_ROTATED_FILES old files.
   */
  private rotateIfNeeded(): void {
    if (!fs.existsSync(this.logFilePath)) return;

    try {
      const stats = fs.statSync(this.logFilePath);
      if (stats.size < MAX_FILE_SIZE) return;

      // Shift existing rotated files
      for (let i = MAX_ROTATED_FILES - 1; i >= 1; i--) {
        const from = `${this.logFilePath}.${i}`;
        const to = `${this.logFilePath}.${i + 1}`;
        if (fs.existsSync(from)) {
          if (i + 1 > MAX_ROTATED_FILES) {
            fs.unlinkSync(from);
          } else {
            fs.renameSync(from, to);
          }
        }
      }

      // Rotate current file
      fs.renameSync(this.logFilePath, `${this.logFilePath}.1`);
    } catch {
      // Rotation failure is non-critical
    }
  }

  /**
   * Ensure the log directory exists.
   */
  private ensureLogDir(logDir: string): void {
    try {
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch {
      // Directory creation failure handled gracefully
    }
  }
}

/**
 * Factory function to create a Logger instance.
 */
export function createLogger(component: string, logDir?: string): Logger {
  return new Logger(component, logDir);
}
