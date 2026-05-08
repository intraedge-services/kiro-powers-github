import { withRetry } from './error-handler.js';
import type { Logger } from './logger.js';
import type { RetryOptions } from './types.js';
import type { IssueData, MilestoneData, LabelData } from './mapping-strategies.js';

// ============================================================
// Types
// ============================================================

export interface CreatedIssue {
  number: number;
  url: string;
}

export interface CreatedMilestone {
  id: number;
  number: number;
}

export interface Milestone {
  id: number;
  number: number;
  title: string;
}

export interface SearchResult {
  number: number;
  title: string;
  body: string;
}

/**
 * Custom error class for GitHub API failures.
 * Carries HTTP status so the retry/transform logic can classify it.
 */
export class GitHubApiError extends Error {
  public readonly status: number;
  public readonly responseBody: string;
  public readonly endpoint: string;

  constructor(status: number, responseBody: string, endpoint: string) {
    const summary = GitHubApiError.summarize(status);
    super(`GitHub API ${status} (${summary}) — ${endpoint}\n  Response: ${responseBody}`);
    this.name = 'GitHubApiError';
    this.status = status;
    this.responseBody = responseBody;
    this.endpoint = endpoint;
  }

  static summarize(status: number): string {
    switch (status) {
      case 401: return 'Unauthorized — token is invalid or expired';
      case 403: return 'Forbidden — token lacks required scopes';
      case 404: return 'Not Found — repo does not exist or is inaccessible';
      case 422: return 'Validation Failed — resource may already exist';
      case 429: return 'Rate Limited';
      default: return status >= 500 ? 'Server Error' : 'Client Error';
    }
  }

  get remediation(): string {
    switch (this.status) {
      case 401: return 'Regenerate your GITHUB_TOKEN (Settings → Developer settings → Tokens)';
      case 403: return 'Ensure your token has the "repo" scope enabled';
      case 404: return 'Verify GITHUB_OWNER/GITHUB_REPO exist and your token has access';
      case 422: return 'The resource likely already exists — this may be safe to ignore';
      case 429: return 'Wait for rate limit reset and retry';
      default: return 'Check the response body above for details';
    }
  }
}

/**
 * Interface for GitHub API operations.
 * Implemented by MCP-based client in production, mocked in tests.
 */
export interface GitHubClient {
  createIssue(owner: string, repo: string, data: IssueData): Promise<CreatedIssue>;
  updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    data: Partial<IssueData>
  ): Promise<void>;
  createMilestone(owner: string, repo: string, data: MilestoneData): Promise<CreatedMilestone>;
  listMilestones(owner: string, repo: string): Promise<Milestone[]>;
  createLabel(owner: string, repo: string, data: LabelData): Promise<void>;
  searchIssues(owner: string, repo: string, query: string): Promise<SearchResult[]>;
}

// ============================================================
// Live GitHub REST API Implementation
// ============================================================

/**
 * GitHub client that calls the REST API directly using fetch and GITHUB_TOKEN.
 * Supports retry logic for transient failures.
 */
export class LiveGitHubClient implements GitHubClient {
  private readonly logger: Logger;
  private readonly retryOptions: RetryOptions;
  private readonly token: string;
  private readonly baseUrl = 'https://api.github.com';

