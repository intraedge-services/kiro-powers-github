type LogLevel = "ERROR" | "WARN" | "INFO";

/**
 * Structured logger that outputs to stderr (MCP servers use stdout for protocol).
 * Format: [TIMESTAMP] [LEVEL] [TOOL] message
 * Never logs sensitive data (tokens, PII).
 */
export function log(level: LogLevel, tool: string, message: string): void {
  const timestamp = new Date().toISOString();
  const entry = `[${timestamp}] [${level}] [${tool}] ${message}`;
  process.stderr.write(entry + "\n");
}
