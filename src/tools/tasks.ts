import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskTrackerClient } from "../client.js";
import { buildQuery, textResult } from "../toolHelpers.js";
import type { TaskResponse } from "../types.js";

export function registerTaskTools(server: McpServer, client: TaskTrackerClient): void {
  server.registerTool(
    "list_tasks",
    {
      title: "List tasks",
      description: "List tasks belonging to a tracker.",
      inputSchema: {
        tracker_id: z.string().describe("Tracker id"),
        include_completed: z.boolean().optional().describe("Include completed tasks (default true)"),
      },
    },
    async ({ tracker_id, include_completed }) => {
      const qs = buildQuery({ include_completed });
      const result = await client.get<{ data: TaskResponse[] }>(
        `/api/v1/trackers/${encodeURIComponent(tracker_id)}/tasks${qs}`,
      );
      return textResult(result.data);
    },
  );

  server.registerTool(
    "create_task",
    {
      title: "Create task",
      description: "Create a new task on a tracker.",
      inputSchema: {
        tracker_id: z.string().describe("Tracker id"),
        title: z.string().max(500).describe("Task title"),
        severity: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("Severity 1 (low) to 10 (high, default)"),
      },
    },
    async ({ tracker_id, ...body }) => {
      const result = await client.post<TaskResponse>(
        `/api/v1/trackers/${encodeURIComponent(tracker_id)}/tasks`,
        body,
      );
      return textResult(result);
    },
  );

  server.registerTool(
    "get_task",
    {
      title: "Get task",
      description: "Get a single task by id.",
      inputSchema: {
        id: z.string().describe("Task id"),
      },
    },
    async ({ id }) => {
      const result = await client.get<TaskResponse>(`/api/v1/tasks/${encodeURIComponent(id)}`);
      return textResult(result);
    },
  );

  server.registerTool(
    "update_task",
    {
      title: "Update task",
      description: "Update a task's title, completion state, sort order, or severity.",
      inputSchema: {
        id: z.string().describe("Task id"),
        title: z.string().max(500).optional(),
        is_completed: z.boolean().optional(),
        sort_order: z.number().int().optional(),
        severity: z.number().int().min(1).max(10).optional(),
      },
    },
    async ({ id, ...body }) => {
      const result = await client.patch<TaskResponse>(`/api/v1/tasks/${encodeURIComponent(id)}`, body);
      return textResult(result);
    },
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete task",
      description: "Delete a task and its notes. This cannot be undone.",
      inputSchema: {
        id: z.string().describe("Task id"),
      },
    },
    async ({ id }) => {
      await client.delete(`/api/v1/tasks/${encodeURIComponent(id)}`);
      return textResult(`Task ${id} deleted.`);
    },
  );
}
