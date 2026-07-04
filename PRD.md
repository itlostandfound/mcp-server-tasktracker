# MCP Server for Task-Tracker — Plan/PRD

## Purpose
A standalone MCP (Model Context Protocol) server that exposes the full Task-Tracker REST API as MCP tools, letting any MCP-compatible AI agent (Claude Desktop, Claude Code, or others) fully manage trackers, tasks, notes, checklists, and projects through natural language instead of the web dashboard.

## Problem Statement
Task-Tracker is a full-featured task/project/checklist manager with a REST API that is already "MCP-ready" (Bearer token auth, no baked-in secrets), but there is currently no way for an AI agent to interact with it. Every interaction requires the web dashboard or hand-written API calls. This project closes that gap for productivity: any AI agent should be able to do anything a human could do in the dashboard.

## Current State
No integration exists today. Users (and any AI agents assisting them) interact with Task-Tracker exclusively through its React web dashboard. The `mcp-server-tasktracker` repo currently contains only a placeholder README.

## Goals & Success Criteria
- Every resource and action exposed by the Task-Tracker API (`/api/v1/*`) has a corresponding MCP tool — full CRUD parity, not a curated subset.
- An MCP client (Claude Desktop, Claude Code, or any other MCP-compatible agent) can connect to the server via stdio and perform any dashboard-equivalent action purely through tool calls.
- Errors are legible to both the agent and the human operator (connection failures, auth failures, validation errors) rather than raw stack traces.
- The server ships with automated tests validating its behavior against the Task-Tracker API contract.
- A user with their own running Task-Tracker instance can clone the repo, configure two environment variables, and have it working with their MCP client in minutes.

## Process
1. **Bootstrap project**: TypeScript project scaffolding using the official `@modelcontextprotocol/sdk`, Node 18+, npm, compiling to `dist/`.
2. **Build a typed API client** wrapping Task-Tracker's `/api/v1` endpoints (Bearer auth header injection, base URL from env, JSON request/response typing based on the app's Pydantic schemas).
3. **Define MCP tools**, one per API capability (see Outputs below), each thinly wrapping a client call — no business logic duplicated from the backend.
4. **Wire up the MCP server** over stdio transport (`StdioServerTransport`), registering all tools and startup validation (e.g., confirming `TASKTRACKER_API_URL` / `TASKTRACKER_API_TOKEN` are set before accepting connections).
5. **Implement error normalization**: a thin layer that catches connection errors, 401s, and 4xx validation errors from the API client and rethrows/returns them as clear MCP tool-error messages.
6. **Add debug logging**: an opt-in `DEBUG` env var that logs outgoing requests/responses to stderr (stdout is reserved for MCP protocol traffic).
7. **Write automated tests**: mock the Task-Tracker HTTP API (e.g., via `msw` or `nock`) and assert each tool's request shape and response/error handling.
8. **Write the README**: install steps, env var reference, example MCP client config JSON (Claude Desktop and Claude Code formats), and a full table of exposed tools with descriptions.
9. **License and version**: MIT license (matching Task-Tracker), independent versioning starting at `v1.0.0`, with a README note stating which Task-Tracker API version it was built/tested against.

## Inputs
- **Environment variables** (set by the user in their MCP client config, not committed to the repo):
  - `TASKTRACKER_API_URL` — base URL of the user's running Task-Tracker instance (e.g. `http://localhost:8000`)
  - `TASKTRACKER_API_TOKEN` — the same `API_SECRET_TOKEN` configured on their Task-Tracker backend
  - `DEBUG` (optional) — `true` to enable verbose request/response logging to stderr
- **Trigger**: the MCP client (Claude Desktop, Claude Code, etc.) spawns the server process via stdio per its MCP server configuration.

## Outputs
An MCP server exposing the following tools (mirroring `Task-Tracker/README.md`'s API surface 1:1):

**Trackers**: `list_trackers`, `create_tracker`, `get_tracker` (nested tasks), `update_tracker`, `delete_tracker`

**Tasks**: `list_tasks`, `create_task`, `update_task`, `delete_task`

**Notes**: `list_notes`, `create_note`, `get_note`, `update_note`, `delete_note`

**Checklists**: `list_checklists` (filters: `is_template`, `search`), `create_checklist`, `get_checklist`, `update_checklist`, `delete_checklist`, `clone_checklist`, `undo_checklist_delete`

**Projects**: `list_projects` (filters: `incomplete`, `search`), `create_project`, `get_project` (nested steps/references), `update_project`, `delete_project`

**Project Steps**: `list_project_steps`, `add_project_step`, `reorder_project_steps`, `update_project_step`, `toggle_project_step_complete`, `delete_project_step`

**Step References**: `list_step_references`, `add_step_reference`, `update_step_reference`, `delete_step_reference`

Plus supporting deliverables: `package.json`/`tsconfig.json` scaffolding, compiled `dist/` output, automated test suite, README, LICENSE (MIT).

## Constraints & Guardrails
- **Language/runtime**: TypeScript on Node 18+, using the official `@modelcontextprotocol/sdk`. Transport is stdio only (no HTTP/SSE) — this is a locally-spawned process, not a hosted service.
- **Package manager**: npm, matching Task-Tracker's frontend convention.
- **No secrets in code**: all connection details come from environment variables supplied by the MCP client config, never hardcoded or committed.
- **No client-side validation duplication**: validation errors are passed through from the Task-Tracker API (Pydantic/FastAPI) as-is rather than re-implemented in the MCP layer.
- **No extra safety gating on destructive operations**: delete tools are exposed plainly with the same trust model as calling the API directly (note: only checklists currently support `undo` at the API level — this is not something the MCP server adds on top).
- **Distribution**: public GitHub repo only. Not published to npm, PyPI, or any MCP registry. Users clone and run it themselves alongside their own Task-Tracker instance.
- **Versioning**: independent of Task-Tracker's version numbering — starts at v1.0.0, with a compatibility note (e.g., "built against Task-Tracker API v1") in the README.
- **License**: MIT, matching Task-Tracker.

## Edge Cases & Failure Modes
- **Task-Tracker unreachable** (wrong URL, server down, network issue): tool calls fail with a clear message, e.g. `"Could not reach Task-Tracker at <url>: connection refused."` — not a raw stack trace.
- **Authentication failure** (missing/invalid token, API returns 401): surfaced as `"Authentication failed — check TASKTRACKER_API_TOKEN."`
- **Validation errors** (e.g., invalid severity level outside 1–10, missing required field): the API's existing Pydantic/FastAPI error detail is passed through unmodified.
- **Missing required env vars at startup**: the server should fail fast with a clear message identifying which variable is missing, rather than accepting connections and failing on first tool call.
- **Debug troubleshooting**: `DEBUG=true` logs outgoing requests/responses to stderr to help diagnose connection/config issues during setup, without polluting the stdout MCP protocol stream.

## Recommended Next Steps
1. Scaffold the TypeScript project (`package.json`, `tsconfig.json`, `@modelcontextprotocol/sdk` dependency, `dist/` build output) in `mcp-server-tasktracker`.
2. Build the typed Task-Tracker API client first (auth header injection, base URL config, typed request/response shapes) — this is the foundation every tool wraps.
3. Implement tools resource-by-resource in the order they'll be most useful to validate end-to-end: Trackers → Tasks → Notes → Checklists → Projects/Steps/References.
4. Stand up the automated test suite alongside each resource's tools (mock the HTTP layer) rather than as a final pass.
5. Manually verify against a real running Task-Tracker instance with Claude Desktop or Claude Code before writing the final README.
6. Write the README and tag `v1.0.0`.
