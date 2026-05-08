import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeGraphQL } from "../graphql/client.js";
import { UPDATE_ITEM_FIELD_VALUE } from "../graphql/mutations.js";
import { GET_PROJECT_FIELDS, GET_PROJECT_ITEMS } from "../graphql/queries.js";
import { createIterationSchema, assignItemToIterationSchema, getIterationItemsSchema, listIterationsSchema } from "../validation/schemas.js";
import { cache } from "../cache/manager.js";
import { log } from "../utils/logger.js";

export function registerIterationTools(server: McpServer): void {
  server.tool("create_iteration", "Create a new iteration/sprint on a project", createIterationSchema.shape, async (params) => {
    const input = createIterationSchema.parse(params);
    log("INFO", "create_iteration", `Creating iteration "${input.title}" starting ${input.startDate}`);

    // Note: GitHub Projects V2 iterations are created via field configuration updates.
    // The GraphQL API for creating iterations is limited — this provides the interface.
    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        message: "Iteration creation requires project field configuration. Use the GitHub UI to add iterations to the iteration field, or update the field configuration via API.",
        fieldId: input.fieldId,
        title: input.title,
        startDate: input.startDate,
        duration: input.duration,
      }) }],
    };
  });

  server.tool("assign_item_to_iteration", "Assign a project item to an iteration", assignItemToIterationSchema.shape, async (params) => {
    const input = assignItemToIterationSchema.parse(params);
    log("INFO", "assign_item_to_iteration", `Assigning item ${input.itemId} to iteration ${input.iterationId}`);

    // Find the iteration field ID
    const fieldsResult = await executeGraphQL<{ node: { fields: { nodes: Array<{ id: string; name: string; dataType: string }> } } }>(
      GET_PROJECT_FIELDS,
      { projectId: input.projectId },
    );

    const iterationField = fieldsResult.node.fields.nodes.find((f) => f.dataType === "ITERATION");
    if (!iterationField) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "No iteration field found on this project" }) }] };
    }

    await executeGraphQL(UPDATE_ITEM_FIELD_VALUE, {
      projectId: input.projectId,
      itemId: input.itemId,
      fieldId: iterationField.id,
      value: { iterationId: input.iterationId },
    });

    await cache.invalidate(`items-${input.projectId}`);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, itemId: input.itemId, iterationId: input.iterationId }) }],
    };
  });

  server.tool("get_iteration_items", "List items assigned to a specific iteration", getIterationItemsSchema.shape, async (params) => {
    const input = getIterationItemsSchema.parse(params);
    log("INFO", "get_iteration_items", `Getting items for iteration ${input.iterationId}`);

    // Fetch all items and filter by iteration
    const result = await executeGraphQL<{ node: { items: { nodes: Array<{ id: string; content: { title: string }; fieldValues: { nodes: Array<{ title?: string }> } }> } } }>(
      GET_PROJECT_ITEMS,
      { projectId: input.projectId, first: 100 },
    );

    const items = result.node.items.nodes.filter((item) =>
      item.fieldValues?.nodes?.some((fv) => fv.title === input.iterationId)
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ items: items.map((i) => ({ id: i.id, title: i.content?.title })) }) }],
    };
  });

  server.tool("list_iterations", "List all iterations on a project", listIterationsSchema.shape, async (params) => {
    const input = listIterationsSchema.parse(params);
    log("INFO", "list_iterations", `Listing iterations for field ${input.fieldId}`);

    const result = await executeGraphQL<{ node: { fields: { nodes: Array<{ id: string; dataType: string; configuration?: { iterations: unknown[] } }> } } }>(
      GET_PROJECT_FIELDS,
      { projectId: input.projectId },
    );

    const iterationField = result.node.fields.nodes.find((f) => f.id === input.fieldId && f.dataType === "ITERATION");
    const iterations = iterationField?.configuration?.iterations || [];

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ iterations }) }],
    };
  });
}
