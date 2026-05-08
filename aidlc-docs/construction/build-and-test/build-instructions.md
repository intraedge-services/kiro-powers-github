# Build Instructions

## Prerequisites
- **Node.js**: v20.0.0 or later
- **npm**: v10.0.0 or later
- **Docker**: Latest stable (for containerized deployment)
- **Environment Variables**: `GITHUB_TOKEN` (GitHub PAT with `repo`, `project`, `read:org` scopes)

## Build Steps

### 1. Install Dependencies

```bash
cd server
npm install
```

This creates `node_modules/` and generates `package-lock.json` if not present.

### 2. Configure Environment

```bash
# Set your GitHub PAT
export GITHUB_TOKEN="ghp_your_personal_access_token_here"

# Optional: Override cache directory
export GITHUB_PROJECTS_CACHE_DIR=".kiro/github-cache"

# Optional: Override cache TTL (seconds)
export GITHUB_PROJECTS_CACHE_TTL="300"
```

### 3. Build the TypeScript Server

```bash
cd server
npm run build
```

This compiles TypeScript from `src/` to `dist/` using the strict tsconfig.

### 4. Build Docker Image

```bash
cd server
docker build -t github-projects-mcp-server .
```

### 5. Verify Build Success

- **Expected Output**: `dist/` directory with compiled `.js` and `.d.ts` files
- **Build Artifacts**:
  - `server/dist/index.js` — Entry point
  - `server/dist/tools/*.js` — Tool handlers
  - `server/dist/graphql/*.js` — GraphQL client and queries
  - `server/dist/cache/*.js` — Cache manager
  - `server/dist/validation/*.js` — Zod schemas
- **Docker Image**: `github-projects-mcp-server:latest`

### 6. Verify Docker Image

```bash
# Check image was created
docker images | grep github-projects-mcp-server

# Test startup (should fail gracefully without GITHUB_TOKEN)
docker run --rm github-projects-mcp-server
# Expected: Error log about missing GITHUB_TOKEN, exit code 1

# Test with token
echo '{"jsonrpc":"2.0","method":"initialize","params":{"capabilities":{}},"id":1}' | \
  docker run -i --rm -e GITHUB_TOKEN=$GITHUB_TOKEN github-projects-mcp-server
# Expected: JSON-RPC response with server capabilities
```

## Troubleshooting

### Build Fails with TypeScript Errors
- **Cause**: Strict mode catches type issues
- **Solution**: Run `npm run lint` to see all type errors, fix them in source

### Build Fails with Missing Dependencies
- **Cause**: `node_modules` not installed or corrupted
- **Solution**: Delete `node_modules` and `package-lock.json`, run `npm install` again

### Docker Build Fails
- **Cause**: Docker not running or insufficient disk space
- **Solution**: Start Docker Desktop, ensure at least 2GB free disk space
