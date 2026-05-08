# User Stories: Kiro Power for GitHub

## Epic 1: Power Setup & Configuration

### Story 1.1: Install and Configure the Power
**As a** Developer  
**I want to** install the GitHub Power and configure authentication  
**So that** I can manage GitHub projects directly from Kiro

**Scenarios:**
- **Scenario: First-time PAT setup** — Developer installs the Power, is prompted for a GitHub PAT, enters it, and the Power validates the token has required scopes (repo, project, read:org). Power confirms successful connection.
- **Scenario: Remote MCP server selection** — Developer chooses the remote GitHub MCP Server configuration. Power configures `mcp.json` to point to `https://api.githubcopilot.com/mcp/` with PAT header.
- **Scenario: Local MCP server selection** — Developer chooses the local Docker-based server. Power configures `mcp.json` to use `docker run ghcr.io/github/github-mcp-server` with PAT environment variable.
- **Scenario: AIDLC context** — When AIDLC workflow starts and the Power is active, the Power validates GitHub connectivity before proceeding with project operations.

---

### Story 1.2: Validate Power Activation via Keywords
**As a** Developer  
**I want** the Power to activate automatically when I mention GitHub-related keywords  
**So that** I don't need to manually invoke it

**Scenarios:**
- **Scenario: Keyword activation** — Developer says "create an issue on the project board" and the Power activates, providing GitHub project management tools.
- **Scenario: Multiple keyword triggers** — Keywords "github", "project", "board", "issue", "PR", "pull request", "sprint", "iteration", "backlog" all trigger Power activation.
- **Scenario: Non-matching context** — Developer discusses unrelated topics; Power does not activate unnecessarily.

---

### Story 1.3: Onboarding Validation
**As a** Developer  
**I want** the Power to verify all prerequisites during first use  
**So that** I know everything is properly configured before I start working

**Scenarios:**
- **Scenario: Docker check for local mode** — Power checks if Docker is running when local MCP server is selected. If not running, provides clear instructions to start Docker.
- **Scenario: PAT scope validation** — Power tests the PAT against GitHub API to confirm required scopes. If scopes are missing, lists exactly which scopes need to be added.
- **Scenario: Projects V2 access check** — Power verifies the PAT can access GitHub Projects V2 GraphQL API. Reports success or specific permission issues.

---

### Story 1.4: Hook Installation During Setup
**As a** Developer  
**I want** automation hooks to be installed during Power setup  
**So that** project board updates happen automatically without manual intervention

**Scenarios:**
- **Scenario: Hook creation** — During onboarding, Power creates hooks for postTaskExecution (sync board), userTriggered (PR notifications), and other automation triggers.
- **Scenario: Existing hooks preserved** — If hooks already exist in `.kiro/hooks/`, Power does not overwrite them but adds new ones alongside.

---

## Epic 2: Project Board Management

### Story 2.1: Create a New GitHub Project
**As a** Project Manager  
**I want to** create a new GitHub Project V2 board with standard columns  
**So that** my team has a place to track work

**Scenarios:**
- **Scenario: Create with defaults** — PM says "create a new project called Sprint-1". Power creates a GitHub Project V2 with default columns: Backlog, Todo, In Progress, Review, Done.
- **Scenario: Create for organization** — PM specifies an organization. Power creates the project under that org (requires org-level permissions).
- **Scenario: Create for user** — PM doesn't specify org. Power creates the project under the authenticated user's account.
- **Scenario: AIDLC integration** — When AIDLC workflow starts and no project exists, Power offers to create one for tracking AIDLC-generated work items.

---

### Story 2.2: List Projects
**As a** Project Manager  
**I want to** see all my GitHub Projects  
**So that** I can select which one to work with

**Scenarios:**
- **Scenario: List user projects** — PM asks "show my projects". Power lists all Projects V2 accessible to the authenticated user with title, description, and item count.
- **Scenario: List org projects** — PM asks "show projects for org X". Power lists organization-level projects.
- **Scenario: Set active project** — PM selects a project from the list. Power remembers this as the active project for subsequent operations.

---

### Story 2.3: Add Items to Project Board
**As a** Developer  
**I want to** add existing issues or PRs to the project board  
**So that** all work is visible in one place

**Scenarios:**
- **Scenario: Add issue by number** — Developer says "add issue #42 to the project". Power adds the issue to the active project board in the "Backlog" column.
- **Scenario: Add PR to board** — Developer says "add PR #15 to the board". Power adds the PR as a project item.
- **Scenario: Bulk add** — Developer says "add all open issues labeled 'sprint-1' to the project". Power queries issues by label and adds them all.
- **Scenario: AIDLC auto-add** — When AIDLC creates issues from user stories, they are automatically added to the project board in "Todo" status.

