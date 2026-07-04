import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskTrackerClient } from "../client.js";
import { buildQuery, textResult } from "../toolHelpers.js";
import type { ChecklistResponse } from "../types.js";

const checklistStepSchema = z.object({
  id: z.string().describe("Client-generated id for this step (e.g. a UUID)"),
  name: z.string().max(500),
  type: z.enum(["text", "command"]),
  is_completed: z.boolean().optional(),
  completed_at: z.string().nullable().optional(),
  command: z.string().nullable().optional().describe("Shell command, when type is 'command'"),
  display_text: z.string().max(500).describe("Label shown for this step"),
  instruction_text: z.string().nullable().optional(),
  hide_command: z.boolean().optional().describe("Hide the raw command in the UI"),
  order: z.number().int().optional(),
});

const checklistItemSchema = z.object({
  id: z.string().describe("Client-generated id for this item (e.g. a UUID)"),
  name: z.string().max(255),
  order: z.number().int().optional(),
  steps: z.array(checklistStepSchema).optional(),
});

export function registerChecklistTools(server: McpServer, client: TaskTrackerClient): void {
  server.registerTool(
    "list_checklists",
    {
      title: "List checklists",
      description: "List checklists and templates, optionally filtered.",
      inputSchema: {
        is_template: z.boolean().optional().describe("Only return templates (true) or non-template instances (false)"),
        search: z.string().optional().describe("Full-text search on checklist name"),
        skip: z.number().int().optional(),
        limit: z.number().int().optional(),
      },
    },
    async ({ is_template, search, skip, limit }) => {
      const qs = buildQuery({ is_template, search, skip, limit });
      const result = await client.get<{ data: ChecklistResponse[] }>(`/api/v1/checklists${qs}`);
      return textResult(result.data);
    },
  );

  server.registerTool(
    "create_checklist",
    {
      title: "Create checklist",
      description: "Create a new checklist or a reusable template, optionally with initial items/steps.",
      inputSchema: {
        name: z.string().max(255),
        is_template: z.boolean().optional().describe("Create as a reusable template (default false)"),
        items: z.array(checklistItemSchema).optional(),
      },
    },
    async (body) => {
      const result = await client.post<ChecklistResponse>("/api/v1/checklists", body);
      return textResult(result);
    },
  );

  server.registerTool(
    "get_checklist",
    {
      title: "Get checklist",
      description: "Get a single checklist or template by id, with its items and steps.",
      inputSchema: {
        id: z.string().describe("Checklist id"),
      },
    },
    async ({ id }) => {
      const result = await client.get<ChecklistResponse>(`/api/v1/checklists/${encodeURIComponent(id)}`);
      return textResult(result);
    },
  );

  server.registerTool(
    "update_checklist",
    {
      title: "Update checklist",
      description: "Replace a checklist's name and/or its full items/steps list (full replace, not a patch).",
      inputSchema: {
        id: z.string().describe("Checklist id"),
        name: z.string().max(255).optional(),
        items: z.array(checklistItemSchema).optional(),
      },
    },
    async ({ id, ...body }) => {
      const result = await client.put<ChecklistResponse>(`/api/v1/checklists/${encodeURIComponent(id)}`, body);
      return textResult(result);
    },
  );

  server.registerTool(
    "delete_checklist",
    {
      title: "Delete checklist",
      description: "Delete a checklist or template. A single subsequent undo_checklist_delete call can restore it.",
      inputSchema: {
        id: z.string().describe("Checklist id"),
      },
    },
    async ({ id }) => {
      await client.delete(`/api/v1/checklists/${encodeURIComponent(id)}`);
      return textResult(`Checklist ${id} deleted. Call undo_checklist_delete to restore it if needed.`);
    },
  );

  server.registerTool(
    "clone_checklist",
    {
      title: "Clone checklist template",
      description: "Clone a template checklist into a new checklist instance for a list of devices/targets.",
      inputSchema: {
        id: z.string().describe("Template checklist id (must be a template)"),
        checklist_name: z.string().max(255).describe("Name for the cloned checklist"),
        device_list: z.array(z.string()).min(1).describe("Devices/targets this checklist instance applies to"),
      },
    },
    async ({ id, ...body }) => {
      const result = await client.post<ChecklistResponse>(
        `/api/v1/checklists/${encodeURIComponent(id)}/clone`,
        body,
      );
      return textResult(result);
    },
  );

  server.registerTool(
    "undo_checklist_delete",
    {
      title: "Undo last checklist deletion",
      description: "Restore the most recently deleted checklist. Fails if there is nothing to undo.",
      inputSchema: {},
    },
    async () => {
      const result = await client.post<ChecklistResponse>("/api/v1/checklists/undo");
      return textResult(result);
    },
  );
}
