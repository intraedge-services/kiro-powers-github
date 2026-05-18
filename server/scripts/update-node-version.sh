#!/usr/bin/env bash
#
# Fetches the current Active LTS version of Node.js and updates
# all references in the project. Run this whenever you want to
# ensure the project targets the latest LTS.
#
# Usage:
#   ./scripts/update-node-version.sh
#
# What it updates:
#   - package.json engines field
#   - .nvmrc (stays as lts/*)
#   - start.sh message
#   - README references

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"

echo "Fetching current Node.js Active LTS version..."

# Query the Node.js release schedule API
LTS_VERSION=$(curl -s https://nodejs.org/dist/index.json | python3 -c "
import json, sys
releases = json.load(sys.stdin)
for r in releases:
    if r.get('lts'):
        major = r['version'].split('.')[0].lstrip('v')
        print(major)
        break
")

if [ -z "$LTS_VERSION" ]; then
  echo "ERROR: Could not determine latest LTS version"
  exit 1
fi

echo "Latest Active LTS: Node.js $LTS_VERSION"
echo ""

# Update package.json engines
CURRENT_ENGINE=$(python3 -c "
import json
with open('$SERVER_DIR/package.json') as f:
    pkg = json.load(f)
print(pkg.get('engines', {}).get('node', 'not set'))
")
echo "Current engines.node: $CURRENT_ENGINE"

python3 -c "
import json
with open('$SERVER_DIR/package.json', 'r') as f:
    pkg = json.load(f)
pkg['engines'] = {'node': '>=${LTS_VERSION}.0.0'}
with open('$SERVER_DIR/package.json', 'w') as f:
    json.dump(pkg, f, indent=2)
    f.write('\n')
"
echo "Updated package.json engines to: >=${LTS_VERSION}.0.0"

# Update start.sh message if it references a version
if grep -q "Node.js [0-9]" "$SERVER_DIR/start.sh" 2>/dev/null; then
  sed -i '' "s/Node.js [0-9]\{1,2\}+/Node.js ${LTS_VERSION}+/g" "$SERVER_DIR/start.sh"
  echo "Updated start.sh version reference"
fi

echo ""
echo "Done! Node.js version references updated to $LTS_VERSION (Active LTS)."
echo ""
echo "Next steps:"
echo "  1. Run 'nvm use' to switch your local Node version"
echo "  2. Run 'npm install' to verify compatibility"
echo "  3. Run 'npm run build' to confirm compilation"
echo "  4. Commit the changes"
