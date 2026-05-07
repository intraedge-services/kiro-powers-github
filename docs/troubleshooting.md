# GitHub Power — Troubleshooting

## Common Issues

### "Configuration file not found"
**Cause**: `github-power/config.json` doesn't exist.
**Fix**: Run guided setup — ask Kiro: "Set up the GitHub Power"

### "Environment variable not set or empty"
**Cause**: The token environment variable (e.g., `GITHUB_TOKEN`) is not exported.
**Fix**:
```bash
export GITHUB_TOKEN=ghp_your_token_here
```
Then restart Kiro to pick up the new variable.

### "Insufficient permissions / Scope missing"
**Cause**: Token lacks required scopes (`repo`, `project`).
**Fix**: Regenerate token with correct scopes at GitHub → Settings → Developer settings → Personal access tokens.

### "Repository not found"
**Cause**: Repository doesn't exist or token doesn't have access.
**Fix**:
- Verify format: `owner/repo` (e.g., `myorg/myproject`)
- Ensure token has access to the repository
- Check if repository is private (token needs `repo` scope for private repos)

### "Rate limit exceeded"
**Cause**: Too many GitHub API calls in a short period.
**Fix**: The Power automatically retries with backoff. If persistent:
- Wait a few minutes and retry
- Check rate limit status: ask Kiro "Check my GitHub API rate limit"
- Consider using a GitHub App token (higher rate limits)

### "Sync created duplicate issues"
**Cause**: Sync state file was deleted or corrupted.
**Fix**:
- Check `github-power/sync-state.json` exists
- If missing: the Power will search GitHub for existing synced issues (by metadata footer)
- If duplicates exist: manually close duplicates, then re-run sync (it will detect existing issues)

### "MCP server not connecting"
**Cause**: Build not completed or path incorrect.
**Fix**:
1. Run `npm run build` in `github-power/` directory
2. Verify `.kiro/settings/mcp.json` has correct path: `github-power/dist/index.js`
3. Check Kiro's MCP server panel for error messages
4. Restart Kiro

### "Sync state corrupted"
**Cause**: File was manually edited or write was interrupted.
**Fix**: Ask Kiro: "Reset my GitHub sync state"
- This clears the state file
- Next sync will treat all stories as new
- Existing issues won't be duplicated (idempotency check via GitHub search)

### "Stories file not found"
**Cause**: AI-DLC User Stories stage hasn't been completed yet.
**Fix**: Complete the AI-DLC workflow through the User Stories stage first, then sync.

### "GitHub Actions disabled"
**Cause**: `enableGitHubActions` is `false` in config.
**Fix**: Edit `github-power/config.json` and set `"enableGitHubActions": true`
- Also ensure your token has the `workflow` scope

---

## Diagnostic Commands

| Ask Kiro | What it does |
|---|---|
| "Validate my GitHub Power config" | Checks config, token, and connectivity |
| "Show my sync status" | Displays last sync time, item counts |
| "Check GitHub API rate limit" | Shows remaining API calls |
| "Reset sync state" | Clears sync metadata (use with caution) |

---

## Getting Help

If issues persist:
1. Check `github-power/logs/power.log` for detailed error information
2. Check `aidlc-docs/audit.md` for sync operation history
3. Verify your GitHub token at https://github.com/settings/tokens
4. Ensure Node.js 22+ is installed: `node --version`
