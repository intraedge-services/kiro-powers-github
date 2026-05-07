import * as fs from 'node:fs';
import { z } from 'zod';
import type { Logger } from './logger.js';
import type { MappingStrategy } from './mapping-strategies.js';

// ============================================================
// Types
// ============================================================

export interface SyncState {
  lastSync: string;
  mappingStrategy: MappingStrategy;
  items: SyncedItem[];
  milestones: SyncedMilestone[];
}

export interface SyncedItem {
  storyId: string;
  githubIssueNumber: number;
  githubIssueUrl: string;
  syncedAt: string;
  status: 'synced' | 'failed' | 'skipped';
  checksum: string;
}

export interface SyncedMilestone {
  epicNumber: number;
  githubMilestoneId: number;
  name: string;
}

// ============================================================
// Zod Schema
// ============================================================

export const SyncStateSchema = z.object({
  lastSync: z.string(),
  mappingStrategy: z.enum(['milestones', 'labels', 'custom-fields']),
  items: z.array(
    z.object({
      storyId: z.string(),
      githubIssueNumber: z.number(),
      githubIssueUrl: z.string(),
      syncedAt: z.string(),
      status: z.enum(['synced', 'failed', 'skipped']),
      checksum: z.string(),
    })
  ),
  milestones: z.array(
    z.object({
      epicNumber: z.number(),
      githubMilestoneId: z.number(),
      name: z.string(),
    })
  ),
});

// ============================================================
// Sync State Manager
// ============================================================

const SYNC_STATE_PATH = 'github-power/sync-state.json';

/**
 * Manages sync state persistence with atomic writes and Zod validation.
 */
export class SyncStateManager {
  private state: SyncState | null = null;
  private readonly logger: Logger;
  private readonly statePath: string;

  constructor(logger: Logger, statePath: string = SYNC_STATE_PATH) {
    this.logger = logger;
    this.statePath = statePath;
  }

  /**
   * Load sync state from file. Returns null if file doesn't exist or is invalid.
   */
  load(): SyncState | null {
    if (!fs.existsSync(this.statePath)) {
      this.logger.info('No sync state file found — first sync');
      return null;
    }

    try {
      const content = fs.readFileSync(this.statePath, 'utf-8');
      const raw = JSON.parse(content);
      const result = SyncStateSchema.safeParse(raw);

      if (result.success) {
        this.state = result.data;
        this.logger.info('Sync state loaded', {
          lastSync: this.state.lastSync,
          itemCount: this.state.items.length,
        });
        return this.state;
      }

      this.logger.warn('Sync state validation failed — treating as empty', {
        errors: result.error.issues.map((i) => i.message),
      });
      return null;
    } catch (error) {
      this.logger.warn('Failed to read sync state file — treating as empty', {
        error: String(error),
      });
      return null;
    }
  }

  /**
   * Save sync state atomically (write to temp, then rename).
   */
  save(state: SyncState): void {
    this.state = state;
    const tempPath = `${this.statePath}.tmp`;
    const content = JSON.stringify(state, null, 2);

    try {
      const dir = this.statePath.substring(0, this.statePath.lastIndexOf('/'));
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(tempPath, content, 'utf-8');
      fs.renameSync(tempPath, this.statePath);
    } catch (error) {
      this.logger.error('Failed to save sync state', { error: String(error) });
      throw error;
    }
  }

  /**
   * Get a synced item by story ID.
   */
  getItem(storyId: string): SyncedItem | undefined {
    return this.state?.items.find((item) => item.storyId === storyId);
  }

  /**
   * Update or add a synced item.
   */
  updateItem(storyId: string, item: SyncedItem): void {
    if (!this.state) {
      this.state = {
        lastSync: new Date().toISOString(),
        mappingStrategy: 'milestones',
        items: [],
        milestones: [],
      };
    }

    const index = this.state.items.findIndex((i) => i.storyId === storyId);
    if (index >= 0) {
      this.state.items[index] = item;
    } else {
      this.state.items.push(item);
    }
  }

  /**
   * Get a synced milestone by epic number.
   */
  getMilestone(epicNumber: number): SyncedMilestone | undefined {
    return this.state?.milestones.find((m) => m.epicNumber === epicNumber);
  }

  /**
   * Update or add a synced milestone.
   */
  updateMilestone(milestone: SyncedMilestone): void {
    if (!this.state) return;

    const index = this.state.milestones.findIndex(
      (m) => m.epicNumber === milestone.epicNumber
    );
    if (index >= 0) {
      this.state.milestones[index] = milestone;
    } else {
      this.state.milestones.push(milestone);
    }
  }

  /**
   * Reset sync state (user-initiated).
   */
  reset(): void {
    this.state = null;
    if (fs.existsSync(this.statePath)) {
      fs.unlinkSync(this.statePath);
      this.logger.info('Sync state reset');
    }
  }

  /**
   * Get current state (may be null if not loaded).
   */
  getState(): SyncState | null {
    return this.state;
  }
}
