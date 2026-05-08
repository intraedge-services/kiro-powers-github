import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { executeGraphQL, getRateLimitState } from "../graphql/client.js";
import { CREATE_PROJECT, UPDATE_PROJECT, DELETE_PROJECT } from "../graphql/mutations.js";
import { GET_USER_PROJECTS, GET_ORG_PROJECTS, GET_PROJECT } from "../graphql/queries.js";
import { createProjectSchema, listProjectsSchema, getProjectSchema, deleteProjectSchema, updateProjectSchema } from "../validation/schemas.js";
import { cache } from "../cache/manager.js";
import { log } from "../utils/logger.js";

export function registerProjectTools(server: McpServer): void {
  server.tool("create_project", "Create a new GitHub Project V2", createProjectSchema.shape, async (params) => {
    const input = createProjectSchema.parse(params);
    log("INFO", "create_project", `Creating project "${input.title}" for ${input.owner}`);

    // Get owner node ID first
    const ownerData = await executeGraphQL<{ user?: { id: string }; organization?: { id: string } }>(
      `query { user(login: "${input.owner}") { id } }`,
    );
    const ownerId = ownerData.user?.id;
    if (!ownerId) {
      return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Owner not found", owner: input.owner }) }] };
    }

    const result = await executeGraphQL<{ createProjectV2: { projectV2: { id: string; title: string; number: number; url: string } } }>(
      CREATE_PROJECT,
      { ownerId, title: input.title },
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.createProjectV2.projectV2) }],
    };
  });

  server.tool("list_projects", "List GitHub Projects V2 for a user or organization", listProjectsSchema.shape, async (params) => {
    const input = listProjectsSchema.parse(params);
    log("INFO", "list_projects", `Listing projects for ${input.owner} (${input.type})`);

    const cacheKey = `projects-${input.owner}-${input.type}`;
    const cached = await cache.get<unknown>(cacheKey);
    if (cached) {
      return { content: [{ type: "text" as const, text: JSON.stringify(cached) }] };
    }

    const query = input.type === "org" ? GET_ORG_PROJECTS : GET_USER_PROJECTS;
    const result = await executeGraphQL<{ user?: { projectsV2: { nodes: unknown[] } }; organization?: { projectsV2: { nodes: unknown[] } } }>(
      query,
      { login: input.owner, first: input.first },
    );

    const projects = input.type === "org"
      ? result.organization?.projectsV2.nodes
      : result.user?.projectsV2.nodes;

    await cache.set(cacheKey, projects);
    const rateLimit = getRateLimitState();

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ projects, rateLimit: { remaining: rateLimit.remaining, limit: rateLimit.limit } }) }],
    };
  });

  server.tool("get_project", "Get details of a specific GitHub Project V2", getProjectSchema.shape, async (params) => {
    const input = getProjectSchema.parse(params);
    log("INFO", "get_project", `Getting project #${input.projectNumber} for ${input.owner}`);

    const result = await executeGraphQL<{ user: { projectV2: unknown } }>(
      GET_PROJECT,
      { owner: input.owner, number: input.projectNumber },
    );

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.user.projectV2) }],
    };
  });

  server.tool("delete_project", "Delete a GitHub Project V2", deleteProjectSchema.shape, async (params) => {
    const input = deleteProjectSchema.parse(params);
    log("INFO", "delete_project", `Deleting project ${input.projectId}`);

    await executeGraphQL(DELETE_PROJECT, { projectId: input.projectId });
    await cache.invalidateProject(input.projectId);

    return {
      content: [{ type: "text" as const, text: JSON.stringify({ success: true, message: "Project deleted" }) }],
    };
  });

  server.tool("update_project", "Update a GitHub Project V2 settings", updateProjectSchema.shape, async (params) => {
    const input = updateProjectSchema.parse(params);
    log("INFO", "update_project", `Updating project ${input.projectId}`);

    const result = await executeGraphQL<{ updateProjectV2: { projectV2: { id: string; title: string; url: string } } }>(
      UPDATE_PROJECT,
      { projectId: input.projectId, title: input.title, shortDescription: input.description, public: input.public },
    );

    await cache.invalidateProject(input.projectId);

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result.updateProjectV2.projectV2) }],
    };
  });
}
