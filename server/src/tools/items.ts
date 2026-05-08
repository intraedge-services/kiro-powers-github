import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeGraphQL } from "../graphql/client.js";
import { ADD_ITEM_TO_PROJECT, REMOVE_ITEM_FROM_PROJECT, ARCHIVE_ITEM, UNARCHIVE_ITEM } from "../graphql/mutations.js";
import { GET_PROJECT_ITEMS } from "../graphql/queries.js";
import { addItemSchema, removeItemSchema, getProjectItemsSchema, archiveItemSchema, unarchiveItemSchema, bulkAddItemsSchema, bulkArchiveItemsSchema } from "../validation/schemas.js";
import { cache } from "../cache/manager.js";
import { log } from "../utils/logger.js";

export function registerItemTools(server: McpServer): void {
  server.tool("add_item_to_project", "Add an issue or PR to a GitHub Project V2", addItemSchema.shape, async (params) => {
    const input = addItemSchema.parse(params);
    log("INFO", "add_item_to_project", `Adding item to project ${input.projectId}`);

    const result = await executeGraphQL<{ addProjectV2ItemById: { item: { id: string; content: { title: string; number: number } } } }>(
      ADD_ITEM_TO_PROJECT,
      { projectId: input.projectId, contentId: input.contentId },
    );

    await cache.invalidate(`items-${input.projectId}`);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ itemId: result.addProjectV2ItemById.item.id, ...result.addProjectV2ItemById.item.content }) }],
    };
  });

  server.tool("remove_item_from_project", "Remove an item from a GitHub Project V2", removeItemSchema.shape, async (params) => {
    const input = removeItemSchema.parse(params);
    log("INFO", "remove_item_from_project", `Removing item ${input.itemId} from project`);

    await executeGraphQL(REMOVE_ITEM_FROM_PROJECT, { projectId: input.projectId, itemId: input.itemId });
    await cache.invalidate(`items-${input.projectId}`);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
    };
  });

  server.tool("get_project_items", "List items in a GitHub Project V2 with optional filters", getProjectItemsSchema.shape, async (params) => {
    const input = getProjectItemsSchema.parse(params);
    log("INFO", "get_project_items", `Getting items for project ${input.projectId}`);

    const cacheKey = `items-${input.projectId}`;
    if (!input.status && !input.assignee && !input.after) {
      const cached = await cache.get<unknown>(cacheKey);
      if (cached) {
        return { content: [{ type: "text" as const, text: JSON.stringify(cached) }] };
      }
    }

    const result = await executeGraphQL<{ node: { items: { pageInfo: { hasNextPage: boolean; endCursor: string }; nodes: unknown[] } } }>(
      GET_PROJECT_ITEMS,
      { projectId: input.projectId, first: input.first, after: input.after },
    );

    const items = result.node.items;

    if (!input.status && !input.assignee && !input.after) {
      await cache.set(cacheKey, items);
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(items) }],
    };
  });

  server.tool("archive_item", "Archive a project item", archiveItemSchema.shape, async (params) => {
    const input = archiveItemSchema.parse(params);
    log("INFO", "archive_item", `Archiving item ${input.itemId}`);

    await executeGraphQL(ARCHIVE_ITEM, { projectId: input.projectId, itemId: input.itemId });
    await cache.invalidate(`items-${input.projectId}`);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
    };
  });

  server.tool("unarchive_item", "Unarchive a project item", unarchiveItemSchema.shape, async (params) => {
    const input = unarchiveItemSchema.parse(params);
    log("INFO", "unarchive_item", `Unarchiving item ${input.itemId}`);

    await executeGraphQL(UNARCHIVE_ITEM, { projectId: input.projectId, itemId: input.itemId });
    await cache.invalidate(`items-${input.projectId}`);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
    };
  });

  server.tool("bulk_add_items", "Add multiple issues/PRs to a project at once", bulkAddItemsSchema.shape, async (params) => {
    const input = bulkAddItemsSchema.parse(params);
    log("INFO", "bulk_add_items", `Bulk adding ${input.contentIds.length} items to project`);

    const results: { id: string; title: string }[] = [];
    for (const contentId of input.contentIds) {
      const result = await executeGraphQL<{ addProjectV2ItemById: { item: { id: string; content: { title: string } } } }>(
        ADD_ITEM_TO_PROJECT,
        { projectId: input.projectId, contentId },
      );
      results.push({ id: result.addProjectV2ItemById.item.id, title: result.addProjectV2ItemById.item.content.title });
    }

    await cache.invalidate(`items-${input.projectId}`);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ added: results.length, items: results }) }],
    };
  });

  server.tool("bulk_archive_items", "Archive multiple items by criteria", bulkArchiveItemsSchema.shape, async (params) => {
    const input = bulkArchiveItemsSchema.parse(params);
    log("INFO", "bulk_archive_items", `Bulk archiving items in project ${input.projectId}`);

    // Fetch items to find matching ones
    const itemsResult = await executeGraphQL<{ node: { items: { nodes: Array<{ id: string; fieldValues: { nodes: Array<{ name?: string }> } }> } } }>(
      GET_PROJECT_ITEMS,
      { projectId: input.projectId, first: 100 },
    );

    let archived = 0;
    for (const item of itemsResult.node.items.nodes) {
      // Simple status filter if provided
      if (input.status) {
        const statusField = item.fieldValues?.nodes?.find((fv) => fv.name === input.status);
        if (!statusField) continue;
      }
      await executeGraphQL(ARCHIVE_ITEM, { projectId: input.projectId, itemId: item.id });
      archived++;
    }

    await cache.invalidate(`items-${input.projectId}`);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ archived }) }],
    };
  });
}
