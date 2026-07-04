# mcp-server-tasktracker

An MCP (Model Context Protocol) server for AI integration into [Task-Tracker](https://github.com/itlostandfound/Task-Tracker).

It exposes the full Task-Tracker REST API — trackers, tasks, notes, checklists, and projects (with steps and references) — as MCP tools, so any MCP-compatible AI agent (Claude Desktop, Claude Code, or others) can manage your Task-Tracker instance conversationally, with the same capabilities as the web dashboard.

This is a standalone companion project, not published to any package registry. Clone it, point it at your own running Task-Tracker instance, and wire it into your MCP client's configuration.

## Requirements

- Node.js 18+
- A running [Task-Tracker](https://github.com/itlostandfound/Task-Tracker) instance you can reach over HTTP
- That instance's `API_SECRET_TOKEN` (see Task-Tracker's own `.env` configuration)

## Install

```bash
git clone https://github.com/itlostandfound/mcp-server-tasktracker.git
cd mcp-server-tasktracker
npm install
npm run build
```

This produces a compiled server at `dist/index.js`.

## Configuration

The server reads its connection details from environment variables — set these in your MCP client's configuration, not in a committed file:

| Variable | Required | Description |
| --- | --- | --- |
| `TASKTRACKER_API_URL` | Yes | Base URL of your running Task-Tracker instance, e.g. `http://localhost:8000` |
| `TASKTRACKER_API_TOKEN` | Yes | The `API_SECRET_TOKEN` configured on your Task-Tracker backend |
| `DEBUG` | No | Set to `true` to log outgoing requests/responses to stderr |

The server fails fast at startup with a clear message if either required variable is missing.

## Using it with an MCP client

### Claude Desktop

Add an entry to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tasktracker": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-tasktracker/dist/index.js"],
      "env": {
        "TASKTRACKER_API_URL": "http://localhost:8000",
        "TASKTRACKER_API_TOKEN": "your-api-secret-token"
      }
    }
  }
}
```

### Claude Code

Add the same server to your project or user MCP configuration (`.mcp.json` or via `claude mcp add`):

```json
{
  "mcpServers": {
    "tasktracker": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server-tasktracker/dist/index.js"],
      "env": {
        "TASKTRACKER_API_URL": "http://localhost:8000",
        "TASKTRACKER_API_TOKEN": "your-api-secret-token"
      }
    }
  }
}
```

Any other MCP-compatible client should work the same way: spawn `node dist/index.js` with the two environment variables set.

## Tools

Every tool mirrors a Task-Tracker API endpoint 1:1 — no invented aggregate operations, no client-side validation duplicating what the API already does.

### Trackers

| Tool | Description |
| --- | --- |
| `list_trackers` | List all trackers with open task counts |
| `create_tracker` | Create a tracker (name must be unique) |
| `get_tracker` | Get a single tracker by id |
| `update_tracker` | Update a tracker's name/type |
| `delete_tracker` | Delete a tracker and its tasks/notes |

### Tasks

| Tool | Description |
| --- | --- |
| `list_tasks` | List tasks on a tracker |
| `create_task` | Create a task on a tracker |
| `get_task` | Get a single task by id |
| `update_task` | Update title, completion, sort order, severity |
| `delete_task` | Delete a task and its notes |

### Notes

| Tool | Description |
| --- | --- |
| `list_notes` | List notes on a task |
| `create_note` | Create a rich-text note on a task |
| `get_note` | Get a single note by id |
| `update_note` | Update a note's title, date, content |
| `delete_note` | Delete a note |

### Checklists

| Tool | Description |
| --- | --- |
| `list_checklists` | List checklists/templates, filterable by template/search |
| `create_checklist` | Create a checklist or reusable template |
| `get_checklist` | Get a checklist with its items and steps |
| `update_checklist` | Replace a checklist's name and/or items (full replace) |
| `delete_checklist` | Delete a checklist (undoable once) |
| `clone_checklist` | Clone a template into a new instance for a device list |
| `undo_checklist_delete` | Restore the most recently deleted checklist |

### Projects, Steps & References

| Tool | Description |
| --- | --- |
| `list_projects` | List projects, filterable by incomplete/search |
| `create_project` | Create a project |
| `get_project` | Get a project with all steps and references |
| `update_project` | Update a project's title |
| `delete_project` | Delete a project and its steps/references |
| `list_project_steps` | List a project's ordered steps |
| `add_project_step` | Add a step to the end of a project |
| `reorder_project_steps` | Reorder steps by full ordered id list |
| `update_project_step` | Update a step's title/rich-text content |
| `toggle_project_step_complete` | Toggle a step's completion state |
| `delete_project_step` | Delete a step and its references |
| `list_step_references` | List reference links on a step |
| `add_step_reference` | Add a reference link to a step |
| `update_step_reference` | Update a reference link |
| `delete_step_reference` | Delete a reference link |

## Error handling

- **Connection failures** (Task-Tracker unreachable): returned as a clear message naming the configured URL, not a stack trace.
- **Authentication failures** (401): returned as a message pointing at `TASKTRACKER_API_TOKEN`.
- **Validation errors**: the API's own FastAPI/Pydantic error details are passed through as-is.
- **Unexpected/non-JSON responses** (e.g. a reverse proxy error page instead of the API): surfaced as a clear message rather than crashing on an invalid-JSON parse.
- **Destructive operations** (deletes): exposed as plain tools with no extra confirmation step — the same trust model as calling the API directly. Only checklists support `undo_checklist_delete`; other deletes are permanent.

## Development

```bash
npm run dev         # run directly from source with tsx
npm run build        # compile to dist/
npm start            # run the compiled server (dist/index.js)
npm run typecheck    # type-check without emitting
npm test             # run the automated test suite (mocked HTTP, no live Task-Tracker needed)
```

## Compatibility

Built and tested against Task-Tracker v3.0.x's `/api/v1` REST API. Versioned independently of Task-Tracker itself, starting at `v1.0.0`.

## License

MIT — see [LICENSE](LICENSE).