  constructor(logger: Logger, retryOptions: RetryOptions, token: string) {
    this.logger = logger;
    this.retryOptions = retryOptions;
    this.token = token;
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `token ${this.token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    };
  }

  private async request(method: string, endpoint: string, body?: unknown): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    const hdrs = this.headers();
    const authPrefix = hdrs.Authorization.split(' ')[0];
    console.log(`   [debug] ${method} ${url}`);
    console.log(`   [debug] Auth: ${authPrefix} ***`);

    const res = await fetch(url, {
      method,
      headers: hdrs,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      console.log(`   [debug] HTTP ${res.status} from ${method} ${endpoint}`);
      console.log(`   [debug] Response body: ${text}`);
      throw new GitHubApiError(res.status, text, `${method} ${endpoint}`);
    }

    return res;
  }

  /**
   * Startup connectivity test — verifies token + repo access.
   * Call this before any other operations to fail early.
   */
  async verifyRepoAccess(owner: string, repo: string): Promise<void> {
    const url = `${this.baseUrl}/repos/${owner}/${repo}`;
    const hdrs = this.headers();
    const authPrefix = hdrs.Authorization.split(' ')[0];
    console.log(`   [debug] GET ${url}`);
    console.log(`   [debug] Auth: ${authPrefix} ***`);

    const res = await fetch(url, { method: 'GET', headers: hdrs });

    if (!res.ok) {
      const text = await res.text();
      console.log(`   [debug] HTTP ${res.status} from GET /repos/${owner}/${repo}`);
      console.log(`   [debug] Response body: ${text}`);
      throw new GitHubApiError(res.status, text, `GET /repos/${owner}/${repo}`);
    }

    const json = (await res.json()) as { full_name: string };
    console.log(`   ✅ Repository verified: ${json.full_name}`);
  }

  async createIssue(owner: string, repo: string, data: IssueData): Promise<CreatedIssue> {
    return withRetry(
      async () => {
        this.logger.info('Creating issue', { owner, repo, title: data.title });

        const payload: Record<string, unknown> = {
          title: data.title,
          body: data.body,
          labels: data.labels,
        };

        const res = await this.request('POST', `/repos/${owner}/${repo}/issues`, payload);
        const json = (await res.json()) as { number: number; html_url: string };
        return { number: json.number, url: json.html_url };
      },
      this.retryOptions,
      this.logger
    );
  }

  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    data: Partial<IssueData>
  ): Promise<void> {
    return withRetry(
      async () => {
        this.logger.info('Updating issue', { owner, repo, issueNumber });

        const payload: Record<string, unknown> = {};
        if (data.title) payload.title = data.title;
        if (data.body) payload.body = data.body;
        if (data.labels) payload.labels = data.labels;

        await this.request('PATCH', `/repos/${owner}/${repo}/issues/${issueNumber}`, payload);
      },
      this.retryOptions,
      this.logger
    );
  }

  async createMilestone(
    owner: string,
    repo: string,
    data: MilestoneData
  ): Promise<CreatedMilestone> {
    return withRetry(
      async () => {
        this.logger.info('Creating milestone', { owner, repo, title: data.title });

        const res = await this.request('POST', `/repos/${owner}/${repo}/milestones`, {
          title: data.title,
          description: data.description,
        });

        const json = (await res.json()) as { id: number; number: number };
        return { id: json.id, number: json.number };
      },
      this.retryOptions,
      this.logger
    );
  }

  async listMilestones(owner: string, repo: string): Promise<Milestone[]> {
    return withRetry(
      async () => {
        this.logger.info('Listing milestones', { owner, repo });

        const res = await this.request('GET', `/repos/${owner}/${repo}/milestones?state=open&per_page=100`);
        const json = (await res.json()) as Array<{ id: number; number: number; title: string }>;
        return json.map((m) => ({ id: m.id, number: m.number, title: m.title }));
      },
      this.retryOptions,
      this.logger
    );
  }

  async createLabel(owner: string, repo: string, data: LabelData): Promise<void> {
    this.logger.info('Creating label', { owner, repo, name: data.name });

    const url = `${this.baseUrl}/repos/${owner}/${repo}/labels`;
    const hdrs = this.headers();
    const authPrefix = hdrs.Authorization.split(' ')[0];

    // Build payload — strip any undefined fields
    const payload: Record<string, string> = { name: data.name, color: data.color, description: data.description };
    for (const key of Object.keys(payload)) {
      if (payload[key] === undefined) delete payload[key];
    }
    const bodyStr = JSON.stringify(payload);

    console.log(`   [debug] POST ${url}`);
    console.log(`   [debug] Auth: ${authPrefix} ***`);
    console.log(`   [debug] Content-Type: application/json`);
    console.log(`   [debug] Body: ${bodyStr}`);
    console.log(`   [debug] curl equivalent:`);
    console.log(`   curl -X POST ${url} -H "Authorization: token $GITHUB_TOKEN" -H "Content-Type: application/json" -d '${bodyStr}'`);

    const res = await fetch(url, {
      method: 'POST',
      headers: hdrs,
      body: bodyStr,
    });

    if (res.ok) return;

    const text = await res.text();
    console.log(`   [debug] HTTP ${res.status} from POST /repos/${owner}/${repo}/labels`);
    console.log(`   [debug] Response body: ${text}`);

    // 422 means label already exists — not an error
    if (res.status === 422) {
      console.log(`   [debug] Label "${data.name}" already exists — continuing`);
      return;
    }

    // Throw with actual status and message — do NOT transform to generic error
    throw new GitHubApiError(res.status, text, `POST /repos/${owner}/${repo}/labels`);
  }

  async searchIssues(owner: string, repo: string, query: string): Promise<SearchResult[]> {
    return withRetry(
      async () => {
        this.logger.info('Searching issues', { owner, repo, query });

        const q = encodeURIComponent(`${query} repo:${owner}/${repo} is:issue`);
        const res = await this.request('GET', `/search/issues?q=${q}&per_page=100`);

        const json = (await res.json()) as {
          items: Array<{ number: number; title: string; body: string }>;
        };
        return json.items.map((i) => ({ number: i.number, title: i.title, body: i.body ?? '' }));
      },
      this.retryOptions,
      this.logger
    );
  }
}

// ============================================================
// MCP-Based Implementation (placeholder for agent-driven usage)
// ============================================================

/**
 * GitHub client that wraps MCP tool calls with retry logic.
 * Used when running inside the Kiro agent context.
 */
export class McpGitHubClient implements GitHubClient {
  private readonly logger: Logger;
  private readonly retryOptions: RetryOptions;

  constructor(logger: Logger, retryOptions: RetryOptions) {
    this.logger = logger;
    this.retryOptions = retryOptions;
  }

  async createIssue(owner: string, repo: string, data: IssueData): Promise<CreatedIssue> {
    return withRetry(
      async () => {
        this.logger.info('Creating issue via MCP', { owner, repo, title: data.title });
        return { number: 0, url: `https://github.com/${owner}/${repo}/issues/0` };
      },
      this.retryOptions,
      this.logger
    );
  }

  async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    _data: Partial<IssueData>
  ): Promise<void> {
    return withRetry(
      async () => {
        this.logger.info('Updating issue via MCP', { owner, repo, issueNumber });
      },
      this.retryOptions,
      this.logger
    );
  }

  async createMilestone(
    owner: string,
    repo: string,
    data: MilestoneData
  ): Promise<CreatedMilestone> {
    return withRetry(
      async () => {
        this.logger.info('Creating milestone via MCP', { owner, repo, title: data.title });
        return { id: 0, number: 0 };
      },
      this.retryOptions,
      this.logger
    );
  }

  async listMilestones(owner: string, repo: string): Promise<Milestone[]> {
    return withRetry(
      async () => {
        this.logger.info('Listing milestones via MCP', { owner, repo });
        return [];
      },
      this.retryOptions,
      this.logger
    );
  }

  async createLabel(owner: string, repo: string, data: LabelData): Promise<void> {
    return withRetry(
      async () => {
        this.logger.info('Creating label via MCP', { owner, repo, name: data.name });
      },
      this.retryOptions,
      this.logger
    );
  }

  async searchIssues(owner: string, repo: string, _query: string): Promise<SearchResult[]> {
    return withRetry(
      async () => {
        this.logger.info('Searching issues via MCP', { owner, repo });
        return [];
      },
      this.retryOptions,
      this.logger
    );
  }
}