---

### Story 2.4: Move Items Between Columns
**As a** Developer  
**I want to** move items between board columns  
**So that** the board reflects current work status

**Scenarios:**
- **Scenario: Move single item** — Developer says "move issue #42 to In Progress". Power updates the Status field on the project item via GraphQL.
- **Scenario: Move by title** — Developer says "move 'Setup database' to Review". Power finds the item by title and updates its status.
- **Scenario: AIDLC auto-move** — When AIDLC begins Code Generation for a story, the corresponding issue automatically moves to "In Progress". When Build & Test completes, it moves to "Done".

---

### Story 2.5: View Board Status
**As a** Project Manager  
**I want to** see the current state of the project board  
**So that** I can understand team progress at a glance

**Scenarios:**
- **Scenario: Full board view** — PM asks "show the board". Power displays items grouped by status column with titles, assignees, and labels.
- **Scenario: Column-specific view** — PM asks "what's in progress?". Power lists only items in the "In Progress" column.
- **Scenario: Assignee view** — PM asks "what is Alex working on?". Power filters board items by assignee.

---

### Story 2.6: Archive and Remove Items
**As a** Project Manager  
**I want to** archive completed items or remove irrelevant ones  
**So that** the board stays clean and focused

**Scenarios:**
- **Scenario: Archive done items** — PM says "archive all done items". Power archives all items in the "Done" column.
- **Scenario: Remove single item** — PM says "remove issue #99 from the project". Power removes the item from the project (issue remains open in the repo).
- **Scenario: Bulk archive** — PM says "archive items completed before last week". Power filters by completion date and archives matching items.

---

## Epic 3: Issue Management

### Story 3.1: Create Issues
**As a** Developer  
**I want to** create GitHub issues from within Kiro  
**So that** I can track work without leaving my IDE

**Scenarios:**
- **Scenario: Simple issue** — Developer says "create issue: Fix login timeout". Power creates an issue with that title in the current repository.
- **Scenario: Detailed issue** — Developer provides title, body, labels, and assignee. Power creates the issue with all specified fields.
- **Scenario: Issue with project** — Developer says "create issue and add to board". Power creates the issue AND adds it to the active project in "Todo".
- **Scenario: AIDLC story conversion** — When AIDLC generates user stories, each story becomes a GitHub issue with the story title, description, and acceptance criteria in the body.

---

### Story 3.2: Update Issues
**As a** Developer  
**I want to** update issue properties  
**So that** issues stay current as work evolves

**Scenarios:**
- **Scenario: Change assignee** — Developer says "assign issue #42 to Sam". Power updates the assignee.
- **Scenario: Add labels** — Developer says "label issue #42 as 'bug' and 'high-priority'". Power adds the labels.
- **Scenario: Close issue** — Developer says "close issue #42". Power closes the issue and moves it to "Done" on the board.
- **Scenario: Update body** — Developer says "update issue #42 description with the new requirements". Power updates the issue body.

---

### Story 3.3: Search and Filter Issues
**As a** Project Manager  
**I want to** search and filter issues  
**So that** I can find specific work items quickly

**Scenarios:**
- **Scenario: Search by keyword** — PM asks "find issues about authentication". Power searches issue titles and bodies.
- **Scenario: Filter by label** — PM asks "show all bugs". Power lists issues with the "bug" label.
- **Scenario: Filter by state** — PM asks "show open issues assigned to Alex". Power filters by state and assignee.
- **Scenario: Filter by milestone** — PM asks "show issues in milestone v1.0". Power filters by milestone.

---

### Story 3.4: Add Comments to Issues
**As a** Team Lead  
**I want to** add comments to issues  
**So that** I can provide feedback and track discussions

**Scenarios:**
- **Scenario: Add comment** — TL says "comment on issue #42: Please add unit tests for this". Power adds the comment.
- **Scenario: AIDLC progress comment** — When AIDLC completes a stage related to an issue, a comment is added noting the progress (e.g., "Code Generation complete for this story").

---

### Story 3.5: Manage Labels and Milestones
**As a** Project Manager  
**I want to** organize issues with labels and milestones  
**So that** work is categorized and scheduled

**Scenarios:**
- **Scenario: Create labels** — PM says "create labels: feature, bug, enhancement, documentation". Power creates the labels in the repository.
- **Scenario: Assign milestone** — PM says "add issues #10, #11, #12 to milestone Sprint-1". Power assigns the milestone.
- **Scenario: AIDLC phase labels** — Issues created from AIDLC are automatically labeled with the phase (e.g., "aidlc:inception", "aidlc:construction").

---

## Epic 4: PR Workflow Automation

### Story 4.1: Create Branch from Issue
**As a** Developer  
**I want to** create a feature branch linked to an issue  
**So that** my work is traceable from issue to code

