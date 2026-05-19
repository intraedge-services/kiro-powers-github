import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const GRAPHQL_URL = "https://api.github.com/graphql";

// --- GraphQL Client ---

async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const token = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not set");

  const res = await fetch(GRAPHQL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "kiro-projects-v2-mcp/1.0",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  });

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) throw new Error(json.errors.map((e) => e.message).join("; "));
  if (!json.data) throw new Error("No data returned from GitHub GraphQL API");
  return json.data;
}

// --- Server Setup ---

const server = new McpServer({ name: "github-projects-v2", version: "1.0.0" });

// --- Tools ---

server.tool(
  "list_projects",
  "List GitHub Projects V2 for a user or organization",
  { owner: z.string().describe("User or organization login"), type: z.enum(["user", "org"]).default("org").describe("Owner type") },
  async ({ owner, type }) => {
    const field = type === "org" ? "organization" : "user";
    const data = await gql<any>(
      `query($login: String!) { ${field}(login: $login) { projectsV2(first: 20) { nodes { id number title shortDescription closed url } } } }`,
      { login: owner }
    );
    const projects = data[field].projectsV2.nodes;
    return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] };
  }
);

server.tool(
  "get_project",
  "Get details of a specific GitHub Project V2",
  { owner: z.string().describe("User or organization login"), number: z.number().describe("Project number"), type: z.enum(["user", "org"]).default("org").describe("Owner type") },
  async ({ owner, number, type }) => {
    const field = type === "org" ? "organization" : "user";
    const data = await gql<any>(
      `query($login: String!, $number: Int!) { ${field}(login: $login) { projectV2(number: $number) { id number title shortDescription closed url fields(first: 30) { nodes { ... on ProjectV2SingleSelectField { id name options { id name } } ... on ProjectV2Field { id name } } } } } }`,
      { login: owner, number }
    );
    return { content: [{ type: "text", text: JSON.stringify(data[field].projectV2, null, 2) }] };
  }
);

server.tool(
  "list_project_items",
  "List items in a GitHub Project V2",
  { projectId: z.string().describe("Project node ID"), first: z.number().default(20).describe("Number of items"), after: z.string().optional().describe("Pagination cursor") },
  async ({ projectId, first, after }) => {
    const data = await gql<any>(
      `query($id: ID!, $first: Int!, $after: String) { node(id: $id) { ... on ProjectV2 { items(first: $first, after: $after) { pageInfo { hasNextPage endCursor } nodes { id content { ... on Issue { number title state url } ... on PullRequest { number title state url } ... on DraftIssue { title } } fieldValues(first: 10) { nodes { ... on ProjectV2ItemFieldSingleSelectValue { name optionId } ... on ProjectV2ItemFieldTextValue { text } } } } } } } }`,
      { id: projectId, first, after }
    );
    return { content: [{ type: "text", text: JSON.stringify(data.node.items, null, 2) }] };
  }
);

server.tool(
  "add_item_to_project",
  "Add an issue or PR to a GitHub Project V2",
  { projectId: z.string().describe("Project node ID"), contentId: z.string().describe("Issue or PR node ID") },
  async ({ projectId, contentId }) => {
    const data = await gql<any>(
      `mutation($projectId: ID!, $contentId: ID!) { addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } } }`,
      { projectId, contentId }
    );
    return { content: [{ type: "text", text: JSON.stringify({ itemId: data.addProjectV2ItemById.item.id }) }] };
  }
);

server.tool(
  "update_item_field",
  "Update a field value on a project item (e.g., change status column)",
  {
    projectId: z.string().describe("Project node ID"),
    itemId: z.string().describe("Project item node ID"),
    fieldId: z.string().describe("Field node ID"),
    value: z.union([
      z.object({ singleSelectOptionId: z.string() }),
      z.object({ text: z.string() }),
      z.object({ number: z.number() }),
      z.object({ date: z.string() }),
    ]).describe("Field value object"),
  },
  async ({ projectId, itemId, fieldId, value }) => {
    const data = await gql<any>(
      `mutation($input: UpdateProjectV2ItemFieldValueInput!) { updateProjectV2ItemFieldValue(input: $input) { projectV2Item { id } } }`,
      { input: { projectId, itemId, fieldId, value } }
    );
    return { content: [{ type: "text", text: JSON.stringify({ updated: true, itemId: data.updateProjectV2ItemFieldValue.projectV2Item.id }) }] };
  }
);

server.tool(
  "remove_item_from_project",
  "Remove an item from a GitHub Project V2",
  { projectId: z.string().describe("Project node ID"), itemId: z.string().describe("Project item node ID") },
  async ({ projectId, itemId }) => {
    const data = await gql<any>(
      `mutation($projectId: ID!, $itemId: ID!) { deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) { deletedItemId } }`,
      { projectId, itemId }
    );
    return { content: [{ type: "text", text: JSON.stringify({ removed: true, deletedItemId: data.deleteProjectV2Item.deletedItemId }) }] };
  }
);

server.tool(
  "get_project_status_options",
  "Get the status field options (column names) for a project",
  { owner: z.string().describe("User or organization login"), number: z.number().describe("Project number"), type: z.enum(["user", "org"]).default("org").describe("Owner type") },
  async ({ owner, number, type }) => {
    const field = type === "org" ? "organization" : "user";
    const data = await gql<any>(
      `query($login: String!, $number: Int!) { ${field}(login: $login) { projectV2(number: $number) { field(name: "Status") { ... on ProjectV2SingleSelectField { id name options { id name description color } } } } } }`,
      { login: owner, number }
    );
    return { content: [{ type: "text", text: JSON.stringify(data[field].projectV2.field, null, 2) }] };
  }
);

// --- Start ---

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("[projects-v2] Server started\n");
}

main().catch((e) => {
  process.stderr.write(`[projects-v2] Fatal: ${e.message}\n`);
  process.exit(1);
});
