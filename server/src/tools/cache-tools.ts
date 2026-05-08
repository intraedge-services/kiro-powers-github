import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeGraphQL } from "../graphql/client.js";
import { GET_PROJECT_ITEMS } from "../graphql/queries.js";
import { refreshCacheSchema, getCacheStatusSchema, clearCacheSchema } from "../validation/schemas.js";
import { cache } from "../cache/manager.js";
import { log } from "../utils/logger.js";

export function registerCacheTools(server: McpServer): void {
  server.tool("refresh_cache", "Force refresh the project cache", refreshCacheSchema.shape, async (params) => {
    const input = refreshCacheSchema.parse(params);
    log("INFO", "refresh_cache", `Refreshing cache${input.projectId ? ` for project ${input.projectId}` : ""}`);

    if (input.projectId) {
      // Refresh specific project cache
      await cache.invalidateProject(input.projectId);

      const result = await executeGraphQL<{ node: { items: { nodes: unknown[] } } }>(
        GET_PROJECT_ITEMS,
        { projectId: input.projectId, first: 100 },
      );

      await cache.set(`items-${input.projectId}`, result.node.items);

      return {
        content: [{ type: "text" as const, text: JSON.stringify({ refreshed: true, itemCount: result.node.items.nodes.length }) }],
      };
    }

    // Clear all cache
    await cache.clear();

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ refreshed: true, itemCount: 0 }) }],
    };
  });

  server.tool("get_cache_status", "Check the current cache state", getCacheStatusSchema.shape, async () => {
    log("INFO", "get_cache_status", "Checking cache status");

    const status = await cache.getStatus();

    return {
      content: [{ type: "text" as const, text: JSON.stringify(status) }],
    };
  });

  server.tool("clear_cache", "Clear all cached project data", clearCacheSchema.shape, async () => {
    log("INFO", "clear_cache", "Clearing all cache");

    await cache.clear();

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
    };
  });
}
