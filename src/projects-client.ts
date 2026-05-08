/**
 * GitHub Projects V2 Client
 *
 * Uses the GitHub GraphQL API to manage Projects V2:
 * - Create or find projects
 * - Add issues to projects
 * - Manage Status field (Todo, In Progress, Done)
 * - Update item statuses
 */

import type { Logger } from './logger.js';
import { GitHubApiError } from './github-client.js';

// ============================================================
// Types
// ============================================================

export interface ProjectInfo {
  id: string;
  number: number;
  title: string;
  url: string;
}

export interface ProjectField {
  id: string;
  name: string;
  options?: Array<{ id: string; name: string }>;
}

export interface ProjectItem {
  id: string;
  issueNumber: number;
}

export type StatusValue = 'Todo' | 'In Progress' | 'Done';

// ============================================================
// GitHub Projects V2 Client
// ============================================================

export class ProjectsClient {
  private readonly token: string;
  private readonly logger: Logger;
  private readonly graphqlUrl = 'https://api.github.com/graphql';
  private readonly restUrl = 'https://api.github.com';

  constructor(logger: Logger, token: string) {
    this.logger = logger;
    this.token = token;
  }

  // ----------------------------------------------------------
  // GraphQL helper
  // ----------------------------------------------------------

  private async graphql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
    const body = JSON.stringify({ query, variables });
    console.log(`   [debug] GraphQL POST ${this.graphqlUrl}`);
    console.log(`   [debug] Auth: token ***`);

