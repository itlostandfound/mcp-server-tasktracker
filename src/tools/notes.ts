import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskTrackerClient } from "../client.js";
import { textResult } from "../toolHelpers.js";
import type { NoteResponse } from "../types.js";

const contentSchema = z
  .record(z.string(), z.unknown())
  .describe("Rich-text note content as a TipTap JSON document");

export function registerNoteTools(server: McpServer, client: TaskTrackerClient): void {
  server.registerTool(
    "list_notes",
    {
      title: "List notes",
      description: "List notes attached to a task.",
      inputSchema: {
        task_id: z.string().describe("Task id"),
      },
    },
    async ({ task_id }) => {
      const result = await client.get<{ data: NoteResponse[] }>(
        `/api/v1/tasks/${encodeURIComponent(task_id)}/notes`,
      );
      return textResult(result.data);
    },
  );

  server.registerTool(
    "create_note",
    {
      title: "Create note",
      description: "Create a rich-text note on a task.",
      inputSchema: {
        task_id: z.string().describe("Task id"),
        content: contentSchema,
        title: z.string().max(200).optional().describe("Optional note title"),
        note_date: z.string().optional().describe("Optional date (YYYY-MM-DD), defaults to today"),
      },
    },
    async ({ task_id, ...body }) => {
      const result = await client.post<NoteResponse>(
        `/api/v1/tasks/${encodeURIComponent(task_id)}/notes`,
        body,
      );
      return textResult(result);
    },
  );

  server.registerTool(
    "get_note",
    {
      title: "Get note",
      description: "Get a single note by id.",
      inputSchema: {
        id: z.string().describe("Note id"),
      },
    },
    async ({ id }) => {
      const result = await client.get<NoteResponse>(`/api/v1/notes/${encodeURIComponent(id)}`);
      return textResult(result);
    },
  );

  server.registerTool(
    "update_note",
    {
      title: "Update note",
      description: "Update a note's title, date, or content.",
      inputSchema: {
        id: z.string().describe("Note id"),
        title: z.string().max(200).optional(),
        note_date: z.string().optional().describe("Date (YYYY-MM-DD)"),
        content: contentSchema.optional(),
      },
    },
    async ({ id, ...body }) => {
      const result = await client.patch<NoteResponse>(`/api/v1/notes/${encodeURIComponent(id)}`, body);
      return textResult(result);
    },
  );

  server.registerTool(
    "delete_note",
    {
      title: "Delete note",
      description: "Delete a note. This cannot be undone.",
      inputSchema: {
        id: z.string().describe("Note id"),
      },
    },
    async ({ id }) => {
      await client.delete(`/api/v1/notes/${encodeURIComponent(id)}`);
      return textResult(`Note ${id} deleted.`);
    },
  );
}
