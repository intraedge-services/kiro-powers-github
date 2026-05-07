# kiro-powers-github

GitHub Power for Kiro — manage GitHub Projects, Issues, and Milestones directly from Kiro IDE. Sync AI-DLC user stories to GitHub Projects with a single prompt.

## Features

- **AI-DLC Workflow Integration** — Automatic sync prompt after User Stories stage
- **GitHub Projects V2** — Create projects, custom fields, views, automation rules
- **Issue Management** — CRUD issues, labels, milestones, issue linking
- **GitHub Actions** — List, trigger, and monitor workflows (optional, flag-gated)
- **Configurable Mapping** — Choose how epics/stories/tasks map to GitHub entities
- **Idempotent Sync** — Re-running sync never creates duplicates

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Build
npm run build

# 3. Set your GitHub token
export GITHUB_TOKEN=ghp_your_token_here

# 4. Configure MCP server in your Kiro workspace (.kiro/settings/mcp.json)
# 5. Ask Kiro: "Set up the GitHub Power"
```

## Power Setup Instructions

### Prerequisites
- Node.js 22+ installed (`node --version`)
- A GitHub repository you want to manage
- A GitHub Personal Access Token with `repo` and `project` scopes

### Step 1: Clone and Build

```bash
git clone https://github.com/your-org/kiro-powers-github.git
cd kiro-powers-github
npm install
npm run build
```

### Step 2: Create GitHub Token

1. Go to **GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Click "Generate new token"
3. Select your target repository
4. Grant permissions:
   - **Issues**: Read and Write
   - **Projects**: Read and Write
   - **Metadata**: Read-only
   - **Actions** (optional): Read and Write — only if you want GitHub Actions integration
5. Copy the generated token

### Step 3: Set Environment Variable

```bash
# Add to your shell profile (~/.bashrc, ~/.zshrc, or ~/.profile)
export GITHUB_TOKEN=ghp_your_token_here
```

Restart your terminal or run `source ~/.zshrc` to apply.

### Step 4: Register MCP Servers

Create or update `.kiro/settings/mcp.json` in your Kiro workspace:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "github-power-sync": {
      "command": "node",
      "args": ["/absolute/path/to/kiro-powers-github/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

Replace `/absolute/path/to/kiro-powers-github/` with the actual path where you cloned the repo.

### Step 5: Install Hooks and Steering Files

Copy the hooks and steering files to your Kiro workspace:

```bash
# From the kiro-powers-github directory:
cp hooks/github-power-sync.json /path/to/your/workspace/.kiro/hooks/
cp steering/*.md /path/to/your/workspace/.kiro/steering/
```

Or create symlinks for easier updates:

```bash
ln -s /absolute/path/to/kiro-powers-github/hooks/github-power-sync.json /path/to/your/workspace/.kiro/hooks/
ln -s /absolute/path/to/kiro-powers-github/steering/github-power-sync.md /path/to/your/workspace/.kiro/steering/
ln -s /absolute/path/to/kiro-powers-github/steering/github-power-project-management.md /path/to/your/workspace/.kiro/steering/
ln -s /absolute/path/to/kiro-powers-github/steering/github-power-issue-management.md /path/to/your/workspace/.kiro/steering/
ln -s /absolute/path/to/kiro-powers-github/steering/github-power-template.md /path/to/your/workspace/.kiro/steering/
```

### Step 6: Run Guided Setup

Open Kiro and ask: **"Set up the GitHub Power"**

The guided setup walks you through:
1. Authentication method (PAT or GitHub App)
2. Token validation (checks scopes)
3. Repository selection (`owner/repo`)
4. Project creation or linking
5. Label set configuration
6. Template selection (AI-DLC Standard recommended)
7. Feature flags (`enableGitHubActions`)
8. Sync defaults (mapping strategy, auto-sync)

### Step 7: Verify

Ask Kiro: **"Validate my GitHub Power configuration"**

This confirms:
- Token is valid with correct scopes
- Repository is accessible
- Configuration is complete

### You're Ready!

- **AI-DLC Sync**: After completing User Stories in AI-DLC, you'll be prompted to sync
- **Manual Sync**: Ask Kiro "Sync my user stories to GitHub"
- **Project Management**: Ask Kiro "Create a GitHub Project with AI-DLC template"
- **Issue Management**: Ask Kiro "Create an issue: [title]"

## Project Structure

```
├── POWER.md                         # Kiro Power manifest
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript config (strict, ES2022)
├── src/                             # Source code
│   ├── index.ts                     # MCP server entry point
│   ├── types.ts                     # Shared types, Zod schemas, constants
│   ├── error-handler.ts            # Retry logic, error classification
│   ├── logger.ts                    # Structured logging, rotation
│   ├── config-manager.ts           # Config loading, validation, guided setup
│   ├── story-parser.ts             # Markdown story parsing
│   ├── mapping-strategies.ts       # Sync mapping strategies (A/B/C)
│   ├── sync-state.ts               # Sync state persistence
│   ├── github-client.ts            # GitHub API adapter (wraps MCP tools)
│   ├── sync-engine.ts              # Sync orchestration
│   ├── actions-manager.ts          # GitHub Actions (flag-gated)
│   └── templates/
│       └── aidlc-standard.json     # AI-DLC project template
├── tests/                           # Unit tests (Jest, 66 tests)
├── hooks/                           # Kiro agent hooks
│   └── github-power-sync.json      # Auto-sync after User Stories
├── steering/                        # Kiro steering files
│   ├── github-power-sync.md        # Sync workflow instructions
│   ├── github-power-project-management.md
│   ├── github-power-issue-management.md
│   └── github-power-template.md    # AI-DLC template application
└── docs/                            # Documentation
    ├── setup-guide.md               # Step-by-step setup
    ├── configuration.md             # Config reference
    ├── security.md                  # Security best practices
    ├── usage-patterns.md            # Common usage examples
    └── troubleshooting.md           # Common issues & fixes
```

## MCP Server Configuration

Add to your `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "github-power-sync": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

## Available MCP Tools

| Tool | Description |
|---|---|
| `guided_setup` | Step-by-step Power configuration |
| `validate_config` | Configuration validation and connectivity check |
| `sync_stories` | Sync AI-DLC user stories to GitHub |
| `select_mapping` | Choose mapping strategy |
| `get_sync_status` | View sync state and history |

## Mapping Strategies

| Strategy | Epics → | Stories → | Tasks → |
|---|---|---|---|
| **A: Milestones** | GitHub Milestones | Issues (assigned to milestone) | Checklists in issue body |
| **B: Labels** | Issues with "epic" label | Issues with "story" label | Sub-issues |
| **C: Custom Fields** | Project V2 custom field value | Issues added to project | Task lists in issue body |

## Scripts

| Command | Purpose |
|---|---|
| `npm run build` | Compile TypeScript |
| `npm test` | Run unit tests |
| `npm run test:coverage` | Run tests with coverage (≥80% target) |
| `npm run lint` | Check code quality |
| `npm run format` | Format code |
| `npm audit` | Check dependency vulnerabilities |

## Authentication

Required token scopes:
- `repo` — Issues, PRs, repository access
- `project` — GitHub Projects V2 access
- `workflow` — Only if `enableGitHubActions: true`

## Documentation

- [Setup Guide](docs/setup-guide.md)
- [Configuration Reference](docs/configuration.md)
- [Security Best Practices](docs/security.md)
- [Usage Patterns](docs/usage-patterns.md)
- [Troubleshooting](docs/troubleshooting.md)

## Tech Stack

- Node.js 22+ / TypeScript 5.x (strict mode, ESM)
- `@modelcontextprotocol/sdk` — Official MCP SDK
- `zod` — Schema validation
- `uuid` — Correlation ID generation
- Jest — Testing (66 tests, 80% coverage target)

## License

See [LICENSE](LICENSE) file.
