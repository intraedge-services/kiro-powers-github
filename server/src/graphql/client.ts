import { GraphQLClient } from "graphql-request";
import { log } from "../utils/logger.js";

const GITHUB_GRAPHQL_ENDPOINT = "https://api.github.com/graphql";
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;

interface RateLimitState {
  remaining: number;
  limit: number;
  resetAt: Date | null;
}

let rateLimitState: RateLimitState = {
  remaining: 5000,
  limit: 5000,
  resetAt: null,
};

/**
 * Get current rate limit state for reporting to users.
 */
export function getRateLimitState(): RateLimitState {
  return { ...rateLimitState };
}

/**
 * Create an authenticated GraphQL client for GitHub API.
 */
function createClient(): GraphQLClient {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN is not set");
  }

  return new GraphQLClient(GITHUB_GRAPHQL_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${token}`,
      "User-Agent": "kiro-github-projects-mcp/1.0",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

/**
 * Update rate limit state from response headers.
 */
function updateRateLimit(headers: Headers): void {
  const remaining = headers.get("x-ratelimit-remaining");
  const limit = headers.get("x-ratelimit-limit");
  const reset = headers.get("x-ratelimit-reset");

  if (remaining !== null) {
    rateLimitState.remaining = parseInt(remaining, 10);
  }
  if (limit !== null) {
    rateLimitState.limit = parseInt(limit, 10);
  }
  if (reset !== null) {
    rateLimitState.resetAt = new Date(parseInt(reset, 10) * 1000);
  }

  // Warn if approaching limit
  if (rateLimitState.remaining < rateLimitState.limit * 0.1) {
    log("WARN", "graphql", `Rate limit low: ${rateLimitState.remaining}/${rateLimitState.limit} remaining`);
  }
}

/**
 * Check if we should wait for rate limit reset.
 */
async function waitForRateLimitIfNeeded(): Promise<void> {
  if (rateLimitState.remaining <= 0 && rateLimitState.resetAt) {
    const waitMs = rateLimitState.resetAt.getTime() - Date.now();
    if (waitMs > 0) {
      log("WARN", "graphql", `Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s for reset.`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }
}

/**
 * Determine if an error is transient and should be retried.
 */
function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("timeout") || message.includes("econnreset") || message.includes("econnrefused")) {
      return true;
    }
  }
  // Check for HTTP status codes in GraphQL client errors
  const statusCode = (error as { response?: { status?: number } })?.response?.status;
  if (statusCode && [502, 503, 504].includes(statusCode)) {
    return true;
  }
  return false;
}

/**
 * Execute a GraphQL query/mutation with retry logic and rate limit handling.
 */
export async function executeGraphQL<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  await waitForRateLimitIfNeeded();

  const client = createClient();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.rawRequest<T>(query, variables);

      // Update rate limit from headers
      if (response.headers) {
        updateRateLimit(response.headers);
      }

      return response.data;
    } catch (error: unknown) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check for rate limit (429)
      const statusCode = (error as { response?: { status?: number } })?.response?.status;
      if (statusCode === 429) {
        log("WARN", "graphql", "Rate limited (429). Waiting for reset.");
        await waitForRateLimitIfNeeded();
        continue;
      }

      // Don't retry non-transient errors
      if (!isTransientError(error)) {
        break;
      }

      // Exponential backoff for transient errors
      if (attempt < MAX_RETRIES) {
        const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        log("WARN", "graphql", `Transient error (attempt ${attempt}/${MAX_RETRIES}). Retrying in ${delay}ms.`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError ?? new Error("GraphQL request failed after retries");
}
