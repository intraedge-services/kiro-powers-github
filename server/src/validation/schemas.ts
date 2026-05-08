import { z } from "zod";

/**
 * Zod validation schemas for all MCP tool inputs.
 * Enforces type checking, length bounds, and format validation (SECURITY-05).
 */

// Common field constraints
const ownerSchema = z.string().min(1).max(39).describe("Repository or project owner");
const titleSchema = z.string().min(1).max(256).describe("Title");
const bodySchema = z.string().max(65536).optional().describe("Body/description");
const projectIdSchema = z.string().min(1).describe("Project node ID");
const itemIdSchema = z.string().min(1).describe("Item node ID");
const fieldIdSchema = z.string().min(1).describe("Field node ID");
const firstSchema = z.number().int().min(1).max(100).default(20).describe("Number of items to fetch");

// Project Management Schemas
export const createProjectSchema = z.object({
  owner: ownerSchema,
  title: titleSchema,
  description: bodySchema,
  template: z.string().max(100).optional().describe("Template name"),
});

export const listProjectsSchema = z.object({
  owner: ownerSchema,
  type: z.enum(["user", "org"]).default("user").describe("Owner type"),
  first: firstSchema,
});

export const getProjectSchema = z.object({
  owner: ownerSchema,
  projectNumber: z.number().int().min(1).describe("Project number"),
});

export const deleteProjectSchema = z.object({
  projectId: projectIdSchema,
});

export const updateProjectSchema = z.object({
  projectId: projectIdSchema,
  title: titleSchema.optional(),
  description: bodySchema,
  public: z.boolean().optional().describe("Whether project is public"),
});

// Item Management Schemas
export const addItemSchema = z.object({
  projectId: projectIdSchema,
  contentId: z.string().min(1).describe("Issue or PR node ID"),
  contentType: z.enum(["Issue", "PR", "DraftIssue"]).default("Issue"),
});

export const removeItemSchema = z.object({
  projectId: projectIdSchema,
  itemId: itemIdSchema,
});

export const getProjectItemsSchema = z.object({
  projectId: projectIdSchema,
  status: z.string().max(50).optional().describe("Filter by status"),
  assignee: z.string().max(39).optional().describe("Filter by assignee"),
  first: firstSchema,
  after: z.string().optional().describe("Pagination cursor"),
});

export const archiveItemSchema = z.object({
  projectId: projectIdSchema,
  itemId: itemIdSchema,
});

export const unarchiveItemSchema = z.object({
  projectId: projectIdSchema,
  itemId: itemIdSchema,
});

export const bulkAddItemsSchema = z.object({
  projectId: projectIdSchema,
  contentIds: z.array(z.string().min(1)).min(1).max(50).describe("Array of issue/PR node IDs"),
});

export const bulkArchiveItemsSchema = z.object({
  projectId: projectIdSchema,
  status: z.string().max(50).optional().describe("Archive items with this status"),
  olderThan: z.string().optional().describe("Archive items older than this ISO date"),
});

// Status Transition Schemas
export const updateItemStatusSchema = z.object({
  projectId: projectIdSchema,
  itemId: itemIdSchema,
  status: z.string().min(1).max(50).describe("Target status name"),
});

export const bulkUpdateStatusSchema = z.object({
  projectId: projectIdSchema,
  itemIds: z.array(z.string().min(1)).min(1).max(50).describe("Array of item IDs"),
  status: z.string().min(1).max(50).describe("Target status name"),
});

export const getStatusOptionsSchema = z.object({
  projectId: projectIdSchema,
});

// Custom Field Schemas
export const createFieldSchema = z.object({
  projectId: projectIdSchema,
  name: z.string().min(1).max(100).describe("Field name"),
  dataType: z.enum(["TEXT", "NUMBER", "DATE", "SINGLE_SELECT", "ITERATION"]).describe("Field data type"),
  options: z.array(z.object({
    name: z.string().min(1).max(50),
    description: z.string().max(256).optional().default(""),
    color: z.string().max(20).optional(),
  })).optional().describe("Options for single-select fields"),
});

export const updateItemFieldSchema = z.object({
  projectId: projectIdSchema,
  itemId: itemIdSchema,
  fieldId: fieldIdSchema,
  value: z.union([z.string(), z.number(), z.object({ singleSelectOptionId: z.string() }), z.object({ iterationId: z.string() }), z.object({ date: z.string() })]).describe("Field value"),
});

export const getProjectFieldsSchema = z.object({
  projectId: projectIdSchema,
});

export const deleteFieldSchema = z.object({
  fieldId: fieldIdSchema,
});

// Iteration Schemas
export const createIterationSchema = z.object({
  projectId: projectIdSchema,
  fieldId: fieldIdSchema,
  title: titleSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Start date (YYYY-MM-DD)"),
  duration: z.number().int().min(1).max(42).describe("Duration in days"),
});

export const assignItemToIterationSchema = z.object({
  projectId: projectIdSchema,
  itemId: itemIdSchema,
  iterationId: z.string().min(1).describe("Iteration ID"),
});

export const getIterationItemsSchema = z.object({
  projectId: projectIdSchema,
  iterationId: z.string().min(1).describe("Iteration ID"),
});

