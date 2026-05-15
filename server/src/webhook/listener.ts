import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { createHmac } from "node:crypto";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Lightweight GitHub Webhook Listener
 *
 * Receives GitHub webhook events (PR comments, reviews, etc.) and writes
 * event payloads to a watched directory. A Kiro hook monitors this directory
 * and triggers the agent to respond.
 *
 * Environment variables:
 *   WEBHOOK_PORT       - Port to listen on (default: 3847)
 *   WEBHOOK_SECRET     - GitHub webhook secret for signature verification
 *   WEBHOOK_EVENTS_DIR - Directory to write event files (default: .kiro/webhook-events)
 */

const PORT = parseInt(process.env.WEBHOOK_PORT || "3847", 10);
const SECRET = process.env.WEBHOOK_SECRET || "";

// Resolve events dir relative to the workspace root (one level up from server/)
const SCRIPT_DIR = new URL(".", import.meta.url).pathname;
const WORKSPACE_ROOT = resolve(SCRIPT_DIR, "../../..");
const EVENTS_DIR = resolve(
  process.env.WEBHOOK_EVENTS_DIR || `${WORKSPACE_ROOT}/.kiro/webhook-events`,
);

// Supported event types that we process
const SUPPORTED_EVENTS = new Set([
  "issue_comment",        // PR conversation comments (PRs are issues)
  "pull_request_review_comment", // Inline code review comments
  "pull_request_review",  // Review submitted (approve/request changes/comment)
]);

function verifySignature(payload: string, signature: string | undefined): boolean {
  if (!SECRET) {
    // No secret configured — skip verification (development mode)
    console.warn("[webhook] WARNING: No WEBHOOK_SECRET set. Skipping signature verification.");
    return true;
  }

  if (!signature) {
    return false;
  }

  const expected = `sha256=${createHmac("sha256", SECRET).update(payload).digest("hex")}`;
  return signature === expected;
}

interface WebhookEvent {
  id: string;
  event: string;
  action: string;
  repository: { owner: string; repo: string };
  pullNumber: number;
  comment: {
    id: number;
    body: string;
    author: string;
    url: string;
    path?: string;
    line?: number | null;
    inReplyToId?: number | null;
  };
  timestamp: string;
}

function extractEvent(eventType: string, payload: Record<string, unknown>): WebhookEvent | null {
  const action = payload.action as string;

  // Only process "created" actions (new comments)
  if (action !== "created" && action !== "submitted") {
    return null;
  }

  const repo = payload.repository as { full_name: string; owner: { login: string }; name: string };
  const sender = payload.sender as { login: string };

  // Skip comments from bots (avoid infinite loops)
  if (sender.login.endsWith("[bot]") || sender.login === "github-actions") {
    return null;
  }

  let pullNumber: number;
  let comment: WebhookEvent["comment"];

  if (eventType === "issue_comment") {
    // Only process if it's on a PR (issue_comment fires for both issues and PRs)
    const issue = payload.issue as { pull_request?: unknown; number: number };
    if (!issue.pull_request) {
      return null;
    }
    pullNumber = issue.number;
    const c = payload.comment as { id: number; body: string; user: { login: string }; html_url: string };
    comment = {
      id: c.id,
      body: c.body,
      author: c.user.login,
      url: c.html_url,
    };
  } else if (eventType === "pull_request_review_comment") {
    const pr = payload.pull_request as { number: number };
    pullNumber = pr.number;
    const c = payload.comment as {
      id: number; body: string; user: { login: string }; html_url: string;
      path: string; line: number | null; in_reply_to_id?: number;
    };
    comment = {
      id: c.id,
      body: c.body,
      author: c.user.login,
      url: c.html_url,
      path: c.path,
      line: c.line,
      inReplyToId: c.in_reply_to_id ?? null,
    };
  } else if (eventType === "pull_request_review") {
    const pr = payload.pull_request as { number: number };
    pullNumber = pr.number;
    const review = payload.review as { id: number; body: string; user: { login: string }; html_url: string; state: string };
    // Only process reviews with a body (not empty approvals)
    if (!review.body) {
      return null;
    }
    comment = {
      id: review.id,
      body: `[Review: ${review.state}] ${review.body}`,
      author: review.user.login,
      url: review.html_url,
    };
  } else {
    return null;
  }

  return {
    id: `${eventType}-${comment.id}-${Date.now()}`,
    event: eventType,
    action,
    repository: { owner: repo.owner.login, repo: repo.name },
    pullNumber,
    comment,
    timestamp: new Date().toISOString(),
  };
}

function writeEventFile(event: WebhookEvent): string {
  if (!existsSync(EVENTS_DIR)) {
    mkdirSync(EVENTS_DIR, { recursive: true });
  }

  const filename = `${event.id}.json`;
  const filepath = resolve(EVENTS_DIR, filename);
  writeFileSync(filepath, JSON.stringify(event, null, 2), "utf-8");
  return filepath;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function respond(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Health check
  if (req.method === "GET" && req.url === "/health") {
    respond(res, 200, { status: "ok", eventsDir: EVENTS_DIR });
    return;
  }

  // Only accept POST to /webhook
  if (req.method !== "POST" || req.url !== "/webhook") {
    respond(res, 404, { error: "Not found" });
    return;
  }

  try {
    const body = await readBody(req);

    // Verify signature
    const signature = req.headers["x-hub-signature-256"] as string | undefined;
    if (!verifySignature(body, signature)) {
      console.error("[webhook] Invalid signature");
      respond(res, 401, { error: "Invalid signature" });
      return;
    }

    const eventType = req.headers["x-github-event"] as string;
    if (!SUPPORTED_EVENTS.has(eventType)) {
      respond(res, 200, { status: "ignored", reason: `Unsupported event: ${eventType}` });
      return;
    }

    const payload = JSON.parse(body) as Record<string, unknown>;
    const event = extractEvent(eventType, payload);

    if (!event) {
      respond(res, 200, { status: "skipped", reason: "Event filtered (bot, non-PR, or no body)" });
      return;
    }

    const filepath = writeEventFile(event);
    console.log(`[webhook] Event written: ${filepath}`);
    respond(res, 200, { status: "processed", eventId: event.id, file: filepath });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[webhook] Error: ${message}`);
    respond(res, 500, { error: "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`[webhook] GitHub webhook listener started on port ${PORT}`);
  console.log(`[webhook] Events directory: ${EVENTS_DIR}`);
  console.log(`[webhook] Signature verification: ${SECRET ? "enabled" : "DISABLED (no WEBHOOK_SECRET)"}`);
  console.log(`[webhook] Supported events: ${[...SUPPORTED_EVENTS].join(", ")}`);
});
