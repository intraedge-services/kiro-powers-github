# GitHub Webhook Setup for Automated PR Comment Responses

This guide sets up a fully automated flow where GitHub PR comments trigger Kiro to analyze and respond.

## Architecture

```
GitHub PR Comment → GitHub Webhook → Webhook Listener (port 3847)
    → Writes event file to .kiro/webhook-events/
    → Kiro hook detects new file (fileCreated event)
    → Agent reads comment, analyzes PR context, posts reply
```

## Step 1: Start the Webhook Listener

The webhook listener is a lightweight HTTP server that receives GitHub webhook payloads.

```bash
# Development (with hot reload)
cd server
npm run webhook:dev

# Production (from compiled dist)
cd server
npm run webhook
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WEBHOOK_PORT` | `3847` | Port for the HTTP listener |
| `WEBHOOK_SECRET` | _(empty)_ | GitHub webhook secret for HMAC verification |
| `WEBHOOK_EVENTS_DIR` | `.kiro/webhook-events` | Directory for event files |

## Step 2: Expose the Listener (for GitHub to reach it)

GitHub needs to send webhooks to your listener. Options:

### Option A: ngrok (Development)

```bash
ngrok http 3847
```

Use the generated `https://xxxx.ngrok.io/webhook` URL in GitHub.

### Option B: Cloudflare Tunnel (Production)

```bash
cloudflared tunnel --url http://localhost:3847
```

### Option C: Deploy to a server

Deploy the webhook listener to any server with a public IP/domain. The listener is stateless and lightweight.

## Step 3: Configure GitHub Webhook

1. Go to your repository → **Settings** → **Webhooks** → **Add webhook**
2. Configure:
   - **Payload URL**: `https://your-domain.com/webhook`
   - **Content type**: `application/json`
   - **Secret**: Set a strong secret (same as `WEBHOOK_SECRET` env var)
   - **Events**: Select individual events:
     - ✅ Issue comments
     - ✅ Pull request review comments
     - ✅ Pull request reviews

3. Click **Add webhook**

## Step 4: Verify the Hook is Active

The Kiro hook at `hooks/pr-comment-responder.kiro.hook` watches for new files in `.kiro/webhook-events/`. When a PR comment arrives:

1. Webhook listener writes a JSON event file
2. Kiro detects the new file via `fileCreated` event
3. Agent processes the comment and responds on GitHub

### Test the flow

```bash
# Send a test webhook payload
curl -X POST http://localhost:3847/webhook \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: issue_comment" \
  -d '{
    "action": "created",
    "issue": { "number": 1, "pull_request": {} },
    "comment": { "id": 123, "body": "Can you explain this change?", "user": {"login": "testuser"}, "html_url": "https://github.com/..." },
    "repository": { "full_name": "owner/repo", "owner": {"login": "owner"}, "name": "repo" },
    "sender": { "login": "testuser" }
  }'
```

Check that a file appears in `.kiro/webhook-events/`.

## Step 5: Health Check

```bash
curl http://localhost:3847/health
# {"status":"ok","eventsDir":".kiro/webhook-events"}
```

## How the Agent Responds

When triggered, the agent:

1. Reads the event file to get comment details
2. Fetches PR context (title, description, changed files)
3. Reads the conversation thread for context
4. Analyzes the comment type (question, suggestion, feedback)
5. Posts an appropriate reply using the MCP comment tools
6. Deletes the processed event file

### Smart Filtering

The system automatically skips:
- Bot comments (prevents infinite loops)
- Comments on non-PR issues
- Empty reviews (approvals without text)
- Acknowledgments (LGTM, thanks, etc.) — handled by the agent prompt

## Available MCP Tools for Comments

| Tool | Description |
|------|-------------|
| `list_pr_comments` | List conversation comments on a PR |
| `get_pr_comment` | Get a specific comment by ID |
| `create_pr_comment` | Post a new conversation comment |
| `list_pr_review_comments` | List inline code review comments |
| `create_pr_review_comment` | Create an inline review comment |
| `reply_to_pr_review_comment` | Reply to an existing review thread |

## Troubleshooting

**Webhook not receiving events:**
- Check GitHub webhook delivery log (Settings → Webhooks → Recent Deliveries)
- Verify your tunnel/public URL is accessible
- Check `WEBHOOK_SECRET` matches between GitHub and your env

**Agent not triggering:**
- Verify the hook file exists at `hooks/pr-comment-responder.kiro.hook`
- Check that `.kiro/webhook-events/` directory is being created
- Ensure Kiro is running in Autopilot mode (hooks require it)

**Infinite loop concerns:**
- The webhook listener filters out bot comments automatically
- The agent prompt instructs not to reply to acknowledgments
- Add your bot's username to the filter if using a GitHub App
