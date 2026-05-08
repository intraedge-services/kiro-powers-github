import { readFile, writeFile, mkdir, unlink, stat } from "node:fs/promises";
import { join } from "node:path";
import { log } from "../utils/logger.js";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const DEFAULT_CACHE_DIR = ".kiro/github-cache";

/**
 * File-based cache manager with TTL and write-through invalidation.
 */
export class CacheManager {
  private readonly cacheDir: string;
  private readonly ttlMs: number;

  constructor() {
    this.cacheDir = process.env.GITHUB_PROJECTS_CACHE_DIR || DEFAULT_CACHE_DIR;
    const ttlSeconds = parseInt(process.env.GITHUB_PROJECTS_CACHE_TTL || "300", 10);
    this.ttlMs = ttlSeconds * 1000;
  }

  /**
   * Get cached data if available and not expired.
   */
  async get<T>(key: string): Promise<T | null> {
    const filePath = this.getFilePath(key);
    try {
      const content = await readFile(filePath, "utf-8");
      const entry: CacheEntry<T> = JSON.parse(content);

      const age = Date.now() - entry.timestamp;
      if (age > entry.ttl) {
        log("INFO", "cache", `Cache expired for key: ${key}`);
        return null;
      }

      log("INFO", "cache", `Cache hit for key: ${key}`);
      return entry.data;
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return null; // File doesn't exist — cache miss
      }
      // Corruption recovery: log and return null
      log("WARN", "cache", `Cache read error for key ${key}: ${(error as Error).message}. Falling back to fresh data.`);
      return null;
    }
  }

  /**
   * Store data in cache.
   */
  async set<T>(key: string, data: T): Promise<void> {
    const filePath = this.getFilePath(key);
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: this.ttlMs,
    };

    try {
      await mkdir(this.cacheDir, { recursive: true });
      await writeFile(filePath, JSON.stringify(entry, null, 2), "utf-8");
      log("INFO", "cache", `Cache set for key: ${key}`);
    } catch (error: unknown) {
      log("WARN", "cache", `Cache write error for key ${key}: ${(error as Error).message}`);
      // Non-fatal: continue without caching
    }
  }

  /**
   * Invalidate a specific cache entry (write-through invalidation).
   */
  async invalidate(key: string): Promise<void> {
    const filePath = this.getFilePath(key);
    try {
      await unlink(filePath);
      log("INFO", "cache", `Cache invalidated for key: ${key}`);
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        log("WARN", "cache", `Cache invalidation error for key ${key}: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Invalidate all cache entries for a project.
   */
  async invalidateProject(projectId: string): Promise<void> {
    await this.invalidate(`project-${projectId}`);
    await this.invalidate(`items-${projectId}`);
    await this.invalidate(`fields-${projectId}`);
  }

  /**
   * Clear all cached data.
   */
  async clear(): Promise<void> {
    const { readdir } = await import("node:fs/promises");
    try {
      const files = await readdir(this.cacheDir);
      for (const file of files) {
        if (file.endsWith(".json")) {
          await unlink(join(this.cacheDir, file));
        }
      }
      log("INFO", "cache", "Cache cleared");
    } catch (error: unknown) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        log("WARN", "cache", `Cache clear error: ${(error as Error).message}`);
      }
    }
  }

  /**
   * Get cache status information.
   */
  async getStatus(): Promise<{ cacheDir: string; lastRefresh: string | null; itemCount: number; stale: boolean }> {
    try {
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(this.cacheDir);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      let lastRefresh: string | null = null;
      let stale = false;

      if (jsonFiles.length > 0) {
        const stats = await stat(join(this.cacheDir, jsonFiles[0]));
        lastRefresh = stats.mtime.toISOString();
        stale = Date.now() - stats.mtime.getTime() > this.ttlMs;
      }

      return {
        cacheDir: this.cacheDir,
        lastRefresh,
        itemCount: jsonFiles.length,
        stale,
      };
    } catch {
      return {
        cacheDir: this.cacheDir,
        lastRefresh: null,
        itemCount: 0,
        stale: true,
      };
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key for filesystem
    const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, "_");
    return join(this.cacheDir, `${safeKey}.json`);
  }
}

// Singleton instance
export const cache = new CacheManager();
