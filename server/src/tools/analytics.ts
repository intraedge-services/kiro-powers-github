import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeGraphQL } from "../graphql/client.js";
import { GET_PROJECT_ITEMS } from "../graphql/queries.js";
import { getProjectStatsSchema, getIterationBurndownSchema, getStaleItemsSchema } from "../validation/schemas.js";
import { log } from "../utils/logger.js";

interface ProjectItem {
  id: string;
  content: { title: string; number?: number; state?: string; assignees?: { nodes: Array<{ login: string }> } } | null;
  fieldValues: { nodes: Array<{ name?: string; field?: { name: string } }> };
}

export function registerAnalyticsTools(server: McpServer): void {
  server.tool("get_project_stats", "Get statistics for a GitHub Project V2", getProjectStatsSchema.shape, async (params) => {
    const input = getProjectStatsSchema.parse(params);
    log("INFO", "get_project_stats", `Getting stats for project ${input.projectId}`);

    const result = await executeGraphQL<{ node: { items: { nodes: ProjectItem[] } } }>(
      GET_PROJECT_ITEMS,
      { projectId: input.projectId, first: 100 },
    );

    const items = result.node.items.nodes;
    const byStatus: Record<string, number> = {};
    const byAssignee: Record<string, number> = {};

    for (const item of items) {
      // Count by status
      const statusField = item.fieldValues?.nodes?.find((fv) => fv.field?.name === "Status");
      const status = statusField?.name || "No Status";
      byStatus[status] = (byStatus[status] || 0) + 1;

      // Count by assignee
      const assignees = item.content?.assignees?.nodes || [];
      if (assignees.length === 0) {
        byAssignee["Unassigned"] = (byAssignee["Unassigned"] || 0) + 1;
      } else {
        for (const assignee of assignees) {
          byAssignee[assignee.login] = (byAssignee[assignee.login] || 0) + 1;
        }
      }
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ totalItems: items.length, byStatus, byAssignee }) }],
    };
  });

  server.tool("get_iteration_burndown", "Get burndown data for an iteration", getIterationBurndownSchema.shape, async (params) => {
    const input = getIterationBurndownSchema.parse(params);
    log("INFO", "get_iteration_burndown", `Getting burndown for iteration ${input.iterationId}`);

    const result = await executeGraphQL<{ node: { items: { nodes: ProjectItem[] } } }>(
      GET_PROJECT_ITEMS,
      { projectId: input.projectId, first: 100 },
    );

    const items = result.node.items.nodes;

    // Filter items in this iteration
    const iterationItems = items.filter((item) =>
      item.fieldValues?.nodes?.some((fv) => fv.name === input.iterationId || fv.field?.name === "Iteration")
    );

    const total = iterationItems.length;
    const completed = iterationItems.filter((item) => {
      const statusField = item.fieldValues?.nodes?.find((fv) => fv.field?.name === "Status");
      return statusField?.name === "Done";
    }).length;

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        total,
        completed,
        remaining: total - completed,
        velocity: total > 0 ? Math.round((completed / total) * 100) : 0,
      }) }],
    };
  });

  server.tool("get_stale_items", "Find items that haven't been updated recently", getStaleItemsSchema.shape, async (params) => {
    const input = getStaleItemsSchema.parse(params);
    log("INFO", "get_stale_items", `Finding stale items (>${input.staleDays} days) in project ${input.projectId}`);

    const result = await executeGraphQL<{ node: { items: { nodes: Array<{ id: string; content: { title: string; updatedAt?: string } | null }> } } }>(
      GET_PROJECT_ITEMS,
      { projectId: input.projectId, first: 100 },
    );

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - input.staleDays);

    const staleItems = result.node.items.nodes.filter((item) => {
      const updatedAt = item.content?.updatedAt;
      if (!updatedAt) return true; // No update date = stale
      return new Date(updatedAt) < cutoffDate;
    });

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        items: staleItems.map((i) => ({ id: i.id, title: i.content?.title || "Draft", lastUpdated: i.content?.updatedAt || "unknown" })),
      }) }],
    };
  });
}
