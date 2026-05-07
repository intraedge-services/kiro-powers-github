import type { ParsedStories, ParsedStory, ParsedEpic } from './story-parser.js';
import type { Logger } from './logger.js';

// ============================================================
// Types
// ============================================================

export type MappingStrategy = 'milestones' | 'labels' | 'custom-fields';
export type GitHubEntityType = 'milestone' | 'issue' | 'label';

export interface GitHubEntity {
  type: GitHubEntityType;
  action: 'create' | 'update';
  data: MilestoneData | IssueData | LabelData;
  sourceStoryId?: string;
  sourceEpicNumber?: number;
}

export interface MilestoneData {
  title: string;
  description: string;
}

export interface IssueData {
  title: string;
  body: string;
  labels: string[];
  milestoneTitle?: string;
}

export interface LabelData {
  name: string;
  color: string;
  description: string;
}

// ============================================================
// GitHub API Limits
// ============================================================

const GITHUB_LIMITS = {
  issueTitle: 256,
  issueBody: 65536,
  labelName: 50,
  milestoneTitle: 255,
} as const;

// ============================================================
// Public API
// ============================================================

/**
 * Apply a mapping strategy to transform parsed stories into GitHub entities.
 */
export function applyMapping(
  stories: ParsedStories,
  strategy: MappingStrategy,
  logger?: Logger
): GitHubEntity[] {
  switch (strategy) {
    case 'milestones':
      return applyMilestonesStrategy(stories, logger);
    case 'labels':
      return applyLabelsStrategy(stories, logger);
    case 'custom-fields':
      return applyCustomFieldsStrategy(stories, logger);
    default:
      throw new Error(`Unknown mapping strategy: ${strategy}`);
  }
}

/**
 * Build the issue body from a parsed story with metadata footer.
 */
export function buildIssueBody(story: ParsedStory, logger?: Logger): string {
  const parts: string[] = [];

  if (story.asA) parts.push(`**As a** ${story.asA},`);
  if (story.iWant) parts.push(`**I want** ${story.iWant},`);
  if (story.soThat) parts.push(`**So that** ${story.soThat}.`);

  if (parts.length > 0) parts.push('');

  if (story.acceptanceCriteria.length > 0) {
    parts.push('## Acceptance Criteria');
    for (const criterion of story.acceptanceCriteria) {
      parts.push(`- ${criterion}`);
    }
    parts.push('');
  }

  parts.push('---');
  parts.push(
    `_Synced from AI-DLC | Story ID: ${story.id} | Synced at: ${new Date().toISOString()}_`
  );

  const body = parts.join('\n');
  return validateAndTruncate(body, 'issueBody', logger);
}

/**
 * Validate content length and truncate if exceeding GitHub API limits.
 */
export function validateAndTruncate(
  content: string,
  field: keyof typeof GITHUB_LIMITS,
  logger?: Logger
): string {
  const limit = GITHUB_LIMITS[field];
  if (content.length <= limit) return content;

  logger?.warn(`Content truncated for ${field}`, {
    originalLength: content.length,
    limit,
  });

  return content.substring(0, limit - 3) + '...';
}

// ============================================================
// Strategy Implementations
// ============================================================

/**
 * Strategy A: Epics → Milestones, Stories → Issues (assigned to milestone)
 */
function applyMilestonesStrategy(stories: ParsedStories, logger?: Logger): GitHubEntity[] {
  const entities: GitHubEntity[] = [];

  for (const epic of stories.epics) {
    // Create milestone for each epic
    entities.push({
      type: 'milestone',
      action: 'create',
      data: {
        title: validateAndTruncate(epic.name, 'milestoneTitle', logger),
        description: `Epic from AI-DLC User Stories`,
      } as MilestoneData,
      sourceEpicNumber: epic.number,
    });

    // Create issue for each story, assigned to milestone
    for (const story of epic.stories) {
      entities.push({
        type: 'issue',
        action: 'create',
        data: {
          title: validateAndTruncate(`[Story ${story.id}] ${story.title}`, 'issueTitle', logger),
          body: buildIssueBody(story, logger),
          labels: ['story'],
          milestoneTitle: epic.name,
        } as IssueData,
        sourceStoryId: story.id,
        sourceEpicNumber: epic.number,
      });
    }
  }

  return entities;
}

/**
 * Strategy B: Epics → Issues (epic label), Stories → Issues (story label)
 */
function applyLabelsStrategy(stories: ParsedStories, logger?: Logger): GitHubEntity[] {
  const entities: GitHubEntity[] = [];

  for (const epic of stories.epics) {
    // Create epic issue
    entities.push({
      type: 'issue',
      action: 'create',
      data: {
        title: validateAndTruncate(`[Epic ${epic.number}] ${epic.name}`, 'issueTitle', logger),
        body: `# ${epic.name}\n\nEpic containing ${epic.stories.length} user stories.\n\n---\n_Synced from AI-DLC_`,
        labels: ['epic'],
      } as IssueData,
      sourceEpicNumber: epic.number,
    });

    // Create story issues
    for (const story of epic.stories) {
      entities.push({
        type: 'issue',
        action: 'create',
        data: {
          title: validateAndTruncate(`[Story ${story.id}] ${story.title}`, 'issueTitle', logger),
          body: buildIssueBody(story, logger),
          labels: ['story'],
        } as IssueData,
        sourceStoryId: story.id,
        sourceEpicNumber: epic.number,
      });
    }
  }

  return entities;
}

/**
 * Strategy C: Stories → Issues, Epic tracked via custom field (Projects V2)
 */
function applyCustomFieldsStrategy(stories: ParsedStories, logger?: Logger): GitHubEntity[] {
  const entities: GitHubEntity[] = [];

  for (const epic of stories.epics) {
    for (const story of epic.stories) {
      entities.push({
        type: 'issue',
        action: 'create',
        data: {
          title: validateAndTruncate(`[Story ${story.id}] ${story.title}`, 'issueTitle', logger),
          body: buildIssueBody(story, logger),
          labels: ['story'],
        } as IssueData,
        sourceStoryId: story.id,
        sourceEpicNumber: epic.number,
      });
    }
  }

  return entities;
}