    const res = await fetch(this.graphqlUrl, {
      method: 'POST',
      headers: {
        Authorization: `token ${this.token}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text();
      console.log(`   [debug] HTTP ${res.status} from GraphQL`);
      console.log(`   [debug] Response: ${text}`);
      throw new GitHubApiError(res.status, text, 'POST /graphql');
    }

    const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };

    if (json.errors && json.errors.length > 0) {
      const msg = json.errors.map((e) => e.message).join('; ');
      console.log(`   [debug] GraphQL errors: ${msg}`);
      throw new Error(`GraphQL error: ${msg}`);
    }

    return json.data as T;
  }

  // ----------------------------------------------------------
  // Find or create project
  // ----------------------------------------------------------

  /**
   * Find an existing project by title, or create a new one.
   * Returns project info with id, number, title, url.
   */
  async findOrCreateProject(owner: string, title: string): Promise<ProjectInfo> {
    // Try to find existing project
    const existing = await this.findProject(owner, title);
    if (existing) {
      this.logger.info('Project found', { title, id: existing.id });
      console.log(`   ✅ Project found: "${existing.title}" (#${existing.number})`);
      return existing;
    }

    // Create new project
    const created = await this.createProject(owner, title);
    this.logger.info('Project created', { title, id: created.id });
    console.log(`   ✅ Project created: "${created.title}" (#${created.number})`);
    return created;
  }

  private async findProject(owner: string, title: string): Promise<ProjectInfo | null> {
    // Try as user first, then as organization
    const userResult = await this.findUserProject(owner, title);
    if (userResult) return userResult;

    const orgResult = await this.findOrgProject(owner, title);
    return orgResult;
  }

  private async findUserProject(owner: string, title: string): Promise<ProjectInfo | null> {
    const query = `
      query($owner: String!, $first: Int!) {
        user(login: $owner) {
          projectsV2(first: $first) {
            nodes {
              id
              number
              title
              url
            }
          }
        }
      }
    `;

    try {
      const data = await this.graphql<{
        user: { projectsV2: { nodes: ProjectInfo[] } };
      }>(query, { owner, first: 50 });

      const match = data.user.projectsV2.nodes.find((p) => p.title === title);
      return match ?? null;
    } catch {
      return null;
    }
  }

  private async findOrgProject(owner: string, title: string): Promise<ProjectInfo | null> {
    const query = `
      query($owner: String!, $first: Int!) {
        organization(login: $owner) {
          projectsV2(first: $first) {
            nodes {
              id
              number
              title
              url
            }
          }
        }
      }
    `;

    try {
      const data = await this.graphql<{
        organization: { projectsV2: { nodes: ProjectInfo[] } };
      }>(query, { owner, first: 50 });

      const match = data.organization.projectsV2.nodes.find((p) => p.title === title);
      return match ?? null;
    } catch {
      return null;
    }
  }

  private async createProject(owner: string, title: string): Promise<ProjectInfo> {
    // First get the owner's node ID
    const ownerId = await this.getOwnerNodeId(owner);

    const mutation = `
      mutation($ownerId: ID!, $title: String!) {
        createProjectV2(input: { ownerId: $ownerId, title: $title }) {
          projectV2 {
            id
            number
            title
            url
          }
        }
      }
    `;

    const data = await this.graphql<{
      createProjectV2: { projectV2: ProjectInfo };
    }>(mutation, { ownerId, title });

    return data.createProjectV2.projectV2;
  }

  private async getOwnerNodeId(owner: string): Promise<string> {
    // Try user first
    try {
      const query = `query($login: String!) { user(login: $login) { id } }`;
      const data = await this.graphql<{ user: { id: string } }>(query, { login: owner });
      return data.user.id;
    } catch {
      // Try org
      const query = `query($login: String!) { organization(login: $login) { id } }`;
      const data = await this.graphql<{ organization: { id: string } }>(query, { login: owner });
      return data.organization.id;
    }
  }

  // ----------------------------------------------------------
  // Status field management
  // ----------------------------------------------------------

  /**
   * Get the Status field from a project. Returns field info with option IDs.
   */
  async getStatusField(projectId: string): Promise<ProjectField | null> {
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            fields(first: 30) {
              nodes {
                ... on ProjectV2SingleSelectField {
                  id
                  name
                  options {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;

    const data = await this.graphql<{
      node: { fields: { nodes: Array<{ id?: string; name?: string; options?: Array<{ id: string; name: string }> }> } };
    }>(query, { projectId });

    const statusField = data.node.fields.nodes.find(
      (f) => f.name === 'Status' && f.id
    );

    if (!statusField || !statusField.id) return null;

    return {
      id: statusField.id,
      name: statusField.name!,
      options: statusField.options ?? [],
    };
  }

  /**
   * Ensure the Status field has Todo, In Progress, Done options.
   * GitHub Projects V2 creates a default Status field with these options,
   * so this mostly verifies they exist.
   */
  async ensureStatusOptions(
    projectId: string
  ): Promise<{ fieldId: string; optionMap: Record<StatusValue, string> }> {
    const field = await this.getStatusField(projectId);

    if (!field) {
      // Status field doesn't exist yet — it's auto-created by GitHub
      // but if not present, we can't manage it programmatically without
      // the createProjectV2Field mutation (which requires specific permissions)
      throw new Error(
        'Status field not found on project. Open the project in GitHub UI to initialize default fields.'
      );
    }

    const optionMap: Record<string, string> = {};
    for (const opt of field.options ?? []) {
      optionMap[opt.name] = opt.id;
    }

    // Verify required options exist
    const required: StatusValue[] = ['Todo', 'In Progress', 'Done'];
    const missing = required.filter((s) => !optionMap[s]);

    if (missing.length > 0) {
      console.log(`   ⚠️  Status field missing options: ${missing.join(', ')}`);
      console.log(`   Available options: ${(field.options ?? []).map((o) => o.name).join(', ')}`);
      console.log(`   Note: You may need to add these in the GitHub Projects UI`);
    }

    console.log(`   ✅ Status field ready (options: ${(field.options ?? []).map((o) => o.name).join(', ')})`);

    return {
      fieldId: field.id,
      optionMap: optionMap as Record<StatusValue, string>,
    };
  }

  // ----------------------------------------------------------
  // Add issues to project
  // ----------------------------------------------------------

  /**
   * Add an issue to a project. Returns the project item ID.
   * Idempotent: if the issue is already in the project, returns existing item.
   */
  async addIssueToProject(projectId: string, issueNodeId: string): Promise<string> {
    const mutation = `
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
          item {
            id
          }
        }
      }
    `;

    const data = await this.graphql<{
      addProjectV2ItemById: { item: { id: string } };
    }>(mutation, { projectId, contentId: issueNodeId });

    return data.addProjectV2ItemById.item.id;
  }

  /**
   * Get the node ID for an issue (needed for GraphQL operations).
   */
  async getIssueNodeId(owner: string, repo: string, issueNumber: number): Promise<string> {
    const query = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          issue(number: $number) {
            id
          }
        }
      }
    `;

    const data = await this.graphql<{
      repository: { issue: { id: string } };
    }>(query, { owner, repo, number: issueNumber });

    return data.repository.issue.id;
  }

  // ----------------------------------------------------------
  // Update item status
  // ----------------------------------------------------------

  /**
   * Set the status of a project item.
   */
  async setItemStatus(
    projectId: string,
    itemId: string,
    fieldId: string,
    optionId: string
  ): Promise<void> {
    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId
          itemId: $itemId
          fieldId: $fieldId
          value: { singleSelectOptionId: $optionId }
        }) {
          projectV2Item {
            id
          }
        }
      }
    `;

    await this.graphql(mutation, { projectId, itemId, fieldId, optionId });
  }

  // ----------------------------------------------------------
  // Assign issues to users
  // ----------------------------------------------------------

  /**
   * Assign a GitHub user to an issue (REST API).
   */
  async assignIssue(owner: string, repo: string, issueNumber: number, assignees: string[]): Promise<void> {
    if (assignees.length === 0) return;

    const url = `${this.restUrl}/repos/${owner}/${repo}/issues/${issueNumber}/assignees`;
    console.log(`   [debug] POST ${url}`);
    console.log(`   [debug] Auth: token ***`);

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `token ${this.token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ assignees }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.log(`   [debug] HTTP ${res.status} assigning issue #${issueNumber}`);
      console.log(`   [debug] Response: ${text}`);
      throw new GitHubApiError(res.status, text, `POST /repos/${owner}/${repo}/issues/${issueNumber}/assignees`);
    }

    this.logger.info('Issue assigned', { issueNumber, assignees });
  }
}
