import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeGraphQL } from "../graphql/client.js";
import { UPDATE_PROJECT_WORKFLOW } from "../graphql/mutations.js";
import { GET_PROJECT_WORKFLOWS } from "../graphql/queries.js";
import { createAutoAddWorkflowSchema, createStatusWorkflowSchema, listWorkflowsSchema, toggleWorkflowSchema } from "../validation/schemas.js";
import { log } from "../utils/logger.js";

export function registerWorkflowTools(server: McpServer): void {
  server.tool("create_auto_add_workflow", "Configure auto-add workflow for new issues", createAutoAddWorkflowSchema.shape, async (params) => {
    const input = createAutoAddWorkflowSchema.parse(params);
    log("INFO", "create_auto_add_workflow", `Creating auto-add workflow for project ${input.projectId}`);

    // GitHub Projects V2 workflows are managed through the UI primarily.
    // The API provides read/toggle but limited creation.
    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        message: "Auto-add workflows are configured through GitHub Project settings. Enable the 'Auto-add to project' workflow in your project settings.",
        projectId: input.projectId,
        repositoryId: input.repositoryId,
        labelFilter: input.labelFilter || "all issues",
        instructions: "Go to Project Settings → Workflows → Auto-add to project → Enable and configure filters.",
      }) }],
    };
  });

  server.tool("create_status_workflow", "Configure automatic status change workflow", createStatusWorkflowSchema.shape, async (params) => {
    const input = createStatusWorkflowSchema.parse(params);
    log("INFO", "create_status_workflow", `Creating status workflow: ${input.trigger} → ${input.targetStatus}`);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({
        message: "Status workflows are configured through GitHub Project settings.",
        trigger: input.trigger,
        targetStatus: input.targetStatus,
        instructions: `Go to Project Settings → Workflows → Enable the "${input.trigger}" workflow and set target status to "${input.targetStatus}".`,
      }) }],
    };
  });

  server.tool("list_workflows", "List all workflows on a GitHub Project V2", listWorkflowsSchema.shape, async (params) => {
    const input = listWorkflowsSchema.parse(params);
    log("INFO", "list_workflows", `Listing workflows for project ${input.projectId}`);

    const result = await executeGraphQL<{ node: { workflows: { nodes: Array<{ id: string; name: string; enabled: boolean; number: number }> } } }>(
      GET_PROJECT_WORKFLOWS,
      { projectId: input.projectId },
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ workflows: result.node.workflows.nodes }) }],
    };
  });

  server.tool("toggle_workflow", "Enable or disable a project workflow", toggleWorkflowSchema.shape, async (params) => {
    const input = toggleWorkflowSchema.parse(params);
    log("INFO", "toggle_workflow", `${input.enabled ? "Enabling" : "Disabling"} workflow ${input.workflowId}`);

    const result = await executeGraphQL<{ updateProjectV2Workflow: { workflow: { id: string; enabled: boolean } } }>(
      UPDATE_PROJECT_WORKFLOW,
      { workflowId: input.workflowId, enabled: input.enabled },
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.updateProjectV2Workflow.workflow) }],
    };
  });
}
