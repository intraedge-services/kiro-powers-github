#!/usr/bin/env node
/**
 * GitHub Power — Demo Mode
 *
 * Parses sample stories, syncs to GitHub, prints results, exits.
 * Usage: node dist/demo.js
 */

import { existsSync } from 'node:fs';
import { createLogger } from './logger.js';
import { ConfigManager } from './config-manager.js';
import { parseStories } from './story-parser.js';
import { LiveGitHubClient, GitHubApiError } from './github-client.js';
import { ProjectsClient } from './projects-client.js';
import { buildIssueBody } from './mapping-strategies.js';
import { PowerError } from './types.js';
import type { ParsedStory } from './story-parser.js';

const logger = createLogger('demo');

async function runDemo(): Promise<void> {
  console.log('========================================');
  console.log('  Running Demo Mode');
  console.log('========================================\n');

  // Step 1: Load config
  console.log('📋 Step 1: Loading configuration...');
  const configManager = new ConfigManager(logger);
  configManager.loadConfig();
  const { owner, repo } = configManager.getRepository();

  console.log(`   Owner: ${owner}`);
  console.log(`   Repo:  ${repo}`);
  console.log(`   Token: \${GITHUB_TOKEN} (${process.env.GITHUB_TOKEN ? 'set' : 'NOT SET'})`);

  if (!process.env.GITHUB_TOKEN) {
    console.error('\n   ❌ GITHUB_TOKEN environment variable is not set.');
    console.error('   Fix: export GITHUB_TOKEN=ghp_your_token_here');
    process.exit(1);
  }

  // Step 2: Parse stories
  console.log('\n📋 Step 2: Parsing stories...');
  const storiesPath = process.argv[3] || 'sample-stories/sample-story.md';

  // Debug logging
  console.log(`   [debug] storiesPath = ${storiesPath}`);
  console.log(`   [debug] file exists = ${existsSync(storiesPath)}`);

  let parsedStories;
  try {
    parsedStories = parseStories(storiesPath);
  } catch (err) {
    console.error(`   ❌ Cannot read stories from: ${storiesPath}`);
    console.error(`   Error: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`   [debug] raw parsed story count = ${parsedStories.metadata.totalStories}`);
  console.log(`   Found ${parsedStories.metadata.totalStories} stories in ${parsedStories.epics.length} epics:`);
  for (const epic of parsedStories.epics) {
    console.log(`     Epic ${epic.number}: "${epic.name}" (${epic.stories.length} stories)`);
    for (const story of epic.stories) {
      console.log(`       • ${story.title} (${story.acceptanceCriteria.length} criteria)`);
    }
  }

  // Step 3: Live sync to GitHub
  console.log('\n📋 Step 3: Syncing to GitHub...');
  console.log(`   Target: ${owner}/${repo}`);
  console.log(`   [debug] Parsed owner = "${owner}"`);
  console.log(`   [debug] Parsed repo  = "${repo}"`);

  const client = new LiveGitHubClient(
    logger,
    { maxRetries: 3, initialBackoffMs: 1000, maxBackoffMs: 10000 },
    process.env.GITHUB_TOKEN
  );

  // Startup connectivity test — fail early if repo is inaccessible
  try {
    await client.verifyRepoAccess(owner, repo);
  } catch (err: unknown) {
    if (err instanceof GitHubApiError) {
      console.error(`\n   ❌ Repository access check failed`);
      console.error(`      Status:      ${err.status} (${GitHubApiError.summarize(err.status)})`);
      console.error(`      Endpoint:    ${err.endpoint}`);
      console.error(`      Response:    ${err.responseBody}`);
      console.error(`      Remediation: ${err.remediation}`);
    } else if (err instanceof PowerError) {
      console.error(`\n   ❌ Repository access check failed`);
      console.error(`      Code:        ${err.code}`);
      console.error(`      Message:     ${err.message}`);
      console.error(`      Remediation: ${err.remediation ?? 'Check logs for details'}`);
    } else {
      console.error(`\n   ❌ Repository access check failed: ${(err as Error).message}`);
    }
    process.exit(1);
  }

  // Ensure the user-story label exists (422 = already exists, that's fine)
  try {
    await client.createLabel(owner, repo, {
      name: 'user-story',
      color: '0075CA',
      description: 'User story synced from AI-DLC',
    });
    console.log('   ✅ Label "user-story" ready');
  } catch (err: unknown) {
    if (err instanceof GitHubApiError) {
      console.error(`\n   ⚠️  Label creation failed (non-fatal — continuing)`);
      console.error(`      Status:      ${err.status} (${GitHubApiError.summarize(err.status)})`);
      console.error(`      Endpoint:    ${err.endpoint}`);
      console.error(`      Response:    ${err.responseBody}`);
      console.error(`      Remediation: ${err.remediation}`);
    } else if (err instanceof PowerError) {
      console.error(`\n   ⚠️  Label creation failed (non-fatal — continuing)`);
      console.error(`      Code:        ${err.code}`);
      console.error(`      Message:     ${err.message}`);
      console.error(`      Remediation: ${err.remediation ?? 'Check logs for details'}`);
    } else {
      console.error(`\n   ⚠️  Label creation failed (non-fatal — continuing): ${(err as Error).message}`);
    }
    console.log('   Proceeding to issue creation...\n');
  }

  const results: Array<{ story: ParsedStory; action: string; issueNumber?: number }> = [];

  for (const epic of parsedStories.epics) {
    for (const story of epic.stories) {
      const searchTitle = `[Story ${story.id}] ${story.title}`;

      try {
        // Idempotency: search for existing issue by title
        const existing = await client.searchIssues(owner, repo, `"${searchTitle}" in:title`);
        const match = existing.find((i) => i.title === searchTitle);

        if (match) {
          console.log(`   ⏭️  Skipped issue #${match.number}: "${story.title}" (already exists)`);
          results.push({ story, action: 'skipped', issueNumber: match.number });
        } else {
          const body = buildIssueBody(story, logger);
          const created = await client.createIssue(owner, repo, {
            title: searchTitle,
            body,
            labels: ['user-story'],
          });
          console.log(`   ✅ Created issue #${created.number}: "${story.title}"`);
          results.push({ story, action: 'created', issueNumber: created.number });
        }
      } catch (err: unknown) {
        if (err instanceof GitHubApiError) {
          console.error(`\n   ❌ GitHub API Error for story "${story.title}"`);
          console.error(`      Status:      ${err.status} (${GitHubApiError.summarize(err.status)})`);
          console.error(`      Endpoint:    ${err.endpoint}`);
          console.error(`      Response:    ${err.responseBody}`);
          console.error(`      Remediation: ${err.remediation}`);
        } else if (err instanceof PowerError) {
          console.error(`\n   ❌ GitHub API Error for story "${story.title}"`);
          console.error(`      Code:        ${err.code}`);
          console.error(`      Message:     ${err.message}`);
          console.error(`      Remediation: ${err.remediation ?? 'Check logs for details'}`);
        } else {
          console.error(`\n   ❌ Error syncing "${story.title}": ${(err as Error).message}`);
        }
        results.push({ story, action: 'failed' });
      }
    }
  }

  // Step 4: GitHub Projects automation
  console.log('\n📋 Step 4: GitHub Projects automation...');

  const projectsClient = new ProjectsClient(logger, process.env.GITHUB_TOKEN);
  const projectName = `${repo} — AI-DLC Stories`;

  try {
    // Find or create the project
    const project = await projectsClient.findOrCreateProject(owner, projectName);
    console.log(`   [debug] Project ID: ${project.id}`);
    console.log(`   [debug] Project URL: ${project.url}`);

    // Get Status field and verify options
    let statusFieldId: string | null = null;
    let statusOptions: Record<string, string> = {};

    try {
      const statusInfo = await projectsClient.ensureStatusOptions(project.id);
      statusFieldId = statusInfo.fieldId;
      statusOptions = statusInfo.optionMap;
    } catch (err) {
      console.log(`   ⚠️  Status field setup: ${(err as Error).message}`);
      console.log(`   Continuing without status automation...`);
    }

    // Add each synced issue to the project and set status
    for (const result of results) {
      if (!result.issueNumber) continue;

      try {
        // Get issue node ID for GraphQL
        const issueNodeId = await projectsClient.getIssueNodeId(owner, repo, result.issueNumber);

        // Add to project (idempotent — re-adding returns existing item)
        const itemId = await projectsClient.addIssueToProject(project.id, issueNodeId);
        console.log(`   ✅ Issue #${result.issueNumber} added to project → item ${itemId.slice(-8)}`);

        // Set status to "Todo" for new issues
        if (statusFieldId && statusOptions['Todo']) {
          await projectsClient.setItemStatus(project.id, itemId, statusFieldId, statusOptions['Todo']);
          console.log(`   [debug] Issue #${result.issueNumber} status → Todo`);
        }

        // Assign to repo owner (default assignee for demo)
        try {
          await projectsClient.assignIssue(owner, repo, result.issueNumber, [owner]);
          console.log(`   [debug] Issue #${result.issueNumber} assigned to @${owner}`);
        } catch {
          // Assignment may fail if owner is an org — non-fatal
          console.log(`   [debug] Could not assign issue #${result.issueNumber} (non-fatal)`);
        }
      } catch (err: unknown) {
        if (err instanceof GitHubApiError) {
          console.error(`   ⚠️  Project error for issue #${result.issueNumber}: ${err.status} ${err.responseBody}`);
        } else {
          console.error(`   ⚠️  Project error for issue #${result.issueNumber}: ${(err as Error).message}`);
        }
      }
    }

    console.log(`\n   📊 Project board: ${project.url}`);
  } catch (err: unknown) {
    if (err instanceof GitHubApiError) {
      console.error(`\n   ❌ GitHub Projects Error`);
      console.error(`      Status:      ${err.status} (${GitHubApiError.summarize(err.status)})`);
      console.error(`      Endpoint:    ${err.endpoint}`);
      console.error(`      Response:    ${err.responseBody}`);
      console.error(`      Remediation: ${err.remediation}`);
    } else if (err instanceof PowerError) {
      console.error(`\n   ❌ GitHub Projects Error`);
      console.error(`      Code:        ${err.code}`);
      console.error(`      Message:     ${err.message}`);
      console.error(`      Remediation: ${err.remediation ?? 'Check logs for details'}`);
    } else {
      console.error(`\n   ❌ GitHub Projects Error: ${(err as Error).message}`);
    }
    console.log('   Continuing without project automation...');
  }

  // Step 5: Summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 Sync Results');
  const created = results.filter((r) => r.action === 'created').length;
  const skipped = results.filter((r) => r.action === 'skipped').length;
  const failed = results.filter((r) => r.action === 'failed').length;
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Failed:  ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✨ Done.\n');
}

// Run and exit cleanly
runDemo().then(() => {
  console.log('[process] Demo complete. Exiting.');
  process.exit(0);
}).catch((err) => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
