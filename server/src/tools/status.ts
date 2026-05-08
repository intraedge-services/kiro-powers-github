import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeGraphQL } from "../graphql/client.js";
import { UPDATE_ITEM_FIELD_VALUE } from "../graphql/mutations.js";
import { GET_STATUS_FIELD } from "../graphql/queries.js";
import { updateItemStatusSchema, bulkUpdateStatusSchema, getStatusOptionsSchema } from "../validation/schemas.js";
import { cache } from "../cache/manager.js";
import { log } from "../utils/logger.js";

interface StatusOption {
  id: string;
  name: string;
  color: string;
}

interface StatusField {
  id: string;
  name: string;
  options: StatusOption[];
}

async function getStatusFieldAndOption(projectId: string, statusName: string): Promise<{ fieldId: string; optionId: string }> {
  const result = await executeGraphQL<{ node: { field: StatusField } }>(
    GET_STATUS_FIELD,
    { projectId },
  );

  const field = result.node.field;
  if (!field) {
    throw new Error("Status field not found on this project");
  }

  const option = field.options.find((o) => o.name.toLowerCase() === statusName.toLowerCase());
  if (!option) {
    const available = field.options.map((o) => o.name).join(", ");
    throw new Error(`Status "${statusName}" not found. Available: ${available}`);
  }

  return { fieldId: field.id, optionId: option.id };
}

export function registerStatusTools(server: McpServer): void {
  server.tool("update_item_status", "Move a project item to a different status column", updateItemStatusSchema.shape, async (params) => {
    const input = updateItemStatusSchema.parse(params);
    log("INFO", "update_item_status", `Moving item ${input.itemId} to "${input.status}"`);

    const { fieldId, optionId } = await getStatusFieldAndOption(input.projectId, input.status);

    await executeGraphQL(UPDATE_ITEM_FIELD_VALUE, {
      projectId: input.projectId,
      itemId: input.itemId,
      fieldId,
      value: { singleSelectOptionId: optionId },
    });

    await cache.invalidate(`items-${input.projectId}`);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ itemId: input.itemId, newStatus: input.status }) }],
    };
  });

  server.tool("bulk_update_status", "Move multiple items to a status column", bulkUpdateStatusSchema.shape, async (params) => {
    const input = bulkUpdateStatusSchema.parse(params);
    log("INFO", "bulk_update_status", `Moving ${input.itemIds.length} items to "${input.status}"`);

    const { fieldId, optionId } = await getStatusFieldAndOption(input.projectId, input.status);

    let updated = 0;
    for (const itemId of input.itemIds) {
      await executeGraphQL(UPDATE_ITEM_FIELD_VALUE, {
        projectId: input.projectId,
        itemId,
        fieldId,
        value: { singleSelectOptionId: optionId },
      });
      updated++;
    }

    await cache.invalidate(`items-${input.projectId}`);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ updated }) }],
    };
  });

  server.tool("get_status_options", "List available status values for a project", getStatusOptionsSchema.shape, async (params) => {
    const input = getStatusOptionsSchema.parse(params);
    log("INFO", "get_status_options", `Getting status options for project ${input.projectId}`);

    const result = await executeGraphQL<{ node: { field: StatusField } }>(
      GET_STATUS_FIELD,
      { projectId: input.projectId },
    );

    const options = result.node.field?.options || [];

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ options }) }],
    };
  });
}
