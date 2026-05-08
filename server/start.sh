#!/usr/bin/env bash
# MCP server startup script
# Ensures Node.js is available even when launched outside a login shell
# (e.g., when Kiro/IDE spawns the process without inheriting shell profile)

# Try to load NVM if node isn't already available
if ! command -v node &> /dev/null; then
  # Common NVM locations
  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$NVM_DIR/nvm.sh" ]; then
    source "$NVM_DIR/nvm.sh"
  elif [ -s "/usr/local/opt/nvm/nvm.sh" ]; then
    # Homebrew NVM location
    source "/usr/local/opt/nvm/nvm.sh"
  elif [ -s "/opt/homebrew/opt/nvm/nvm.sh" ]; then
    # Apple Silicon Homebrew NVM location
    source "/opt/homebrew/opt/nvm/nvm.sh"
  fi
fi

# Try fnm as an alternative to NVM
if ! command -v node &> /dev/null; then
  if command -v fnm &> /dev/null; then
    eval "$(fnm env)"
  elif [ -d "$HOME/.fnm" ]; then
    export PATH="$HOME/.fnm:$PATH"
    eval "$(fnm env)"
  fi
fi

# Try common Node.js install locations as last resort
if ! command -v node &> /dev/null; then
  for dir in /usr/local/bin /opt/homebrew/bin "$HOME/.local/bin"; do
    if [ -x "$dir/node" ]; then
      export PATH="$dir:$PATH"
      break
    fi
  done
fi

# Verify node is available
if ! command -v node &> /dev/null; then
  echo "ERROR: node not found. Install Node.js 20+ or ensure NVM/fnm is configured." >&2
  exit 1
fi

# Run the MCP server from the script's directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/dist/index.js"
