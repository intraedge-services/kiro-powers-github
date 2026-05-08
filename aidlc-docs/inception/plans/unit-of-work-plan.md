# Unit of Work Plan: Kiro Power for GitHub

## Plan Overview
Decompose the GitHub Kiro Power into independent units of work based on the application design. Each unit can be developed and tested independently.

---

## Clarifying Questions

### Question 1
How should the units be organized for development?

A) Sequential — build units in dependency order (Power config first, then server, then steering, then hooks)
B) Parallel — all units developed simultaneously with integration at the end
C) Core-first — build the custom MCP server first (core capability), then layer Power config, steering, and hooks on top
D) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 2
Should the custom MCP server be a single unit or split into sub-units?

A) Single unit — all 36 tools in one server package (simpler, one Dockerfile, one deployment)
B) Split by tool category — separate packages for projects, items, fields, etc. (more modular but more complex)
C) Split into core + extensions — core tools (projects, items, status) as one unit, advanced tools (views, workflows, analytics) as another
D) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 3
How should the Power configuration and steering files relate as units?

A) Single unit — POWER.md, mcp.json, and all steering files are one unit (they're all static config/docs)
B) Separate units — POWER.md + mcp.json as one unit, steering files as another (different concerns)
C) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## Unit Generation Steps

- [x] Step 1: Define unit boundaries based on answers
- [x] Step 2: Create unit-of-work.md with unit definitions
- [x] Step 3: Create unit-of-work-dependency.md with dependency matrix
- [x] Step 4: Create unit-of-work-story-map.md mapping stories to units
- [x] Step 5: Document code organization strategy
- [x] Step 6: Validate all stories are assigned to units
