import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskTrackerClient } from "../client.js";
import { textResult } from "../toolHelpers.js";
import { toTipTapDoc } from "../richText.js";
import type { NoteResponse } from "../types.js";

const contentSchema = z
  .union([z.string(), z.record(z.string(), z.unknown())])
  .describe(
    "Note content. Pass a plain string of Markdown or plain text (recommended) and it is converted " +
      "to the underlying TipTap rich-text format automatically. Supported Markdown: paragraphs, " +
      "# headings, **bold**, _italic_, `inline code`, [links](url), bullet (-) and numbered (1.) lists, " +
      "> blockquotes, ``` fenced code blocks ```, and hard line breaks. Unsupported constructs (tables, " +
      "images, raw HTML, task-list checkboxes) are not dropped — they degrade to plain text so nothing " +
      "is silently lost, but they won't render as their intended rich element. " +
      'Example: "Met with the vendor.\\n\\n- Discussed pricing\\n- Follow up next week". ' +
      "Alternatively, pass a raw TipTap JSON document directly, e.g. " +
      '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Met with the vendor."}]}]} ' +
      "— useful for content the Markdown converter can't express exactly.",
  );

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
    async ({ task_id, content, ...body }) => {
      const result = await client.post<NoteResponse>(
        `/api/v1/tasks/${encodeURIComponent(task_id)}/notes`,
        { content: toTipTapDoc(content), ...body },
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
    async ({ id, content, ...body }) => {
      const result = await client.patch<NoteResponse>(`/api/v1/notes/${encodeURIComponent(id)}`, {
        ...body,
        ...(content !== undefined ? { content: toTipTapDoc(content) } : {}),
      });
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
