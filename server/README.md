# GitHub Projects V2 MCP Server

A Model Context Protocol (MCP) server that provides GitHub Projects V2 management tools via the GraphQL API. Designed to work as a sidecar alongside the official GitHub MCP Server within the Kiro Power for GitHub.

## Features

- **36 tools** across 9 categories: projects, items, status, fields, iterations, views, workflows, analytics, cache
- **File-based caching** with configurable TTL for reduced API calls
- **Proactive rate limit tracking** with warnings and automatic queuing
- **Zod input validation** on all tool parameters
- **Exponential backoff retry** for transient errors
- **Docker containerized** with non-root execution

## Prerequisites

- Node.js 20+ (for local development)
- Docker (for containerized deployment)
- GitHub Personal Access Token with scopes: `repo`, `project`, `read:org`

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GITHUB_TOKEN` | Yes | — | GitHub PAT with required scopes |
| `GITHUB_PROJECTS_CACHE_DIR` | No | `.kiro/github-cache` | Cache directory path |
| `GITHUB_PROJECTS_CACHE_TTL` | No | `300` | Cache TTL in seconds |

## Quick Start

### Local Development

```bash
cd server
npm install
npm run dev
```

### Docker

```bash
cd server
docker build -t github-projects-mcp-server .
docker run -e GITHUB_TOKEN=$GITHUB_TOKEN github-projects-mcp-server
```

## Tool Reference

### Project Management (5 tools)
| Tool | Description |
|---|---|
| `create_project` | Create a new GitHub Project V2 |
| `list_projects` | List projects for a user/org |
| `get_project` | Get project details |
| `update_project` | Update project settings |
| `delete_project` | Delete a project |

### Item Management (7 tools)
| Tool | Description |
|---|---|
| `add_item_to_project` | Add issue/PR to project |
| `remove_item_from_project` | Remove item from project |
| `get_project_items` | List items with filters |
| `archive_item` | Archive an item |
| `unarchive_item` | Unarchive an item |
| `bulk_add_items` | Add multiple items |
| `bulk_archive_items` | Archive items by criteria |

### Status Transitions (3 tools)
| Tool | Description |
|---|---|
| `update_item_status` | Move item between columns |
| `bulk_update_status` | Move multiple items |
| `get_status_options` | List available statuses |

### Custom Fields (4 tools)
| Tool | Description |
|---|---|
| `create_field` | Create custom field |
| `update_item_field` | Set field value |
| `get_project_fields` | List all fields |
| `delete_field` | Delete a field |

### Iterations (4 tools)
| Tool | Description |
|---|---|
| `create_iteration` | Create iteration/sprint |
| `assign_item_to_iteration` | Assign item to iteration |
| `get_iteration_items` | List iteration items |
| `list_iterations` | List all iterations |

### Views (3 tools)
| Tool | Description |
|---|---|
| `create_view` | Create project view |
| `list_views` | List views |
| `delete_view` | Delete a view |

### Workflows (4 tools)
| Tool | Description |
|---|---|
| `create_auto_add_workflow` | Auto-add new issues |
| `create_status_workflow` | Auto-set status |
| `list_workflows` | List workflows |
| `toggle_workflow` | Enable/disable workflow |

### Analytics (3 tools)
| Tool | Description |
|---|---|
| `get_project_stats` | Project statistics |
| `get_iteration_burndown` | Iteration progress |
| `get_stale_items` | Find stale items |

### Cache (3 tools)
| Tool | Description |
|---|---|
| `refresh_cache` | Force cache refresh |
| `get_cache_status` | Check cache state |
| `clear_cache` | Clear all cache |

## Testing

```bash
npm test
```

## Architecture

```
src/
├── index.ts              # Entry point, server setup
├── tools/                # Tool handlers (one file per category)
├── graphql/              # GraphQL client, queries, mutations
├── cache/                # File-based cache manager
├── validation/           # Zod schemas
└── utils/                # Logger
```

## License

MIT
