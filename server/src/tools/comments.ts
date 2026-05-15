import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { log } from "../utils/logger.js";
import {
  listPRCommentsSchema,
  getPRCommentSchema,
  createPRCommentSchema,
  replyToPRReviewCommentSchema,
  listPRReviewCommentsSchema,
  createPRReviewCommentSchema,
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

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}

export function registerCommentTools(server: McpServer): void {
  // --- Issue/PR Conversation Comments (top-level comments on a PR) ---

  server.tool(
    "list_pr_comments",
    "List conversation comments on a pull request (issue comments)",
    listPRCommentsSchema.shape,
    async (params) => {
      const input = listPRCommentsSchema.parse(params);
      log("INFO", "list_pr_comments", `Listing comments for PR #${input.pullNumber} in ${input.owner}/${input.repo}`);

      const query = new URLSearchParams({
        per_page: String(input.perPage || 30),
        ...(input.since ? { since: input.since } : {}),
      });

      const result = await githubRest<Array<{
        id: number; node_id: string; body: string; html_url: string;
        user: { login: string }; created_at: string; updated_at: string;
      }>>(
        "GET",
        `/repos/${input.owner}/${input.repo}/issues/${input.pullNumber}/comments?${query.toString()}`,
      );

      const comments = result.map((c) => ({
        id: c.id,
        nodeId: c.node_id,
        body: c.body,
        author: c.user.login,
        url: c.html_url,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ comments, count: comments.length }) }],
      };
    },
  );

  server.tool(
    "get_pr_comment",
    "Get a specific comment on a pull request by comment ID",
    getPRCommentSchema.shape,
    async (params) => {
      const input = getPRCommentSchema.parse(params);
      log("INFO", "get_pr_comment", `Getting comment ${input.commentId} in ${input.owner}/${input.repo}`);

      const result = await githubRest<{
        id: number; node_id: string; body: string; html_url: string;
        user: { login: string }; created_at: string; updated_at: string;
      }>(
        "GET",
        `/repos/${input.owner}/${input.repo}/issues/comments/${input.commentId}`,
      );

      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            id: result.id,
            nodeId: result.node_id,
            body: result.body,
            author: result.user.login,
            url: result.html_url,
            createdAt: result.created_at,
            updatedAt: result.updated_at,
          }),
        }],
      };
    },
  );

  server.tool(
    "create_pr_comment",
    "Post a conversation comment on a pull request",
    createPRCommentSchema.shape,
    async (params) => {
      const input = createPRCommentSchema.parse(params);
      log("INFO", "create_pr_comment", `Posting comment on PR #${input.pullNumber} in ${input.owner}/${input.repo}`);

      const result = await githubRest<{
        id: number; node_id: string; html_url: string;
      }>(
        "POST",
        `/repos/${input.owner}/${input.repo}/issues/${input.pullNumber}/comments`,
        { body: input.body },
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ id: result.id, nodeId: result.node_id, url: result.html_url }) }],
      };
    },
  );

  // --- PR Review Comments (inline code comments) ---

  server.tool(
    "list_pr_review_comments",
    "List review comments (inline code comments) on a pull request",
    listPRReviewCommentsSchema.shape,
    async (params) => {
      const input = listPRReviewCommentsSchema.parse(params);
      log("INFO", "list_pr_review_comments", `Listing review comments for PR #${input.pullNumber} in ${input.owner}/${input.repo}`);

      const query = new URLSearchParams({
        per_page: String(input.perPage || 30),
        ...(input.since ? { since: input.since } : {}),
      });

      const result = await githubRest<Array<{
        id: number; node_id: string; body: string; html_url: string; path: string;
        line: number | null; original_line: number | null; diff_hunk: string;
        user: { login: string }; created_at: string; updated_at: string;
        in_reply_to_id?: number;
      }>>(
        "GET",
        `/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}/comments?${query.toString()}`,
      );

      const comments = result.map((c) => ({
        id: c.id,
        nodeId: c.node_id,
        body: c.body,
        author: c.user.login,
        path: c.path,
        line: c.line ?? c.original_line,
        diffHunk: c.diff_hunk,
        url: c.html_url,
        inReplyToId: c.in_reply_to_id ?? null,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ comments, count: comments.length }) }],
      };
    },
  );

  server.tool(
    "create_pr_review_comment",
    "Create an inline review comment on a specific line in a pull request",
    createPRReviewCommentSchema.shape,
    async (params) => {
      const input = createPRReviewCommentSchema.parse(params);
      log("INFO", "create_pr_review_comment", `Creating review comment on PR #${input.pullNumber} at ${input.path}:${input.line}`);

      const body: Record<string, unknown> = {
        body: input.body,
        path: input.path,
        commit_id: input.commitId,
        ...(input.side ? { side: input.side } : {}),
      };

      // Use line or position
      if (input.line) {
        body.line = input.line;
      }

      const result = await githubRest<{
        id: number; node_id: string; html_url: string;
      }>(
        "POST",
        `/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}/comments`,
        body,
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ id: result.id, nodeId: result.node_id, url: result.html_url }) }],
      };
    },
  );

  server.tool(
    "reply_to_pr_review_comment",
    "Reply to an existing review comment thread on a pull request",
    replyToPRReviewCommentSchema.shape,
    async (params) => {
      const input = replyToPRReviewCommentSchema.parse(params);
      log("INFO", "reply_to_pr_review_comment", `Replying to comment ${input.commentId} on PR #${input.pullNumber}`);

      const result = await githubRest<{
        id: number; node_id: string; html_url: string;
      }>(
        "POST",
        `/repos/${input.owner}/${input.repo}/pulls/${input.pullNumber}/comments/${input.commentId}/replies`,
        { body: input.body },
      );

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ id: result.id, nodeId: result.node_id, url: result.html_url }) }],
      };
    },
  );
}
