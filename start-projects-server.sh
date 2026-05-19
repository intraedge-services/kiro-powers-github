#!/usr/bin/env bash
# Starts the GitHub Projects V2 companion MCP server.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/projects-server/dist/index.js"
