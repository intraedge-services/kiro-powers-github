#!/usr/bin/env bash
#
# Test the full PR comment webhook flow locally.
#
# This script simulates what GitHub would send when someone
# comments on a PR. No ngrok or real webhook needed.
#
# Usage:
#   ./test-webhook-flow.sh
#
# What it does:
#   1. Starts the webhook listener in the background
#   2. Sends a fake PR comment event to it
#   3. Shows the event file that was created
#   4. Stops the listener
#
# After running this, if Kiro is in Autopilot mode, the
# pr-comment-responder hook will fire automatically.

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EVENTS_DIR="$SCRIPT_DIR/../.kiro/webhook-events"
PORT=3847

echo "=== PR Comment Webhook Flow Test ==="
echo ""

# Step 1: Start webhook listener
echo "1) Starting webhook listener on port $PORT..."
cd "$SCRIPT_DIR"
node dist/webhook/listener.js &
LISTENER_PID=$!
sleep 1

# Check it started
if ! kill -0 $LISTENER_PID 2>/dev/null; then
  echo "   ERROR: Listener failed to start. Run 'npm run build' first."
  exit 1
fi
echo "   ✓ Listener running (PID: $LISTENER_PID)"
echo ""

# Step 2: Send a simulated PR comment
echo "2) Sending simulated PR comment event..."
RESPONSE=$(curl -s -X POST http://localhost:$PORT/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: issue_comment" \
  -d '{
    "action": "created",
    "issue": {
      "number": 42,
      "title": "Add user authentication",
      "pull_request": { "url": "https://api.github.com/repos/test-owner/test-repo/pulls/42" }
    },
    "comment": {
      "id": 98765,
      "body": "Can you explain why you chose JWT over session-based auth here?",
      "user": { "login": "reviewer-alice" },
      "html_url": "https://github.com/test-owner/test-repo/pull/42#issuecomment-98765",
      "created_at": "2026-05-13T10:00:00Z"
    },
    "repository": {
      "full_name": "test-owner/test-repo",
      "owner": { "login": "test-owner" },
      "name": "test-repo"
    },
    "sender": { "login": "reviewer-alice" }
  }')

echo "   Response: $RESPONSE"
echo ""

# Step 3: Show the event file
echo "3) Checking event file..."
if [ -d "$EVENTS_DIR" ]; then
  EVENT_FILE=$(ls -t "$EVENTS_DIR"/*.json 2>/dev/null | head -1)
  if [ -n "$EVENT_FILE" ]; then
    echo "   ✓ Event file created: $EVENT_FILE"
    echo ""
    echo "   Contents:"
    cat "$EVENT_FILE" | sed 's/^/   /'
    echo ""
  else
    echo "   ✗ No event file found"
  fi
else
  echo "   ✗ Events directory not created"
fi

# Step 4: Stop listener
echo "4) Stopping webhook listener..."
kill $LISTENER_PID 2>/dev/null
echo "   ✓ Done"
echo ""

echo "=== What happens next ==="
echo ""
echo "If Kiro is running in Autopilot mode, the hook at"
echo "hooks/pr-comment-responder.kiro.hook will detect the new"
echo "event file and trigger the agent to:"
echo "  - Read the comment details"
echo "  - Fetch PR context via get_pull_request"
echo "  - Analyze the comment"
echo "  - Post a reply via create_pr_comment or reply_to_pr_review_comment"
echo ""
echo "To test manually without the hook, you can ask Kiro:"
echo "  'Read the file in .kiro/webhook-events/ and respond to the PR comment'"
echo ""