export const listIterationsSchema = z.object({
  projectId: projectIdSchema,
  fieldId: fieldIdSchema,
});

// View Management Schemas
export const createViewSchema = z.object({
  projectId: projectIdSchema,
  name: z.string().min(1).max(100).describe("View name"),
  layout: z.enum(["BOARD_LAYOUT", "TABLE_LAYOUT", "ROADMAP_LAYOUT"]).describe("View layout type"),
  filter: z.string().max(500).optional().describe("Filter expression"),
});

export const listViewsSchema = z.object({
  projectId: projectIdSchema,
});

export const deleteViewSchema = z.object({
  projectId: projectIdSchema,
  viewId: z.string().min(1).describe("View ID"),
});

// Workflow Automation Schemas
export const createAutoAddWorkflowSchema = z.object({
  projectId: projectIdSchema,
  repositoryId: z.string().min(1).describe("Repository node ID"),
  labelFilter: z.string().max(100).optional().describe("Only auto-add issues with this label"),
});

export const createStatusWorkflowSchema = z.object({
  projectId: projectIdSchema,
  trigger: z.enum(["ISSUE_OPENED", "PR_OPENED", "PR_MERGED", "ISSUE_CLOSED"]).describe("Trigger event"),
  targetStatus: z.string().min(1).max(50).describe("Status to set when triggered"),
});

export const listWorkflowsSchema = z.object({
  projectId: projectIdSchema,
});

export const toggleWorkflowSchema = z.object({
  projectId: projectIdSchema,
  workflowId: z.string().min(1).describe("Workflow ID"),
  enabled: z.boolean().describe("Enable or disable"),
});

// Analytics Schemas
export const getProjectStatsSchema = z.object({
  projectId: projectIdSchema,
});

export const getIterationBurndownSchema = z.object({
  projectId: projectIdSchema,
  iterationId: z.string().min(1).describe("Iteration ID"),
});

export const getStaleItemsSchema = z.object({
  projectId: projectIdSchema,
  staleDays: z.number().int().min(1).max(365).default(7).describe("Days since last update"),
});

// Cache Management Schemas
export const refreshCacheSchema = z.object({
  projectId: projectIdSchema.optional(),
});

export const getCacheStatusSchema = z.object({});

export const clearCacheSchema = z.object({});

// Pull Request Schemas
export const createPullRequestSchema = z.object({
  owner: ownerSchema,
  repo: z.string().min(1).max(100).describe("Repository name"),
  title: titleSchema,
  body: bodySchema,
  head: z.string().min(1).max(256).describe("Branch containing changes"),
  base: z.string().min(1).max(256).describe("Branch to merge into"),
  draft: z.boolean().optional().describe("Create as draft PR"),
});

export const listPullRequestsSchema = z.object({
  owner: ownerSchema,
  repo: z.string().min(1).max(100).describe("Repository name"),
  state: z.enum(["open", "closed", "all"]).default("open").describe("PR state filter"),
  perPage: z.number().int().min(1).max(100).default(20).describe("Results per page"),
});

export const getPullRequestSchema = z.object({
  owner: ownerSchema,
  repo: z.string().min(1).max(100).describe("Repository name"),
  pullNumber: z.number().int().min(1).describe("Pull request number"),
});

export const mergePullRequestSchema = z.object({
  owner: ownerSchema,
  repo: z.string().min(1).max(100).describe("Repository name"),
  pullNumber: z.number().int().min(1).describe("Pull request number"),
  mergeMethod: z.enum(["merge", "squash", "rebase"]).default("merge").describe("Merge method"),
  commitTitle: z.string().max(256).optional().describe("Custom merge commit title"),
  commitMessage: z.string().max(65536).optional().describe("Custom merge commit message"),
});

// Issue Schemas
export const createIssueSchema = z.object({
  owner: ownerSchema,
  repo: z.string().min(1).max(100).describe("Repository name"),
  title: titleSchema,
  body: bodySchema,
  labels: z.array(z.string().max(50)).max(20).optional().describe("Labels to apply"),
  assignees: z.array(z.string().max(39)).max(10).optional().describe("Users to assign"),
});

export const listIssuesSchema = z.object({
  owner: ownerSchema,
  repo: z.string().min(1).max(100).describe("Repository name"),
  state: z.enum(["open", "closed", "all"]).default("open").describe("Issue state filter"),
  labels: z.string().max(200).optional().describe("Comma-separated label filter"),
  perPage: z.number().int().min(1).max(100).default(20).describe("Results per page"),
});

// Branch Schemas
export const createBranchSchema = z.object({
  owner: ownerSchema,
  repo: z.string().min(1).max(100).describe("Repository name"),
  branch: z.string().min(1).max(256).describe("New branch name"),
  from: z.string().min(1).max(256).default("main").describe("Source branch to create from"),
});

export const listBranchesSchema = z.object({
  owner: ownerSchema,
  repo: z.string().min(1).max(100).describe("Repository name"),
  perPage: z.number().int().min(1).max(100).default(30).describe("Results per page"),
});

// Repository Schema
export const getRepositorySchema = z.object({
  owner: ownerSchema,
  repo: z.string().min(1).max(100).describe("Repository name"),
});
