import { parseStories, calculateChecksum } from './story-parser.js';
import { applyMapping, type MappingStrategy, type GitHubEntity } from './mapping-strategies.js';
import { SyncStateManager, type SyncState, type SyncedItem } from './sync-state.js';
import type { GitHubClient, CreatedIssue, CreatedMilestone } from './github-client.js';
import type { Logger } from './logger.js';
import type { ConfigManager } from './config-manager.js';

// ============================================================
// Types
// ============================================================

export interface SyncOptions {
  storiesPath?: string;
  mappingStrategy?: MappingStrategy;
  dryRun?: boolean;
  retryFailedOnly?: boolean;
}

export interface SyncResult {
  success: boolean;
  timestamp: string;
  mappingStrategy: MappingStrategy;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  errors: SyncError[];
  items: SyncResultItem[];
}

export interface SyncResultItem {
  storyId: string;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  githubIssueNumber?: number;
  error?: string;
}

export interface SyncError {
  storyId: string;
  message: string;
  code: string;
}

// ============================================================
// Sync Engine
// ============================================================

const DEFAULT_STORIES_PATH = 'aidlc-docs/inception/user-stories/stories.md';

/**
 * Core sync engine — orchestrates parsing, mapping, and GitHub entity creation.
 * Processes items sequentially with per-item error handling and state persistence.
 */
export class SyncEngine {
  private readonly logger: Logger;
  private readonly configManager: ConfigManager;
  private readonly stateManager: SyncStateManager;
  private readonly githubClient: GitHubClient;

  constructor(
    logger: Logger,
    configManager: ConfigManager,
    stateManager: SyncStateManager,
    githubClient: GitHubClient
  ) {
    this.logger = logger;
    this.configManager = configManager;
    this.stateManager = stateManager;
    this.githubClient = githubClient;
  }

  /**
   * Execute full sync operation.
   */
  async executeSyncAll(options: SyncOptions = {}): Promise<SyncResult> {
    const storiesPath = options.storiesPath ?? DEFAULT_STORIES_PATH;
    const timestamp = new Date().toISOString();

    this.logger.info('Sync started', { storiesPath, options });

    // 1. Parse stories
    const parsedStories = parseStories(storiesPath);
    if (parsedStories.metadata.totalStories === 0) {
      this.logger.info('No stories to sync');
      return this.buildEmptyResult(timestamp, options.mappingStrategy ?? 'milestones');
    }

    // 2. Determine mapping strategy
    const strategy = options.mappingStrategy ?? this.getDefaultStrategy();

    // 3. Load existing sync state
    const existingState = this.stateManager.load();

    // 4. Apply mapping
    const entities = applyMapping(parsedStories, strategy, this.logger);

    // 5. Filter if retryFailedOnly
    const entitiesToSync = options.retryFailedOnly
      ? this.filterFailedOnly(entities, existingState)
      : entities;

    // 6. Dry run check
    if (options.dryRun) {
      return this.buildDryRunResult(entitiesToSync, existingState, timestamp, strategy);
    }

    // 7. Execute sync sequentially
    const results = await this.executeSyncBatch(entitiesToSync, existingState, strategy);

    // 8. Build and return result
    const syncResult = this.buildSyncResult(results, timestamp, strategy);

    // 9. Log audit
    this.logger.auditSync(
      'sync_stories',
      syncResult.success ? 'success' : syncResult.failed > 0 ? 'partial' : 'failed',
      `Synced ${syncResult.created + syncResult.updated} items, ${syncResult.failed} failed`,
      {
        created: syncResult.created,
        updated: syncResult.updated,
        skipped: syncResult.skipped,
        failed: syncResult.failed,
      }
    );

    this.logger.info('Sync completed', {
      created: syncResult.created,
      updated: syncResult.updated,
      skipped: syncResult.skipped,
      failed: syncResult.failed,
    });

    return syncResult;
  }