**Scenarios:**
- **Scenario: Auto-named branch** — Developer says "create branch for issue #42". Power creates branch `feature/42-fix-login-timeout` from the default branch.
- **Scenario: Custom branch name** — Developer says "create branch 'hotfix/auth-fix' for issue #42". Power creates the specified branch.
- **Scenario: Board update** — When branch is created, the linked issue moves to "In Progress" on the board.

---

### Story 4.2: Create Pull Request from Issue
**As a** Developer  
**I want to** create a PR that references an issue  
**So that** the issue auto-closes when the PR merges

**Scenarios:**
- **Scenario: PR with auto-close** — Developer says "create PR for issue #42". Power creates a PR with title from the issue and body containing "Closes #42".
- **Scenario: Draft PR** — Developer says "create draft PR for issue #42". Power creates a draft PR linked to the issue.
- **Scenario: Board update** — When PR is created, the linked issue moves to "Review" on the board.
- **Scenario: AIDLC context** — When AIDLC Code Generation completes, it can create a PR for the generated code linked to the corresponding issue.

---

### Story 4.3: Request Code Review
**As a** Developer  
**I want to** request a code review on my PR  
**So that** team members are notified to review my changes

**Scenarios:**
- **Scenario: Request specific reviewer** — Developer says "request review from Sam on PR #15". Power adds Sam as a reviewer.
- **Scenario: Request Copilot review** — Developer says "request Copilot review on PR #15". Power triggers GitHub Copilot code review.
- **Scenario: Board stays in Review** — Issue remains in "Review" column while PR is under review.

---

### Story 4.4: Merge PR and Auto-Close Issue
**As a** Team Lead  
**I want** PRs to auto-close linked issues when merged  
**So that** the board updates automatically

**Scenarios:**
- **Scenario: Merge and close** — TL says "merge PR #15". Power merges the PR, GitHub auto-closes the linked issue, and the board item moves to "Done".
- **Scenario: Squash merge** — TL says "squash merge PR #15". Power performs a squash merge with the same auto-close behavior.
- **Scenario: Board finalization** — After merge, the project board item status updates to "Done" automatically.

---

### Story 4.5: View PR Status and Checks
**As a** Team Lead  
**I want to** check PR status including CI checks  
**So that** I know if a PR is ready to merge

**Scenarios:**
- **Scenario: PR status check** — TL asks "what's the status of PR #15?". Power shows review status, CI check results, and merge readiness.
- **Scenario: List open PRs** — TL asks "show all open PRs". Power lists PRs with their review and check status.
- **Scenario: PR diff** — TL asks "show the diff for PR #15". Power retrieves and displays the PR diff.

---

### Story 4.6: Update PR Branch
**As a** Developer  
**I want to** update my PR branch with latest changes from main  
**So that** my PR stays up to date and mergeable

**Scenarios:**
- **Scenario: Update branch** — Developer says "update PR #15 branch". Power updates the PR branch with the latest base branch changes.
- **Scenario: Conflict notification** — If update fails due to conflicts, Power reports the conflict and suggests resolution steps.

---

## Epic 5: Advanced Project Features

### Story 5.1: Manage Custom Fields
**As a** Project Manager  
**I want to** create and manage custom fields on the project  
**So that** I can track additional metadata like priority and effort

**Scenarios:**
- **Scenario: Create priority field** — PM says "add a Priority field with options: Low, Medium, High, Critical". Power creates a single-select custom field via GraphQL.
- **Scenario: Set field value** — PM says "set priority of issue #42 to High". Power updates the custom field value on the project item.
- **Scenario: Create date field** — PM says "add a Due Date field". Power creates a date-type custom field.

---

### Story 5.2: Manage Iterations/Sprints
**As a** Project Manager  
**I want to** create and manage iterations  
**So that** work is organized into time-boxed sprints

**Scenarios:**
- **Scenario: Create iteration** — PM says "create iteration Sprint-3 from May 12 to May 23". Power creates an iteration field value with the specified dates.
- **Scenario: Assign to iteration** — PM says "add issues #10, #11, #12 to Sprint-3". Power assigns the iteration field on those project items.
- **Scenario: View iteration** — PM asks "show Sprint-3 items". Power lists all items assigned to that iteration with their status.

---

### Story 5.3: Create Project Views
**As a** Project Manager  
**I want to** create filtered views of the project  
**So that** different stakeholders see relevant information

**Scenarios:**
- **Scenario: Board view** — PM says "create a board view grouped by status". Power creates a board-layout view.
- **Scenario: Table view** — PM says "create a table view showing priority and assignee". Power creates a table-layout view with specified fields.
- **Scenario: Filtered view** — PM says "create a view showing only high-priority items". Power creates a view with a priority filter.

