import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { log } from "../utils/logger.js";
import {
  createPullRequestSchema,
  listPullRequestsSchema,
  getPullRequestSchema,
  mergePullRequestSchema,
  createIssueSchema,
  listIssuesSchema,
  createBranchSchema,
  listBranchesSchema,
  getRepositorySchema,
} from "../validation/schemas.js";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Make an authenticated REST API call to GitHub.
 */
async function githubRest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token || token === "${GITHUB_TOKEN}" || token.trim() === "") {
    throw new Error("GITHUB_TOKEN is not set.");
  }

  const url = `${GITHUB_API_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "kiro-github-projects-mcp/1.0",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`GitHub API ${method} ${path} failed (${response.status}): ${errorBody}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export function registerPullTools(server: McpServer): void {
  // --- Pull Requests ---

  server.tool("create_pull_request", "Create a pull request", createPullRequestSchema.shape, async (params) => {
    const input = createPullRequestSchema.parse(params);
    log("INFO", "create_pull_request", `Creating PR: ${input.title} (${input.head} -> ${input.base})`);

    const result = await githubRest<{ number: number; html_url: string; node_id: string }>(
      "POST",
      `/repos/${input.owner}/${input.repo}/pulls`,
      {
        title: input.title,
        body: input.body || "",
        head: input.head,
        base: input.base,
        draft: input.draft || false,
      },
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ number: result.number, url: result.html_url, nodeId: result.node_id }) }],
    };
  });

  server.tool("list_pull_requests", "List pull requests for a repository", listPullRequestsSchema.shape, async (params) => {
    const input = listPullRequestsSchema.parse(params);
    log("INFO", "list_pull_requests", `Listing PRs for ${input.owner}/${input.repo} (state: ${input.state})`);

    const query = new URLSearchParams({
      state: input.state || "open",
      per_page: String(input.perPage || 20),
    });

    const result = await githubRest<Array<{ number: number; title: string; state: string; html_url: string; user: { login: string }; head: { ref: string }; base: { ref: string }; draft: boolean; created_at: string }>>(
      "GET",
      `/repos/${input.owner}/${input.repo}/pulls?${query.toString()}`,
    );

    const pulls = result.map((pr) => ({
      number: pr.number,
      title: pr.title,
      state: pr.state,
      url: pr.html_url,
      author: pr.user.login,
      head: pr.head.ref,
      base: pr.base.ref,
      draft: pr.draft,
      createdAt: pr.created_at,
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ pulls, count: pulls.length }) }],
    };
  });

  server.tool("get_pull_request", "Get details of a specific pull request", getPullRequestSchema.shape, async (params) => {
    const input = getPullRequestSchema.parse(params);
    log("INFO", "get_pull_request", `Getting PR #${input.pullNumber} for ${input.owner}/${input.repo}`);

    const result = await githubRest<{
      number: number; title: string; body: string; state: string; html_url: string; node_id: string;
      user: { login: string }; head: { ref: string; sha: string }; base: { ref: string };
      draft: boolean; mergeable: boolean | null; merged: boolean; created_at: string; updated_at: string;
      additions: number; deletions: number; changed_files: number;
      requested_reviewers: Array<{ login: string }>;
    }>(
      "GET",
      `/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}`,
    );

    return {
      content: [{
        type: "text" as const, text: JSON.stringify({
          number: result.number,
          title: result.title,
          body: result.body,
          state: result.state,
          url: result.html_url,
          nodeId: result.node_id,
          author: result.user.login,
          head: result.head.ref,
          headSha: result.head.sha,
          base: result.base.ref,
          draft: result.draft,
          mergeable: result.mergeable,
          merged: result.merged,
          additions: result.additions,
          deletions: result.deletions,
          changedFiles: result.changed_files,
          reviewers: result.requested_reviewers.map((r) => r.login),
          createdAt: result.created_at,
          updatedAt: result.updated_at,
        }),
      }],
    };
  });

  server.tool("merge_pull_request", "Merge a pull request", mergePullRequestSchema.shape, async (params) => {
    const input = mergePullRequestSchema.parse(params);
    log("INFO", "merge_pull_request", `Merging PR #${input.pullNumber} for ${input.owner}/${input.repo}`);

    const result = await githubRest<{ sha: string; merged: boolean; message: string }>(
      "PUT",
      `/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}/merge`,
      {
        merge_method: input.mergeMethod || "merge",
        commit_title: input.commitTitle,
        commit_message: input.commitMessage,
      },
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ merged: result.merged, sha: result.sha, message: result.message }) }],
    };
  });

  // --- Issues ---

  server.tool("create_issue", "Create a GitHub issue", createIssueSchema.shape, async (params) => {
    const input = createIssueSchema.parse(params);
    log("INFO", "create_issue", `Creating issue: ${input.title} in ${input.owner}/${input.repo}`);

    const result = await githubRest<{ number: number; html_url: string; node_id: string }>(
      "POST",
      `/repos/${input.owner}/${input.repo}/issues`,
      {
        title: input.title,
        body: input.body || "",
        labels: input.labels || [],
        assignees: input.assignees || [],
      },
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ number: result.number, url: result.html_url, nodeId: result.node_id }) }],
    };
  });

  server.tool("list_issues", "List issues for a repository", listIssuesSchema.shape, async (params) => {
    const input = listIssuesSchema.parse(params);
    log("INFO", "list_issues", `Listing issues for ${input.owner}/${input.repo} (state: ${input.state})`);

    const query = new URLSearchParams({
      state: input.state || "open",
      per_page: String(input.perPage || 20),
    });
    if (input.labels) {
      query.set("labels", input.labels);
    }

    const result = await githubRest<Array<{
      number: number; title: string; state: string; html_url: string; node_id: string;
      user: { login: string }; labels: Array<{ name: string }>; assignees: Array<{ login: string }>;
      created_at: string; pull_request?: unknown;
    }>>(
      "GET",
      `/repos/${input.owner}/${input.repo}/issues?${query.toString()}`,
    );

    // Filter out pull requests (GitHub API returns PRs in issues endpoint)
    const issues = result
      .filter((i) => !i.pull_request)
      .map((i) => ({
        number: i.number,
        title: i.title,
        state: i.state,
        url: i.html_url,
        nodeId: i.node_id,
        author: i.user.login,
        labels: i.labels.map((l) => l.name),
        assignees: i.assignees.map((a) => a.login),
        createdAt: i.created_at,
      }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ issues, count: issues.length }) }],
    };
  });

  // --- Branches ---

  server.tool("create_branch", "Create a new branch from a reference", createBranchSchema.shape, async (params) => {
    const input = createBranchSchema.parse(params);
    log("INFO", "create_branch", `Creating branch ${input.branch} in ${input.owner}/${input.repo}`);

    // Get the SHA of the source branch
    const ref = await githubRest<{ object: { sha: string } }>(
      "GET",
      `/repos/${input.owner}/${input.repo}/git/ref/heads/${input.from || "main"}`,
    );

    // Create the new branch
    await githubRest(
      "POST",
      `/repos/${input.owner}/${input.repo}/git/refs`,
      {
        ref: `refs/heads/${input.branch}`,
        sha: ref.object.sha,
      },
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ branch: input.branch, sha: ref.object.sha, created: true }) }],
    };
  });

  server.tool("list_branches", "List branches for a repository", listBranchesSchema.shape, async (params) => {
    const input = listBranchesSchema.parse(params);
    log("INFO", "list_branches", `Listing branches for ${input.owner}/${input.repo}`);

    const result = await githubRest<Array<{ name: string; protected: boolean; commit: { sha: string } }>>(
      "GET",
      `/repos/${input.owner}/${input.repo}/branches?per_page=${input.perPage || 30}`,
    );

    const branches = result.map((b) => ({
      name: b.name,
      protected: b.protected,
      sha: b.commit.sha,
    }));

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ branches, count: branches.length }) }],
    };
  });

  // --- Repository ---

  server.tool("get_repository", "Get repository details including node ID", getRepositorySchema.shape, async (params) => {
    const input = getRepositorySchema.parse(params);
    log("INFO", "get_repository", `Getting repo ${input.owner}/${input.repo}`);

    const result = await githubRest<{
      node_id: string; full_name: string; description: string; html_url: string;
      default_branch: string; private: boolean; fork: boolean;
      open_issues_count: number; stargazers_count: number;
    }>(
      "GET",
      `/repos/${input.owner}/${input.repo}`,
    );

    return {
      content: [{
        type: "text" as const, text: JSON.stringify({
          nodeId: result.node_id,
          fullName: result.full_name,
          description: result.description,
          url: result.html_url,
          defaultBranch: result.default_branch,
          private: result.private,
          fork: result.fork,
          openIssues: result.open_issues_count,
          stars: result.stargazers_count,
        }),
      }],
    };
  });
}
