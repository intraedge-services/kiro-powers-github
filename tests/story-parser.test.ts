import { parseStories, calculateChecksum } from '../src/story-parser.js';
import * as fs from 'node:fs';

jest.mock('node:fs');
const mockFs = fs as jest.Mocked<typeof fs>;

const SAMPLE_STORIES = `# User Stories

## Epic 1: Configuration & Setup

### Story 1.1: Guided Power Setup
**As a** developer setting up the GitHub Power,
**I want** a step-by-step guided setup,
**So that** I can get the Power working quickly.

**Acceptance Criteria:**
- Setup prompts for auth method
- Setup validates token scopes
- Setup creates config file

### Story 1.2: Authentication Configuration
**As a** developer,
**I want** to configure authentication,
**So that** I can access GitHub API securely.

**Acceptance Criteria:**
- PAT tokens stored in env vars
- Token scopes validated on setup

## Epic 2: AI-DLC Sync

### Story 2.1: Post-User-Stories Sync
**As a** developer using AI-DLC,
**I want** to be prompted to sync after User Stories,
**So that** my planning flows into GitHub.

**Acceptance Criteria:**
- Hook fires after User Stories stage
- User prompted with sync option
- Workflow continues if declined
`;

describe('Story Parser', () => {
  describe('parseStories', () => {
    it('should parse valid stories.md with epics and stories', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(SAMPLE_STORIES);

      const result = parseStories('stories.md');

      expect(result.epics).toHaveLength(2);
      expect(result.epics[0].number).toBe(1);
      expect(result.epics[0].name).toBe('Configuration & Setup');
      expect(result.epics[0].stories).toHaveLength(2);
      expect(result.epics[1].number).toBe(2);
      expect(result.epics[1].stories).toHaveLength(1);
      expect(result.metadata.totalStories).toBe(3);
    });

    it('should extract story fields correctly', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(SAMPLE_STORIES);

      const result = parseStories('stories.md');
      const story = result.epics[0].stories[0];

      expect(story.id).toBe('1.1');
      expect(story.title).toBe('Guided Power Setup');
      expect(story.asA).toContain('developer');
      expect(story.iWant).toContain('step-by-step');
      expect(story.soThat).toContain('quickly');
      expect(story.epicNumber).toBe(1);
    });

    it('should extract acceptance criteria', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue(SAMPLE_STORIES);

      const result = parseStories('stories.md');
      const story = result.epics[0].stories[0];

      expect(story.acceptanceCriteria).toHaveLength(3);
      expect(story.acceptanceCriteria[0]).toContain('auth method');
    });

    it('should throw when file does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      expect(() => parseStories('missing.md')).toThrow('Stories file not found');
    });

    it('should return empty result for empty file', () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.readFileSync.mockReturnValue('');

      const result = parseStories('empty.md');
      expect(result.epics).toHaveLength(0);
      expect(result.metadata.totalStories).toBe(0);
    });
  });

  describe('calculateChecksum', () => {
    it('should return consistent checksum for same content', () => {
      const story = {
        id: '1.1',
        title: 'Test Story',
        asA: 'user',
        iWant: 'feature',
        soThat: 'benefit',
        acceptanceCriteria: ['criterion 1', 'criterion 2'],
        epicNumber: 1,
      };

      const checksum1 = calculateChecksum(story);
      const checksum2 = calculateChecksum(story);
      expect(checksum1).toBe(checksum2);
    });

    it('should return different checksum for different content', () => {
      const story1 = {
        id: '1.1',
        title: 'Story A',
        asA: '',
        iWant: '',
        soThat: '',
        acceptanceCriteria: ['criterion 1'],
        epicNumber: 1,
      };
      const story2 = {
        id: '1.1',
        title: 'Story B',
        asA: '',
        iWant: '',
        soThat: '',
        acceptanceCriteria: ['criterion 1'],
        epicNumber: 1,
      };

      expect(calculateChecksum(story1)).not.toBe(calculateChecksum(story2));
    });

    it('should return 32-character hex string', () => {
      const story = {
        id: '1.1',
        title: 'Test',
        asA: '',
        iWant: '',
        soThat: '',
        acceptanceCriteria: [],
        epicNumber: 1,
      };

      const checksum = calculateChecksum(story);
      expect(checksum).toMatch(/^[0-9a-f]{32}$/);
    });
  });
});