---

### Story 5.4: Project Templates
**As a** Project Manager  
**I want to** create projects from templates  
**So that** new projects have consistent structure

**Scenarios:**
- **Scenario: AIDLC template** — PM says "create project from AIDLC template". Power creates a project with columns (Backlog, Todo, In Progress, Review, Done), labels (aidlc:inception, aidlc:construction), and standard custom fields (Priority, Phase, Story Points).
- **Scenario: Custom template** — PM defines a template structure. Power saves it and can recreate it for future projects.

---

### Story 5.5: Automated Workflows
**As a** Project Manager  
**I want** items to be automatically managed based on rules  
**So that** the board stays current without manual intervention

**Scenarios:**
- **Scenario: Auto-add new issues** — When a new issue is created in the repo, it's automatically added to the project in "Backlog".
- **Scenario: Auto-status on PR** — When a PR is opened for an issue, the issue moves to "Review". When merged, it moves to "Done".
- **Scenario: Auto-archive** — Items in "Done" for more than 7 days are automatically archived.

---

## Epic 6: Automation Hooks

### Story 6.1: Auto-Create Issues from AIDLC Specs
**As a** Developer  
**I want** issues to be automatically created from AIDLC user stories  
**So that** my project board is populated without manual work

**Scenarios:**
- **Scenario: Post-task hook fires** — After AIDLC User Stories stage completes, a hook triggers that reads `stories.md` and creates a GitHub issue for each story.
- **Scenario: Issue content** — Each created issue contains the story title, description, acceptance criteria, and is labeled with "aidlc:story".
- **Scenario: Board placement** — Created issues are automatically added to the project board in "Todo" column.

---

### Story 6.2: Auto-Update Board on Task Completion
**As a** Developer  
**I want** the project board to update automatically as AIDLC stages complete  
**So that** the board always reflects current progress

**Scenarios:**
- **Scenario: Code Generation starts** — When AIDLC begins Code Generation for a unit, the corresponding issue moves from "Todo" to "In Progress".
- **Scenario: Code Generation completes** — When code is generated, a comment is added to the issue noting completion.
- **Scenario: Build & Test completes** — When Build & Test passes, the issue moves to "Review" (awaiting PR review) or "Done" (if no PR needed).

---

### Story 6.3: PR Status Notifications
**As a** Team Lead  
**I want to** be notified about PR status changes  
**So that** I can take action on reviews promptly

**Scenarios:**
- **Scenario: User-triggered check** — TL clicks the "Check PR Status" hook button. Power queries all open PRs and reports which need review, which have failing checks, and which are ready to merge.
- **Scenario: Review requested** — When a review is requested from the TL, the notification appears in Kiro context.

---

### Story 6.4: Sync AIDLC State with Project Board
**As a** Developer  
**I want** the AIDLC workflow state to stay synchronized with the project board  
**So that** there's a single source of truth for project progress

**Scenarios:**
- **Scenario: Stage transition sync** — When AIDLC transitions between stages, all related issues on the board reflect the new stage status.
- **Scenario: Completion sync** — When AIDLC workflow completes, all issues created during the workflow are verified to be in "Done" or "Review" status.
- **Scenario: Read board state** — Before starting a new AIDLC stage, the Power reads the board to check for any blocked or stale items that might affect the workflow.

---

### Story 6.5: Auto-Create Issues from Specs on File Save
**As a** Developer  
**I want** issues to be created when spec files are finalized  
**So that** the board is populated as soon as planning is complete

**Scenarios:**
- **Scenario: Spec file detection** — When a file matching `aidlc-docs/inception/user-stories/stories.md` is created or edited, the hook offers to sync stories to GitHub issues.
- **Scenario: Incremental sync** — Only new stories (not already tracked as issues) are created. Existing issues are not duplicated.

---

## Story Summary

| Epic | Stories | Primary Persona |
|---|---|---|
| 1. Power Setup & Configuration | 4 stories | Developer |
| 2. Project Board Management | 6 stories | PM, Developer |
| 3. Issue Management | 5 stories | Developer, PM |
| 4. PR Workflow Automation | 6 stories | Developer, TL |
| 5. Advanced Project Features | 5 stories | PM |
| 6. Automation Hooks | 5 stories | Developer, TL |
| **Total** | **31 stories** | |

## INVEST Compliance

All stories have been validated against INVEST criteria:
- **Independent**: Each story can be implemented and delivered independently
- **Negotiable**: Scenarios describe outcomes, not implementation details
- **Valuable**: Each story delivers clear value to at least one persona
- **Estimable**: Scope is well-defined with clear acceptance scenarios
- **Small**: Each story is focused on a single capability
- **Testable**: Scenario-based acceptance criteria provide clear pass/fail conditions
