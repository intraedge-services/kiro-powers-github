# Requirements Clarification Questions

## Context

You want to create a Kiro Power for GitHub that wraps the official GitHub MCP Server (`github/github-mcp-server`) and adds project management capabilities — specifically managing GitHub Project boards and pushing tickets/issues to GitHub Projects. This replaces Jira-style task tracking with GitHub-native project management.

Please answer the following questions to help clarify the requirements. Fill in the letter choice after each `[Answer]:` tag.

---

## Question 1
What is the primary scope of the GitHub Power's project management capabilities?

A) Full project board management only (create projects, add/move items, manage columns/statuses, assign items)
B) Issue-to-project automation only (auto-create issues and add them to a project board based on AIDLC workflow stages)
C) Both full project board management AND automated issue-to-project workflows (comprehensive solution)
D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 2
How should the Power interact with the GitHub MCP Server?

A) Use the official remote GitHub MCP Server (hosted at `https://api.githubcopilot.com/mcp/`) — requires OAuth or PAT
B) Use the local Docker-based GitHub MCP Server (`docker run ghcr.io/github/github-mcp-server`) — self-hosted
C) Support both remote and local configurations, letting the user choose during setup
D) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 3
What authentication method should the Power support?

A) GitHub Personal Access Token (PAT) only — simplest setup
B) GitHub OAuth flow only — more secure, browser-based
C) Both PAT and OAuth — user chooses during configuration
D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 4
Which GitHub Project features should the Power manage?

A) Basic: Create issues, add to project, update status (Todo/In Progress/Done)
B) Standard: Basic + custom fields, labels, milestones, assignees, priority
C) Advanced: Standard + views, filters, iterations/sprints, automated workflows, project templates
D) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 5
How should the Power integrate with the AIDLC workflow specifically?

A) Automatically create GitHub Issues from AIDLC user stories and add them to a project board
B) Automatically create issues from AIDLC user stories AND update their status as AIDLC stages progress (e.g., move to "In Progress" during Code Generation, "Done" after Build & Test)
C) Full bidirectional sync — AIDLC reads project state AND writes back progress, including creating issues from stories, updating status, and linking PRs
D) No AIDLC integration — just provide general GitHub Project management tools
E) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 6
What steering workflows should the Power include?

A) Minimal: Just a POWER.md with basic usage instructions
B) Standard: POWER.md + steering files for project setup, issue management, and board management
C) Comprehensive: Standard + steering files for sprint planning, release management, team workflows, and AIDLC integration
D) Other (please describe after [Answer]: tag below)

[Answer]: B

---

## Question 7
Should the Power include Kiro Hooks for automation?

A) No hooks — manual interaction only
B) Basic hooks: Auto-update project board when files are edited or tasks complete
C) Advanced hooks: Auto-create issues from specs, update board on task completion, notify on PR status changes, sync AIDLC state with project board
D) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 8
What is the target GitHub Project structure for task tracking?

A) Single project board with columns: Backlog → Todo → In Progress → Review → Done
B) Multiple project boards per phase (Inception Board, Construction Board, Operations Board)
C) Single project board with custom fields for phase, stage, priority, and sprint
D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question 9
Should the Power handle Pull Request workflows as part of project management?

A) No — focus only on issues and project board
B) Yes — link PRs to issues, auto-move issues when PRs are opened/merged
C) Yes — full PR workflow including branch creation, PR creation from issues, code review requests, and auto-close issues on merge
D) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question 10
What level of GitHub Projects V2 API support is needed?

A) REST API only (simpler, limited project management features)
B) GraphQL API only (full Projects V2 support — required for custom fields, status updates, iterations)
C) Both REST and GraphQL — REST for issues/PRs, GraphQL for Projects V2 board management
D) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Question: Security Extensions
Should security extension rules be enforced for this project?

A) Yes — enforce all SECURITY rules as blocking constraints (recommended for production-grade applications)
B) No — skip all SECURITY rules (suitable for PoCs, prototypes, and experimental projects)
X) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Question: Property-Based Testing Extension
Should property-based testing (PBT) rules be enforced for this project?

A) Yes — enforce all PBT rules as blocking constraints (recommended for projects with business logic, data transformations, serialization, or stateful components)
B) Partial — enforce PBT rules only for pure functions and serialization round-trips (suitable for projects with limited algorithmic complexity)
C) No — skip all PBT rules (suitable for simple CRUD applications, UI-only projects, or thin integration layers with no significant business logic)
X) Other (please describe after [Answer]: tag below)

[Answer]: C

---
