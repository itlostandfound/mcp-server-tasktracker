# mcp-server-tasktracker

An MCP (Model Context Protocol) server for AI integration into [Task-Tracker](https://github.com/itlostandfound/Task-Tracker).

It exposes the full Task-Tracker REST API — trackers, tasks, notes, checklists, and projects (with steps and references) — as MCP tools, so any MCP-compatible AI agent (Claude Desktop, Claude Code, or others) can manage your Task-Tracker instance conversationally, with the same capabilities as the web dashboard.

This server is designed to run **remotely** — one long-running instance (typically in Docker) that any number of MCP clients connect to over HTTP, each authenticating with their own Task-Tracker token. It does not run as a local subprocess of your MCP client.

## Requirements

- [Docker](https://docs.docker.com/get-docker/) (recommended) **or** Node.js 18+, to run the server itself somewhere reachable over HTTP
- A running [Task-Tracker](https://github.com/itlostandfound/Task-Tracker) instance the server can reach over HTTP
- A Task-Tracker `API_SECRET_TOKEN` for each person/client that will connect (see Task-Tracker's own `.env` configuration) — this token is supplied by each **client**, not configured on the server (see [Configuration](#configuration))

## Install

### Docker (recommended)

Pull the latest image from DockerHub and run it as a long-lived service:

```bash
docker pull itlostandfound/mcp-server-tasktracker:latest
docker run -d --name mcp-server-tasktracker \
  -p 3000:3000 \
  -e TASKTRACKER_API_URL=http://your-tasktracker-host:8000 \
  itlostandfound/mcp-server-tasktracker:latest
```

Note: if Task-Tracker runs on the *same* host as this container, `localhost` inside the container refers to the container itself, not the host. Use `http://host.docker.internal:8000` (Docker Desktop) or `--add-host=host.docker.internal:host-gateway` (Linux) instead.

#### Docker Compose

Copy `env.example.txt` to `.env` and fill in `TASKTRACKER_API_URL`, then:

```bash
docker compose up -d
```

This exposes the server on `3000:3000` directly. If you're putting it behind a domain with TLS via [Traefik](https://traefik.io/), use `compose.traefik.yml` instead (also set `MCP_DOMAIN` in `.env` to the bare hostname, and pre-create the external network with `docker network create traefik`):

```bash
docker compose -f compose.traefik.yml up -d
```

Once it's up, your MCP client connects to `https://<MCP_DOMAIN>/mcp` — don't forget the `/mcp` path, and don't put a scheme in `MCP_DOMAIN` itself (see [Configuration](#configuration)).

### From source

```bash
git clone https://github.com/itlostandfound/mcp-server-tasktracker.git
cd mcp-server-tasktracker
npm install
npm run build
TASKTRACKER_API_URL=http://localhost:8000 npm start
```

## Configuration

The server itself only needs to know where Task-Tracker lives — it holds no Task-Tracker credential of its own:

| Variable | Required | Description |
| --- | --- | --- |
| `TASKTRACKER_API_URL` | Yes | Base URL of the Task-Tracker instance this server talks to, e.g. `http://localhost:8000` |
| `PORT` | No | Port the HTTP server listens on. Defaults to `3000` |
| `DEBUG` | No | Set to `true` to log outgoing Task-Tracker requests/responses to stderr |
| `MCP_DOMAIN` | No | Public hostname this server is reachable at (bare hostname, no scheme), e.g. `mcp-tasktracker.example.com`. Required for any public/reverse-proxied deployment — without it the server only accepts requests with `Host: localhost`/`127.0.0.1`/`::1` and rejects everything else with `403`. Also drives the Traefik router rule in `compose.traefik.yml`. |

The server fails fast at startup with a clear message if `TASKTRACKER_API_URL` is missing.

**The URL your MCP client actually connects to is `https://<MCP_DOMAIN>/mcp` — the `/mcp` path is required.** `MCP_DOMAIN` itself must stay a bare hostname (no scheme, no path) because it's used both to build the Traefik router rule and, verbatim, as the value checked against the request's `Host` header — a scheme or path there will break routing/host validation, not the client URL. The client-facing URL where you add `/mcp` is a separate, unrelated string; see [Using it with an MCP client](#using-it-with-an-mcp-client) below.

**The Task-Tracker `API_SECRET_TOKEN` is supplied per-connection by each MCP client**, as a standard `Authorization: Bearer <token>` header on every request to `/mcp` — never as a server-side environment variable. The server uses whatever token arrives with a given request to talk to Task-Tracker on that caller's behalf, so different clients can be granted different Task-Tracker tokens/permissions without any server-side configuration change. A request with a missing or malformed `Authorization` header is rejected with `401` before any Task-Tracker call is made.

## Using it with an MCP client

The server exposes a single endpoint, `POST /mcp` (Streamable HTTP, stateless — no server-side sessions), at whatever host/port you deployed it to. Each client config points at that URL and supplies its own token via a header.

### Claude Code

Add to your project or user MCP configuration (`.mcp.json` or via `claude mcp add`):

```json
{
  "mcpServers": {
    "tasktracker": {
      "type": "http",
      "url": "https://your-server-host:3000/mcp",
      "headers": {
        "Authorization": "Bearer $TASKTRACKER_API_TOKEN"
      }
    }
  }
}
```

`$TASKTRACKER_API_TOKEN` is expanded from *your own* local environment when Claude Code starts — the token lives on your machine, not the server. Set it locally with `export TASKTRACKER_API_TOKEN=your-api-secret-token` (or hardcode the value directly in the `headers` block if you prefer).

> **Known client bug**: some Claude Code versions have shipped with bugs where configured `headers` aren't attached to Streamable HTTP requests (see [#48514](https://github.com/anthropics/claude-code/issues/48514), [#50464](https://github.com/anthropics/claude-code/issues/50464), [#59467](https://github.com/anthropics/claude-code/issues/59467)). If the server always responds `401`, confirm your Claude Code version actually sends the header before assuming this project is misconfigured.

### Claude Desktop

Claude Desktop's remote MCP support varies by version — consult Anthropic's current docs for how your version accepts a custom `Authorization` header for a `url`-type server entry, then use the same `url`/token pairing as above.

### Other MCP clients

Any client that supports the Streamable HTTP transport with custom headers works the same way: point it at `https://your-server-host:3000/mcp` and set `Authorization: Bearer <your-tasktracker-token>`.

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

### Rich-text content (notes & project steps)

`create_note`, `update_note`, `add_project_step`, and `update_project_step` all take a `content`
field. Task-Tracker stores this internally as a TipTap JSON document, but you don't need to
construct that by hand — pass a plain string of Markdown or plain text and it's converted
automatically:

```json
{ "content": "Goal: create the widget\n\n## Sub-tasks\n\n1. Create directory\n2. Init package.json" }
```

Supported Markdown: paragraphs, `#` headings, `**bold**`, `_italic_`, `` `inline code` ``,
`[links](url)`, bullet (`-`) and numbered (`1.`) lists, `>` blockquotes, fenced code blocks, and
hard line breaks. Constructs the converter doesn't understand (tables, images, raw HTML,
task-list checkboxes) are never silently dropped — they degrade to plain text so the content
survives, just not as their intended rich element.

If you need something the converter can't express exactly, you can still pass a raw TipTap JSON
document directly instead of a string — it's stored as-is.

For project steps, `content_text` (used for search) is derived automatically from `content` when
omitted, so you only need to write the text once. Pass `content_text` explicitly if you want the
search index to see different text than what's rendered.

## Error handling

- **Missing/malformed `Authorization` header**: rejected with HTTP `401` before any tool runs or any Task-Tracker call is made.
- **Connection failures** (Task-Tracker unreachable): returned as a clear message naming the configured URL, not a stack trace.
- **Authentication failures** (Task-Tracker rejects the supplied token): returned as a clear message, without echoing the token back.
- **Validation errors**: the API's own FastAPI/Pydantic error details are passed through as-is.
- **Unexpected/non-JSON responses** (e.g. a reverse proxy error page instead of the API): surfaced as a clear message rather than crashing on an invalid-JSON parse.
- **Destructive operations** (deletes): exposed as plain tools with no extra confirmation step — the same trust model as calling the API directly. Only checklists support `undo_checklist_delete`; other deletes are permanent.

## Development

```bash
TASKTRACKER_API_URL=http://localhost:8000 npm run dev   # run the HTTP server directly from source with tsx
npm run build        # compile to dist/
TASKTRACKER_API_URL=http://localhost:8000 npm start      # run the compiled server (dist/index.js)
npm run typecheck    # type-check without emitting
npm test             # run the automated test suite (mocked HTTP, no live Task-Tracker needed)
```

## Compatibility

Built and tested against Task-Tracker v3.0.x's `/api/v1` REST API. Versioned independently of Task-Tracker itself, starting at `v1.0.0`.

## License

MIT — see [LICENSE](LICENSE).
