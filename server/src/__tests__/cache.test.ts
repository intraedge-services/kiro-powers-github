import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readdir } from "node:fs/promises";
import { join } from "node:path";
import { CacheManager } from "../cache/manager.js";

const TEST_CACHE_DIR = ".test-cache";

describe("CacheManager", () => {
  let cacheManager: CacheManager;

  beforeEach(async () => {
    process.env.GITHUB_PROJECTS_CACHE_DIR = TEST_CACHE_DIR;
    process.env.GITHUB_PROJECTS_CACHE_TTL = "2"; // 2 seconds for testing
    cacheManager = new CacheManager();
    await mkdir(TEST_CACHE_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_CACHE_DIR, { recursive: true, force: true });
    delete process.env.GITHUB_PROJECTS_CACHE_DIR;
    delete process.env.GITHUB_PROJECTS_CACHE_TTL;
  });

  describe("get/set", () => {
    it("returns null for missing key", async () => {
      const result = await cacheManager.get("nonexistent");
      expect(result).toBeNull();
    });

    it("stores and retrieves data", async () => {
      const data = { items: [{ id: "1", title: "Test" }] };
      await cacheManager.set("test-key", data);
      const result = await cacheManager.get("test-key");
      expect(result).toEqual(data);
    });

    it("returns null for expired entries", async () => {
      const data = { value: "old" };
      await cacheManager.set("expire-test", data);

      // Wait for TTL to expire (2 seconds + buffer)
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const result = await cacheManager.get("expire-test");
      expect(result).toBeNull();
    });
  });

  describe("invalidate", () => {
    it("removes a specific cache entry", async () => {
      await cacheManager.set("to-remove", { data: true });
      await cacheManager.invalidate("to-remove");
      const result = await cacheManager.get("to-remove");
      expect(result).toBeNull();
    });

    it("does not throw for non-existent key", async () => {
      await expect(cacheManager.invalidate("nonexistent")).resolves.not.toThrow();
    });
  });

  describe("invalidateProject", () => {
    it("removes all project-related cache entries", async () => {
      await cacheManager.set("project-PVT_123", { project: true });
      await cacheManager.set("items-PVT_123", { items: [] });
      await cacheManager.set("fields-PVT_123", { fields: [] });

      await cacheManager.invalidateProject("PVT_123");

      expect(await cacheManager.get("project-PVT_123")).toBeNull();
      expect(await cacheManager.get("items-PVT_123")).toBeNull();
      expect(await cacheManager.get("fields-PVT_123")).toBeNull();
    });
  });

  describe("clear", () => {
    it("removes all cache files", async () => {
      await cacheManager.set("key1", { a: 1 });
      await cacheManager.set("key2", { b: 2 });

      await cacheManager.clear();

      const files = await readdir(TEST_CACHE_DIR);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));
      expect(jsonFiles).toHaveLength(0);
    });
  });

  describe("getStatus", () => {
    it("returns empty status for fresh cache", async () => {
      await cacheManager.clear();
      const status = await cacheManager.getStatus();
      expect(status.itemCount).toBe(0);
      expect(status.cacheDir).toBe(TEST_CACHE_DIR);
    });

    it("returns correct item count", async () => {
      await cacheManager.set("key1", { a: 1 });
      await cacheManager.set("key2", { b: 2 });

      const status = await cacheManager.getStatus();
      expect(status.itemCount).toBe(2);
    });
  });

  describe("corruption recovery", () => {
    it("returns null for corrupted cache file", async () => {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(TEST_CACHE_DIR, "corrupted.json"), "not valid json{{{", "utf-8");

      const result = await cacheManager.get("corrupted");
      expect(result).toBeNull();
    });
  });

  describe("directory creation", () => {
    it("creates cache directory if it does not exist", async () => {
      await rm(TEST_CACHE_DIR, { recursive: true, force: true });
      await cacheManager.set("auto-create", { test: true });
      const result = await cacheManager.get("auto-create");
      expect(result).toEqual({ test: true });
    });
  });
});
