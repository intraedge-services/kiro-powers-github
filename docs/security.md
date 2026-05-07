# GitHub Power — Security Best Practices

## Token Management

### Do
- ✅ Store tokens in environment variables (`export GITHUB_TOKEN=ghp_...`)
- ✅ Use fine-grained tokens with minimum required scopes
- ✅ Rotate tokens regularly (every 90 days recommended)
- ✅ Use different tokens for different environments
- ✅ Add `GITHUB_TOKEN` to your `.gitignore` and `.env.example`

### Don't
- ❌ Never commit tokens to version control
- ❌ Never put tokens in `config.json` or any file
- ❌ Never share tokens in chat, issues, or documentation
- ❌ Never use tokens with more scopes than needed
- ❌ Never use organization-wide tokens for single-repo access

## Minimum Required Scopes

| Scope | When Needed | What It Allows |
|---|---|---|
| `repo` | Always | Read/write issues, PRs, repository content |
| `project` | Always | Read/write GitHub Projects V2 |
| `workflow` | Only if `enableGitHubActions: true` | Trigger and read workflow runs |

## Sync State Security

The `github-power/sync-state.json` file:
- ✅ Safe to commit to version control (contains no secrets)
- Contains only: story IDs, issue numbers, URLs, timestamps, checksums
- Never contains: tokens, credentials, or personal data

## Log Security

The Power automatically:
- Redacts all token patterns (`ghp_*`, `ghs_*`) from logs
- Redacts Authorization headers
- Never logs environment variable values
- Provides generic error messages to users (no internal details)

Log files at `github-power/logs/power.log`:
- ⚠️ Review before sharing (may contain repository names, issue titles)
- ✅ Safe from credential exposure (auto-redacted)

## Error Handling Security

- All errors **fail closed** (deny/halt, never fail open)
- Authentication failures logged at error level for monitoring
- No stack traces or internal paths exposed to users
- Rate limit handling prevents abuse of GitHub API

## Network Security

- All GitHub API communication over HTTPS (TLS 1.2+)
- No outbound requests to non-GitHub endpoints
- Timeout configured (default 30s) to prevent hanging connections

## Dependency Security

- Only 3 production dependencies (minimal attack surface)
- All versions pinned exactly in `package-lock.json`
- Run `npm audit` regularly to check for vulnerabilities
- Dependencies sourced from official npm registry only

## Recommendations for Teams

1. **Use GitHub App authentication** for shared/team environments (more secure than PATs)
2. **Set up token rotation** reminders (calendar/automation)
3. **Review auto-approve settings** — only auto-approve read-only operations
4. **Monitor audit trail** — check `aidlc-docs/audit.md` for unexpected sync operations
5. **Restrict repository access** — use fine-grained tokens scoped to specific repos