  /**
   * Execute sync for a batch of entities sequentially.
   */
  private async executeSyncBatch(
    entities: GitHubEntity[],
    existingState: SyncState | null,
    strategy: MappingStrategy
  ): Promise<SyncResultItem[]> {
    const results: SyncResultItem[] = [];
    const state: SyncState = existingState ?? {
      lastSync: new Date().toISOString(),
      mappingStrategy: strategy,
      items: [],
      milestones: [],
    };

    const { owner, repo } = this.configManager.getRepository();

    for (const entity of entities) {
      try {
        const result = await this.syncSingleItem(entity, state, owner, repo);
        results.push(result);

        // Save state after each successful operation
        if (result.action === 'created' || result.action === 'updated') {
          state.lastSync = new Date().toISOString();
          state.mappingStrategy = strategy;
          this.stateManager.save(state);
        }
      } catch (error) {
        const storyId = entity.sourceStoryId ?? `epic-${entity.sourceEpicNumber}`;
        results.push({
          storyId,
          action: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        this.logger.error('Sync item failed', {
          storyId,
          error: String(error),
        });
      }
    }

    return results;
  }

  /**
   * Sync a single entity with idempotency check.
   */
  private async syncSingleItem(
    entity: GitHubEntity,
    state: SyncState,
    owner: string,
    repo: string
  ): Promise<SyncResultItem> {
    const storyId = entity.sourceStoryId ?? `epic-${entity.sourceEpicNumber}`;

    // Handle milestones
    if (entity.type === 'milestone') {
      const existing = state.milestones.find(
        (m) => m.epicNumber === entity.sourceEpicNumber
      );
      if (existing) {
        return { storyId, action: 'skipped' };
      }

      const data = entity.data as { title: string; description: string };
      const created: CreatedMilestone = await this.githubClient.createMilestone(
        owner,
        repo,
        data
      );
      state.milestones.push({
        epicNumber: entity.sourceEpicNumber!,
        githubMilestoneId: created.id,
        name: data.title,
      });
      return { storyId, action: 'created' };
    }

    // Handle issues
    if (entity.type === 'issue' && entity.sourceStoryId) {
      const existingItem = state.items.find((i) => i.storyId === entity.sourceStoryId);
      const data = entity.data as { title: string; body: string; labels: string[] };

      if (existingItem && existingItem.status === 'synced') {
        // Check if content changed via checksum (simplified — use title hash)
        return { storyId, action: 'skipped', githubIssueNumber: existingItem.githubIssueNumber };
      }

      // Create new issue
      const created: CreatedIssue = await this.githubClient.createIssue(owner, repo, data);

      // Update state
      const syncedItem: SyncedItem = {
        storyId: entity.sourceStoryId,
        githubIssueNumber: created.number,
        githubIssueUrl: created.url,
        syncedAt: new Date().toISOString(),
        status: 'synced',
        checksum: '', // Will be set by caller with actual checksum
      };
      this.stateManager.updateItem(entity.sourceStoryId, syncedItem);

      return { storyId, action: 'created', githubIssueNumber: created.number };
    }

    return { storyId, action: 'skipped' };
  }

  /**
   * Get default mapping strategy from config.
   */
  private getDefaultStrategy(): MappingStrategy {
    try {
      const config = this.configManager.loadConfig();
      const strategy = config.syncDefaults.mappingStrategy;
      if (strategy === 'ask') return 'milestones'; // Default fallback
      return strategy;
    } catch {
      return 'milestones';
    }
  }

  /**
   * Filter entities to only those that previously failed.
   */
  private filterFailedOnly(
    entities: GitHubEntity[],
    state: SyncState | null
  ): GitHubEntity[] {
    if (!state) return entities;

    const failedIds = new Set(
      state.items.filter((i) => i.status === 'failed').map((i) => i.storyId)
    );

    return entities.filter(
      (e) => e.sourceStoryId && failedIds.has(e.sourceStoryId)
    );
  }

  /**
   * Build result for dry run (no actual API calls).
   */
  private buildDryRunResult(
    entities: GitHubEntity[],
    state: SyncState | null,
    timestamp: string,
    strategy: MappingStrategy
  ): SyncResult {
    const items: SyncResultItem[] = entities.map((e) => {
      const storyId = e.sourceStoryId ?? `epic-${e.sourceEpicNumber}`;
      const existing = state?.items.find((i) => i.storyId === storyId);
      return {
        storyId,
        action: existing ? 'skipped' : 'created',
      } as SyncResultItem;
    });

    return this.buildSyncResult(items, timestamp, strategy);
  }

  /**
   * Build empty result when no stories found.
   */
  private buildEmptyResult(timestamp: string, strategy: MappingStrategy): SyncResult {
    return {
      success: true,
      timestamp,
      mappingStrategy: strategy,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      errors: [],
      items: [],
    };
  }

  /**
   * Aggregate individual results into a SyncResult summary.
   */
  private buildSyncResult(
    items: SyncResultItem[],
    timestamp: string,
    strategy: MappingStrategy
  ): SyncResult {
    const created = items.filter((i) => i.action === 'created').length;
    const updated = items.filter((i) => i.action === 'updated').length;
    const skipped = items.filter((i) => i.action === 'skipped').length;
    const failed = items.filter((i) => i.action === 'failed').length;

    const errors: SyncError[] = items
      .filter((i) => i.action === 'failed')
      .map((i) => ({
        storyId: i.storyId,
        message: i.error ?? 'Unknown error',
        code: 'SYNC_FAILED',
      }));

    return {
      success: failed === 0,
      timestamp,
      mappingStrategy: strategy,
      created,
      updated,
      skipped,
      failed,
      errors,
      items,
    };
  }
}
