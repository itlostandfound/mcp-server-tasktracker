import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskTrackerClient } from "../client.js";
import { textResult } from "../toolHelpers.js";
import type { TrackerResponse } from "../types.js";

export function registerTrackerTools(server: McpServer, client: TaskTrackerClient): void {
  server.registerTool(
    "list_trackers",
    {
      title: "List trackers",
      description: "List all trackers (projects, efforts, initiatives), each with its open task count.",
      inputSchema: {},
    },
    async () => {
      const result = await client.get<{ data: TrackerResponse[] }>("/api/v1/trackers");
      return textResult(result.data);
    },
  );

  server.registerTool(
    "create_tracker",
    {
      title: "Create tracker",
      description: "Create a new tracker (project, effort, or initiative). Tracker names must be unique.",
      inputSchema: {
        name: z.string().describe("Unique display name for the tracker"),
        client_type: z.string().describe("Free-form label for what kind of tracker this is (e.g. 'project', 'effort', 'initiative')"),
      },
    },
    async ({ name, client_type }) => {
      const result = await client.post<TrackerResponse>("/api/v1/trackers", { name, client_type });
      return textResult(result);
    },
  );

  server.registerTool(
    "get_tracker",
    {
      title: "Get tracker",
      description: "Get a single tracker by id.",
      inputSchema: {
        id: z.string().describe("Tracker id"),
      },
    },
    async ({ id }) => {
      const result = await client.get<TrackerResponse>(`/api/v1/trackers/${encodeURIComponent(id)}`);
      return textResult(result);
    },
  );

  server.registerTool(
    "update_tracker",
    {
      title: "Update tracker",
      description: "Update a tracker's name and/or type.",
      inputSchema: {
        id: z.string().describe("Tracker id"),
        name: z.string().optional().describe("New unique name"),
        client_type: z.string().optional().describe("New type label"),
      },
    },
    async ({ id, ...body }) => {
      const result = await client.patch<TrackerResponse>(`/api/v1/trackers/${encodeURIComponent(id)}`, body);
      return textResult(result);
    },
  );

  server.registerTool(
    "delete_tracker",
    {
      title: "Delete tracker",
      description: "Delete a tracker and all of its tasks/notes. This cannot be undone.",
      inputSchema: {
        id: z.string().describe("Tracker id"),
      },
    },
    async ({ id }) => {
      await client.delete(`/api/v1/trackers/${encodeURIComponent(id)}`);
      return textResult(`Tracker ${id} deleted.`);
    },
  );
}
