import * as fs from 'node:fs';
import { createHash } from 'node:crypto';

// ============================================================
// Types
// ============================================================

export interface ParsedStories {
  epics: ParsedEpic[];
  metadata: {
    parsedAt: string;
    sourceFile: string;
    totalStories: number;
  };
}

export interface ParsedEpic {
  number: number;
  name: string;
  stories: ParsedStory[];
}

export interface ParsedStory {
  id: string;
  title: string;
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
  epicNumber: number;
}

// ============================================================
// Regex Patterns
// ============================================================

const EPIC_HEADING_PATTERN = /^## Epic (\d+):\s*(.+)$/gm;
const STORY_HEADING_PATTERN = /^### Story (\d+\.\d+):\s*(.+)$/gm;
const AS_A_PATTERN = /\*\*As a\*\*\s*(.+?),?\s*$/m;
const I_WANT_PATTERN = /\*\*I want\*\*\s*(.+?),?\s*$/m;
const SO_THAT_PATTERN = /\*\*So that\*\*\s*(.+?)\.?\s*$/m;
const CRITERIA_ITEM_PATTERN = /^- (.+)$/gm;

// ============================================================
// Public API
// ============================================================

/**
 * Parse an AI-DLC stories.md file into structured data.
 * Uses regex-based parsing to extract epics, stories, and acceptance criteria.
 */
export function parseStories(filePath: string): ParsedStories {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Stories file not found: ${filePath}. Run AI-DLC User Stories stage first.`
    );
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  if (content.trim().length === 0) {
    return {
      epics: [],
      metadata: {
        parsedAt: new Date().toISOString(),
        sourceFile: filePath,
        totalStories: 0,
      },
    };
  }

  const epics = parseEpics(content);
  const totalStories = epics.reduce((sum, epic) => sum + epic.stories.length, 0);

  return {
    epics,
    metadata: {
      parsedAt: new Date().toISOString(),
      sourceFile: filePath,
      totalStories,
    },
  };
}

/**
 * Calculate MD5 checksum for a parsed story (for change detection).
 * Based on title + acceptance criteria content.
 */
export function calculateChecksum(story: ParsedStory): string {
  const content = [story.title, ...story.acceptanceCriteria].join('\n');
  return createHash('md5').update(content).digest('hex');
}

// ============================================================
// Internal Parsing Functions
// ============================================================

/**
 * Split content into epics by ## Epic headings.
 */
function parseEpics(content: string): ParsedEpic[] {
  const epics: ParsedEpic[] = [];
  const epicMatches = [...content.matchAll(EPIC_HEADING_PATTERN)];

  if (epicMatches.length === 0) {
    // No epic headings found — try to parse stories directly
    const stories = parseStoriesInEpic(content, 0);
    if (stories.length > 0) {
      epics.push({ number: 0, name: 'Default', stories });
    }
    return epics;
  }

  for (let i = 0; i < epicMatches.length; i++) {
    const match = epicMatches[i];
    const epicNumber = parseInt(match[1], 10);
    const epicName = match[2].trim();

    // Get content between this epic heading and the next (or end of file)
    const startIndex = match.index! + match[0].length;
    const endIndex = i + 1 < epicMatches.length ? epicMatches[i + 1].index! : content.length;
    const epicContent = content.substring(startIndex, endIndex);

    const stories = parseStoriesInEpic(epicContent, epicNumber);
    epics.push({ number: epicNumber, name: epicName, stories });
  }

  return epics;
}

/**
 * Extract stories from within an epic's content section.
 */
function parseStoriesInEpic(content: string, epicNumber: number): ParsedStory[] {
  const stories: ParsedStory[] = [];
  const storyMatches = [...content.matchAll(STORY_HEADING_PATTERN)];

  for (let i = 0; i < storyMatches.length; i++) {
    const match = storyMatches[i];
    const storyId = match[1];
    const storyTitle = match[2].trim();

    // Get content between this story heading and the next (or end of section)
    const startIndex = match.index! + match[0].length;
    const endIndex = i + 1 < storyMatches.length ? storyMatches[i + 1].index! : content.length;
    const storyContent = content.substring(startIndex, endIndex);

    const story = parseStoryContent(storyId, storyTitle, storyContent, epicNumber);
    stories.push(story);
  }

  return stories;
}

/**
 * Parse individual story content to extract As-a/I-want/So-that and acceptance criteria.
 */
function parseStoryContent(
  id: string,
  title: string,
  content: string,
  epicNumber: number
): ParsedStory {
  const asAMatch = content.match(AS_A_PATTERN);
  const iWantMatch = content.match(I_WANT_PATTERN);
  const soThatMatch = content.match(SO_THAT_PATTERN);

  const acceptanceCriteria = parseAcceptanceCriteria(content);

  return {
    id,
    title,
    asA: asAMatch ? asAMatch[1].trim() : '',
    iWant: iWantMatch ? iWantMatch[1].trim() : '',
    soThat: soThatMatch ? soThatMatch[1].trim() : '',
    acceptanceCriteria,
    epicNumber,
  };
}

/**
 * Extract acceptance criteria bullet points from story content.
 * Looks for content after "Acceptance Criteria" heading or just extracts all bullet points.
 */
function parseAcceptanceCriteria(content: string): string[] {
  // Try to find criteria section
  const criteriaStart = content.indexOf('**Acceptance Criteria');
  const relevantContent = criteriaStart >= 0 ? content.substring(criteriaStart) : content;

  const criteria: string[] = [];
  const matches = relevantContent.matchAll(CRITERIA_ITEM_PATTERN);

  for (const match of matches) {
    const criterion = match[1].trim();
    if (criterion.length > 0) {
      criteria.push(criterion);
    }
  }

  return criteria;
}
