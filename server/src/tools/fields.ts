import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeGraphQL } from "../graphql/client.js";
import { CREATE_FIELD, DELETE_FIELD, UPDATE_ITEM_FIELD_VALUE } from "../graphql/mutations.js";
import { GET_PROJECT_FIELDS } from "../graphql/queries.js";
import { createFieldSchema, updateItemFieldSchema, getProjectFieldsSchema, deleteFieldSchema } from "../validation/schemas.js";
import { cache } from "../cache/manager.js";
import { log } from "../utils/logger.js";

export function registerFieldTools(server: McpServer): void {
  server.tool("create_field", "Create a custom field on a GitHub Project V2", createFieldSchema.shape, async (params) => {
    const input = createFieldSchema.parse(params);
    log("INFO", "create_field", `Creating field "${input.name}" (${input.dataType}) on project`);

    const variables: Record<string, unknown> = {
      projectId: input.projectId,
      dataType: input.dataType,
      name: input.name,
    };

    if (input.dataType === "SINGLE_SELECT" && input.options) {
      variables.singleSelectOptions = input.options.map((o) => ({
        name: o.name,
        color: o.color || "GRAY",
      }));
    }

    const result = await executeGraphQL<{ createProjectV2Field: { projectV2Field: { id: string; name: string; dataType: string } } }>(
      CREATE_FIELD,
      variables,
    );

    await cache.invalidate(`fields-${input.projectId}`);

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.createProjectV2Field.projectV2Field) }],
    };
  });

  server.tool("update_item_field", "Update a custom field value on a project item", updateItemFieldSchema.shape, async (params) => {
    const input = updateItemFieldSchema.parse(params);
    log("INFO", "update_item_field", `Updating field ${input.fieldId} on item ${input.itemId}`);

    await executeGraphQL(UPDATE_ITEM_FIELD_VALUE, {
      projectId: input.projectId,
      itemId: input.itemId,
      fieldId: input.fieldId,
      value: input.value,
    });

    await cache.invalidate(`items-${input.projectId}`);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, fieldId: input.fieldId }) }],
    };
  });

  server.tool("get_project_fields", "List all fields on a GitHub Project V2", getProjectFieldsSchema.shape, async (params) => {
    const input = getProjectFieldsSchema.parse(params);
    log("INFO", "get_project_fields", `Getting fields for project ${input.projectId}`);

    const cacheKey = `fields-${input.projectId}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) {
      return { content: [{ type: "text" as const, text: JSON.stringify(cached) }] };
    }

    const result = await executeGraphQL<{ node: { fields: { nodes: unknown[] } } }>(
      GET_PROJECT_FIELDS,
      { projectId: input.projectId },
    );

    const fields = result.node.fields.nodes;
    await cache.set(cacheKey, fields);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ fields }) }],
    };
  });

  server.tool("delete_field", "Delete a custom field from a project", deleteFieldSchema.shape, async (params) => {
    const input = deleteFieldSchema.parse(params);
    log("INFO", "delete_field", `Deleting field ${input.fieldId}`);

    await executeGraphQL(DELETE_FIELD, { fieldId: input.fieldId });

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true }) }],
    };
  });
}
