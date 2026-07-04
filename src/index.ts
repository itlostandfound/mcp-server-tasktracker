#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TaskTrackerClient } from "./client.js";
import { registerTrackerTools } from "./tools/trackers.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerNoteTools } from "./tools/notes.js";
import { registerChecklistTools } from "./tools/checklists.js";
import { registerProjectTools } from "./tools/projects.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `[mcp-server-tasktracker] Missing required environment variable ${name}. ` +
        "Set it in your MCP client's server configuration.",
    );
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const baseUrl = requireEnv("TASKTRACKER_API_URL");
  const token = requireEnv("TASKTRACKER_API_TOKEN");
  const debug = process.env.DEBUG === "true";

  const client = new TaskTrackerClient({ baseUrl, token, debug });

  const server = new McpServer({
    name: "mcp-server-tasktracker",
    version: "1.0.0",
  });

  registerTrackerTools(server, client);
  registerTaskTools(server, client);
  registerNoteTools(server, client);
  registerChecklistTools(server, client);
  registerProjectTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(`[mcp-server-tasktracker] Connected. Talking to Task-Tracker at ${baseUrl}`);
}

main().catch((error) => {
  console.error("[mcp-server-tasktracker] Fatal error:", error);
  process.exit(1);
});
