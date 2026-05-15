#!/usr/bin/env bash
#
# Simplest possible test: directly create an event file.
#
# This bypasses the webhook listener entirely and just drops
# a fake event into .kiro/webhook-events/ so the Kiro hook fires.
#
# Prerequisites:
#   - Kiro running in Autopilot mode
#   - The pr-comment-responder hook is active
#
# Usage:
#   ./test-hook-trigger.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EVENTS_DIR="$SCRIPT_DIR/../.kiro/webhook-events"

mkdir -p "$EVENTS_DIR"

EVENT_ID="issue_comment-99999-$(date +%s)"
EVENT_FILE="$EVENTS_DIR/$EVENT_ID.json"

cat > "$EVENT_FILE" << 'EOF'
{
  "id": "issue_comment-99999-test",
  "event": "issue_comment",
  "action": "created",
  "repository": {
    "owner": "test-owner",
    "repo": "test-repo"
  },
  "pullNumber": 42,
  "comment": {
    "id": 99999,
    "body": "What's the performance impact of this change? Have you run any benchmarks?",
    "author": "reviewer-bob",
    "url": "https://github.com/test-owner/test-repo/pull/42#issuecomment-99999"
  },
  "timestamp": "2026-05-13T12:00:00Z"
}
EOF

echo "✓ Event file created: $EVENT_FILE"
echo ""
echo "If Kiro is in Autopilot mode, the pr-comment-responder hook"
echo "should fire now and the agent will process this comment."
echo ""
echo "Watch for agent activity in the Kiro chat panel."
