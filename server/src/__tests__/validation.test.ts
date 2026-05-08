import { describe, it, expect } from "vitest";
import {
  createProjectSchema,
  listProjectsSchema,
  addItemSchema,
  updateItemStatusSchema,
  createFieldSchema,
  createIterationSchema,
  bulkAddItemsSchema,
  getStaleItemsSchema,
} from "../validation/schemas.js";

describe("Validation Schemas", () => {
  describe("createProjectSchema", () => {
    it("accepts valid input", () => {
      const result = createProjectSchema.safeParse({
        owner: "my-org",
        title: "Sprint Board",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty owner", () => {
      const result = createProjectSchema.safeParse({
        owner: "",
        title: "Sprint Board",
      });
      expect(result.success).toBe(false);
    });

    it("rejects owner exceeding 39 chars", () => {
      const result = createProjectSchema.safeParse({
        owner: "a".repeat(40),
        title: "Sprint Board",
      });
      expect(result.success).toBe(false);
    });

    it("rejects title exceeding 256 chars", () => {
      const result = createProjectSchema.safeParse({
        owner: "my-org",
        title: "x".repeat(257),
      });
      expect(result.success).toBe(false);
    });

    it("accepts optional description", () => {
      const result = createProjectSchema.safeParse({
        owner: "my-org",
        title: "Sprint Board",
        description: "A project for tracking sprints",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("listProjectsSchema", () => {
    it("applies defaults", () => {
      const result = listProjectsSchema.parse({ owner: "user1" });
      expect(result.type).toBe("user");
      expect(result.first).toBe(20);
    });

    it("rejects invalid type", () => {
      const result = listProjectsSchema.safeParse({
        owner: "user1",
        type: "invalid",
      });
      expect(result.success).toBe(false);
    });

    it("rejects first > 100", () => {
      const result = listProjectsSchema.safeParse({
        owner: "user1",
        first: 101,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("addItemSchema", () => {
    it("accepts valid input with defaults", () => {
      const result = addItemSchema.parse({
        projectId: "PVT_123",
        contentId: "I_456",
      });
      expect(result.contentType).toBe("Issue");
    });

    it("accepts PR content type", () => {
      const result = addItemSchema.parse({
        projectId: "PVT_123",
        contentId: "PR_789",
        contentType: "PR",
      });
      expect(result.contentType).toBe("PR");
    });
  });

  describe("updateItemStatusSchema", () => {
    it("accepts valid status", () => {
      const result = updateItemStatusSchema.safeParse({
        projectId: "PVT_123",
        itemId: "PVTI_456",
        status: "In Progress",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty status", () => {
      const result = updateItemStatusSchema.safeParse({
        projectId: "PVT_123",
        itemId: "PVTI_456",
        status: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects status exceeding 50 chars", () => {
      const result = updateItemStatusSchema.safeParse({
        projectId: "PVT_123",
        itemId: "PVTI_456",
        status: "x".repeat(51),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createFieldSchema", () => {
    it("accepts single select with options", () => {
      const result = createFieldSchema.safeParse({
        projectId: "PVT_123",
        name: "Priority",
        dataType: "SINGLE_SELECT",
        options: [
          { name: "Low" },
          { name: "Medium" },
          { name: "High", color: "RED" },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("accepts text field without options", () => {
      const result = createFieldSchema.safeParse({
        projectId: "PVT_123",
        name: "Notes",
        dataType: "TEXT",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid data type", () => {
      const result = createFieldSchema.safeParse({
        projectId: "PVT_123",
        name: "Field",
        dataType: "INVALID",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("createIterationSchema", () => {
    it("accepts valid date format", () => {
      const result = createIterationSchema.safeParse({
        projectId: "PVT_123",
        fieldId: "PVTF_456",
        title: "Sprint 1",
        startDate: "2026-05-12",
        duration: 14,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid date format", () => {
      const result = createIterationSchema.safeParse({
        projectId: "PVT_123",
        fieldId: "PVTF_456",
        title: "Sprint 1",
        startDate: "May 12, 2026",
        duration: 14,
      });
      expect(result.success).toBe(false);
    });

    it("rejects duration > 42 days", () => {
      const result = createIterationSchema.safeParse({
        projectId: "PVT_123",
        fieldId: "PVTF_456",
        title: "Sprint 1",
        startDate: "2026-05-12",
        duration: 43,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("bulkAddItemsSchema", () => {
    it("accepts array of content IDs", () => {
      const result = bulkAddItemsSchema.safeParse({
        projectId: "PVT_123",
        contentIds: ["I_1", "I_2", "I_3"],
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty array", () => {
      const result = bulkAddItemsSchema.safeParse({
        projectId: "PVT_123",
        contentIds: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects array exceeding 50 items", () => {
      const result = bulkAddItemsSchema.safeParse({
        projectId: "PVT_123",
        contentIds: Array.from({ length: 51 }, (_, i) => `I_${i}`),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getStaleItemsSchema", () => {
    it("applies default staleDays", () => {
      const result = getStaleItemsSchema.parse({ projectId: "PVT_123" });
      expect(result.staleDays).toBe(7);
    });

    it("rejects staleDays > 365", () => {
      const result = getStaleItemsSchema.safeParse({
        projectId: "PVT_123",
        staleDays: 366,
      });
      expect(result.success).toBe(false);
    });
  });
});
