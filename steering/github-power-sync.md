---
inclusion: manual
---

# GitHub Power — Sync Instructions

## When to Use
This steering file provides instructions for syncing AI-DLC user stories to GitHub Projects. It is triggered by the `github-power-sync` hook after the User Stories stage completes, or manually by the user.

## Pre-Sync Check
1. Verify `github-power/config.json` exists
2. If not configured: inform user "GitHub Power is not configured. Use the `guided_setup` tool to set it up." and continue workflow
3. If configured: proceed with sync prompt

## Sync Prompt
Present to user:
```
Would you like to sync user stories to GitHub Projects?

A) Yes — Sync now
B) No — Continue without syncing
```

## If User Chooses "Yes"

### Step 1: Mapping Strategy Selection
Call the `select_mapping` tool or present options:
```
Select a mapping strategy for syncing stories to GitHub:

A) Milestones — Epics become Milestones, Stories become Issues assigned to milestones
B) Labels — Epics and Stories become Issues with "epic"/"story" labels
C) Custom Fields — Stories become Issues, Epic tracked via Project V2 custom field
D) Custom — Define your own mapping
```

### Step 2: Execute Sync
Call the `sync_stories` MCP tool with:
- `storiesPath`: "aidlc-docs/inception/user-stories/stories.md"
- `mappingStrategy`: user's selection from Step 1
- `dryRun`: false

### Step 3: Report Results
Present sync results to user:
```
✅ Sync complete!
- Created: [n] issues
- Updated: [n] issues
- Skipped: [n] (unchanged)
- Failed: [n]

[If failures exist:]
⚠️ Failed items:
- Story [id]: [error message]
```

## If User Chooses "No"
Continue the AI-DLC workflow without any sync action.

## Error Handling
- If GitHub API is unreachable: inform user and offer to skip or retry later
- If token is invalid: suggest running `validate_config` tool
- Never block the AI-DLC workflow on sync failure — always offer to continue

## Manual Sync
Users can trigger sync at any time by asking to "sync stories to GitHub" or "run GitHub sync". Follow the same steps above.

## Retry Failed Items
If user asks to "retry failed sync items", call `sync_stories` with `retryFailedOnly: true`.
