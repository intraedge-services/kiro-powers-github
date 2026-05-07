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
// MCP-Based Implementation
// ============================================================

/**
 * GitHub client that wraps MCP tool calls with retry logic.
 * In production, this calls the GitHub MCP server tools.
 * Each operation is wrapped in withRetry for transient error handling.
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
        // In production: calls MCP github server's create_issue tool
        // This is a placeholder — actual MCP tool invocation happens via the agent
        this.logger.info('Creating issue', { owner, repo, title: data.title });

        // Placeholder response — actual implementation delegates to MCP
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
    data: Partial<IssueData>
  ): Promise<void> {
    return withRetry(
      async () => {
        this.logger.info('Updating issue', { owner, repo, issueNumber });
        // Placeholder — actual MCP tool invocation
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
        // Placeholder — actual MCP tool invocation
        return { id: 0, number: 0 };
      },
      this.retryOptions,
      this.logger
    );
  }

  async listMilestones(owner: string, repo: string): Promise<Milestone[]> {
    return withRetry(
      async () => {
        this.logger.info('Listing milestones', { owner, repo });
        // Placeholder — actual MCP tool invocation
        return [];
      },
      this.retryOptions,
      this.logger
    );
  }

  async createLabel(owner: string, repo: string, data: LabelData): Promise<void> {
    return withRetry(
      async () => {
        this.logger.info('Creating label', { owner, repo, name: data.name });
        // Placeholder — actual MCP tool invocation
      },
      this.retryOptions,
      this.logger
    );
  }

  async searchIssues(owner: string, repo: string, query: string): Promise<SearchResult[]> {
    return withRetry(
      async () => {
        this.logger.info('Searching issues', { owner, repo, query });
        // Placeholder — actual MCP tool invocation
        return [];
      },
      this.retryOptions,
      this.logger
    );
  }
}
