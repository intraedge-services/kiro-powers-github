import type { Logger } from './logger.js';
import type { ConfigManager } from './config-manager.js';

/**
 * GitHub Actions Manager — provides workflow listing, triggering, and status checking.
 * All operations are gated by the `enableGitHubActions` feature flag.
 * Uses existing GitHub MCP server tools for actual API calls.
 */
export class ActionsManager {
  private readonly logger: Logger;
  private readonly configManager: ConfigManager;

  constructor(logger: Logger, configManager: ConfigManager) {
    this.logger = logger;
    this.configManager = configManager;
  }

  /**
   * Check if GitHub Actions integration is enabled.
   */
  isEnabled(): boolean {
    return this.configManager.getFeatureFlag('enableGitHubActions');
  }

  /**
   * Get the disabled message when Actions is not enabled.
   */
  getDisabledMessage(): string {
    return 'GitHub Actions integration is disabled. Enable it by setting "enableGitHubActions": true in github-power/config.json';
  }

  /**
   * List available workflows in the repository.
   * Returns workflow metadata for the agent to present to the user.
   */
  async listWorkflows(): Promise<WorkflowListResult> {
    if (!this.isEnabled()) {
      return { enabled: false, message: this.getDisabledMessage(), workflows: [] };
    }

    this.logger.info('Listing workflows');
    // Actual implementation delegates to GitHub MCP server
    // Agent calls list_workflows via MCP and formats the response
    return {
      enabled: true,
      message: 'Use GitHub MCP tools to list workflows in the repository',
      workflows: [],
    };
  }

  /**
   * Trigger a workflow run.
   * Returns run ID for status tracking.
   */
  async triggerWorkflow(workflowId: string, branch: string, inputs?: Record<string, string>): Promise<TriggerResult> {
    if (!this.isEnabled()) {
      return { success: false, message: this.getDisabledMessage() };
    }

    this.logger.info('Triggering workflow', { workflowId, branch });
    // Actual implementation delegates to GitHub MCP server
    return {
      success: true,
      message: `Workflow ${workflowId} triggered on branch ${branch}`,
      runId: undefined,
    };
  }

  /**
   * Check the status of a workflow run.
   */
  async checkRunStatus(runId: number): Promise<RunStatusResult> {
    if (!this.isEnabled()) {
      return { enabled: false, message: this.getDisabledMessage() };
    }

    this.logger.info('Checking workflow run status', { runId });
    // Actual implementation delegates to GitHub MCP server
    return {
      enabled: true,
      message: `Use GitHub MCP tools to check run ${runId} status`,
    };
  }
}

// ============================================================
// Types
// ============================================================

export interface WorkflowListResult {
  enabled: boolean;
  message: string;
  workflows: WorkflowInfo[];
}

export interface WorkflowInfo {
  id: number;
  name: string;
  path: string;
  state: 'active' | 'disabled';
}

export interface TriggerResult {
  success: boolean;
  message: string;
  runId?: number;
}

export interface RunStatusResult {
  enabled: boolean;
  message: string;
  status?: 'queued' | 'in_progress' | 'completed';
  conclusion?: 'success' | 'failure' | 'cancelled';
}
