import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerItemTools } from "./tools/items.js";
import { registerStatusTools } from "./tools/status.js";
import { registerFieldTools } from "./tools/fields.js";
import { registerIterationTools } from "./tools/iterations.js";
import { registerViewTools } from "./tools/views.js";
import { registerWorkflowTools } from "./tools/workflows.js";
import { registerAnalyticsTools } from "./tools/analytics.js";
import { registerCacheTools } from "./tools/cache-tools.js";
import { log } from "./utils/logger.js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SERVER_NAME = "github-projects-mcp";
const SERVER_VERSION = "1.0.0";

function loadEnvFile(): void {
  // If GITHUB_TOKEN is already set with a real value, skip .env loading
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.startsWith("gh")) return;

  // Try to load from .env files (fallback for when IDE doesn't pass env vars)
  // Use multiple strategies to find the .env file relative to the script location
  const scriptDir = new URL(".", import.meta.url).pathname;
  const envPaths = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "server/.env"),
    resolve(scriptDir, "../../.env"),
    resolve(scriptDir, "../../../.env"),
  ];

  for (const envPath of envPaths) {
    try {
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith("#")) {
          const eqIndex = trimmed.indexOf("=");
          if (eqIndex > 0) {
            const key = trimmed.slice(0, eqIndex).trim();
            const value = trimmed.slice(eqIndex + 1).trim();
            // Always override - Kiro may set unresolved ${VAR} placeholders
            process.env[key] = value;
          }
        }
      }
      log("INFO", "startup", `Loaded env from: ${envPath}`);
      return;
    } catch {
      // File doesn't exist, try next
    }
  }
}

function validateEnvironment(): void {
  const token = process.env.GITHUB_TOKEN;
  if (!token || token === "${GITHUB_TOKEN}" || token.trim() === "") {
    log("ERROR", "startup", "GITHUB_TOKEN environment variable is not set or was not resolved. Ensure GITHUB_TOKEN is exported in your shell or defined in a .env file at the workspace root.");
    // Don't exit — let the server start so the MCP connection stays open
    // and tools can return meaningful errors instead of "Connection closed"
    return;
  }
  if (!token.startsWith("ghp_") && !token.startsWith("github_pat_")) {
    log("WARN", "startup", "GITHUB_TOKEN does not match expected format (ghp_* or github_pat_*). Proceeding anyway.");
  }
}

async function main(): Promise<void> {
  loadEnvFile();
  validateEnvironment();

  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register all tool categories
  registerProjectTools(server);
  registerItemTools(server);
  registerStatusTools(server);
  registerFieldTools(server);
  registerIterationTools(server);
  registerViewTools(server);
  registerWorkflowTools(server);
  registerAnalyticsTools(server);
  registerCacheTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const cacheDir = process.env.GITHUB_PROJECTS_CACHE_DIR || ".kiro/github-cache";
  log("INFO", "startup", `Server started: ${SERVER_NAME} v${SERVER_VERSION}, cache: ${cacheDir}`);
}

// Global error handler
process.on("uncaughtException", (error: Error) => {
  log("ERROR", "global", `Uncaught exception: ${error.message}`);
  process.exit(1);
});

process.on("unhandledRejection", (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  log("ERROR", "global", `Unhandled rejection: ${message}`);
  process.exit(1);
});

main().catch((error: Error) => {
  log("ERROR", "startup", `Failed to start server: ${error.message}`);
  process.exit(1);
});
