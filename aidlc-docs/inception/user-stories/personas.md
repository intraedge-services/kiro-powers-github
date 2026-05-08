# User Personas: Kiro Power for GitHub

## Persona 1: Developer (Dev)

| Attribute | Description |
|---|---|
| **Name** | Alex — The Developer |
| **Role** | Software Developer / Engineer |
| **Goals** | Write code, manage branches, create PRs, track personal tasks on the board |
| **Frustrations** | Context switching between IDE and GitHub UI, manually updating board status, forgetting to link PRs to issues |
| **Technical Level** | High — comfortable with Git, CLI, APIs |
| **Interaction Pattern** | Uses Kiro chat to manage issues and PRs via natural language while coding |
| **Key Scenarios** | Creates issues from within IDE, moves items to "In Progress" when starting work, creates branches/PRs linked to issues, requests reviews |

---

## Persona 2: Project Manager (PM)

| Attribute | Description |
|---|---|
| **Name** | Jordan — The Project Manager |
| **Goals** | Oversee project progress, plan sprints/iterations, ensure work is tracked and visible |
| **Frustrations** | Lack of visibility into developer progress, manually triaging and organizing backlog, status meetings to get updates |
| **Technical Level** | Medium — understands GitHub basics, not deeply technical |
| **Interaction Pattern** | Uses Kiro to query board status, create and organize issues, plan iterations, generate reports |
| **Key Scenarios** | Creates project boards, organizes backlog, assigns work, checks iteration progress, creates views for stakeholder reporting |

---

## Persona 3: Team Lead (TL)

| Attribute | Description |
|---|---|
| **Name** | Sam — The Team Lead |
| **Goals** | Review code, ensure quality, coordinate team work, bridge between PM and developers |
| **Frustrations** | Tracking which PRs need review, ensuring issues move through the pipeline correctly, coordinating cross-developer dependencies |
| **Technical Level** | High — deep technical knowledge plus project awareness |
| **Interaction Pattern** | Uses Kiro to review PRs, check team progress, manage review assignments, ensure board reflects reality |
| **Key Scenarios** | Reviews PRs, assigns reviewers, checks board for blocked items, moves items to "Review", validates completion criteria before closing |

---

## Persona Interaction Map

```
+------------------+     Creates Issues      +------------------+
|                  |  ----------------------> |                  |
|   Project        |     Plans Iterations     |   Project Board  |
|   Manager (PM)   |  ----------------------> |   (GitHub        |
|                  |     Queries Status        |    Projects V2)  |
|                  |  <---------------------- |                  |
+------------------+                          +------------------+
                                                    ^    |
                                                    |    |
                              Moves Items           |    | Updates Status
                              Creates PRs           |    | Links PRs
                                                    |    v
+------------------+                          +------------------+
|                  |     Reviews PRs           |                  |
|   Team Lead      |  ----------------------> |   Developer      |
|   (TL)           |     Assigns Work          |   (Dev)          |
|                  |  <---------------------- |                  |
|                  |     Requests Review        |                  |
+------------------+                          +------------------+
```

## AIDLC Workflow Persona Context

During AIDLC workflow execution, the **Developer** persona is the primary actor:
- AIDLC creates issues from user stories → Developer sees them on the board
- AIDLC moves items to "In Progress" during Code Generation → Board reflects real-time progress
- AIDLC links PRs to issues → Team Lead can review, PM can track completion
- AIDLC moves items to "Done" after Build & Test → PM sees completed work without asking
