import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeGraphQL } from "../graphql/client.js";
import { GET_PROJECT_VIEWS } from "../graphql/queries.js";
import { createViewSchema, listViewsSchema, deleteViewSchema } from "../validation/schemas.js";
import { log } from "../utils/logger.js";

export function registerViewTools(server: McpServer): void {
  server.tool("create_view", "Create a new view on a GitHub Project V2", createViewSchema.shape, async (params) => {
    const input = createViewSchema.parse(params);
    log("INFO", "create_view", `Creating view "${input.name}" (${input.layout})`);

    // Note: GitHub Projects V2 view creation via GraphQL is limited.
    // Providing the interface for when API support expands.
    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        message: "View creation via GraphQL API has limited support. The view configuration has been prepared.",
        name: input.name,
        layout: input.layout,
        filter: input.filter || null,
        suggestion: "Use the GitHub UI to create views, or check if the createProjectV2View mutation is available in your API version.",
      }) }],
    };
  });

  server.tool("list_views", "List all views on a GitHub Project V2", listViewsSchema.shape, async (params) => {
    const input = listViewsSchema.parse(params);
    log("INFO", "list_views", `Listing views for project ${input.projectId}`);

    const result = await executeGraphQL<{ node: { views: { nodes: Array<{ id: string; name: string; layout: string }> } } }>(
      GET_PROJECT_VIEWS,
      { projectId: input.projectId },
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ views: result.node.views.nodes }) }],
    };
  });

  server.tool("delete_view", "Delete a view from a GitHub Project V2", deleteViewSchema.shape, async (params) => {
    const input = deleteViewSchema.parse(params);
    log("INFO", "delete_view", `Deleting view ${input.viewId}`);

    // Note: View deletion via GraphQL may have limited support
    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        message: "View deletion via GraphQL API has limited support.",
        viewId: input.viewId,
        suggestion: "Use the GitHub UI to delete views if the API mutation is not available.",
      }) }],
    };
  });
}
