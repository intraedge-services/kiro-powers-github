/**
 * Process a single webhook event file.
 *
 * Called by the Kiro hook when a new event file is created.
 * Reads the event, outputs a structured prompt for the agent, then
 * removes the event file to prevent re-processing.
 *
 * Usage: node dist/webhook/process-event.js <event-file-path>
 */

import { readFileSync, unlinkSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

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

function processEvent(filepath: string): void {
  const content = readFileSync(filepath, "utf-8");
  const event: WebhookEvent = JSON.parse(content);

  // Output structured information for the agent
  const output = {
    type: "pr_comment_event",
    repository: `${event.repository.owner}/${event.repository.repo}`,
    pullNumber: event.pullNumber,
    eventType: event.event,
    comment: {
      id: event.comment.id,
      author: event.comment.author,
      body: event.comment.body,
      url: event.comment.url,
      ...(event.comment.path ? { file: event.comment.path, line: event.comment.line } : {}),
      ...(event.comment.inReplyToId ? { inReplyToId: event.comment.inReplyToId } : {}),
    },
    timestamp: event.timestamp,
  };

  // Print for the agent to consume
  console.log(JSON.stringify(output, null, 2));

  // Remove processed event file
  unlinkSync(filepath);
}

function processLatestEvent(): void {
  const eventsDir = resolve(process.cwd(), process.env.WEBHOOK_EVENTS_DIR || ".kiro/webhook-events");

  // If a specific file is provided, process it
  const specificFile = process.argv[2];
  if (specificFile) {
    processEvent(specificFile);
    return;
  }

  // Otherwise, process the oldest unprocessed event
  try {
    const files = readdirSync(eventsDir)
      .filter((f) => f.endsWith(".json"))
      .sort(); // Sorted by name (which includes timestamp)

    if (files.length === 0) {
      console.log(JSON.stringify({ type: "no_events", message: "No pending webhook events" }));
      return;
    }

    const filepath = resolve(eventsDir, files[0]);
    processEvent(filepath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log(JSON.stringify({ type: "no_events", message: "Events directory does not exist yet" }));
    } else {
      throw error;
    }
  }
}

processLatestEvent();
