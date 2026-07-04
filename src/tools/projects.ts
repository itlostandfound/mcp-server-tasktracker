import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskTrackerClient } from "../client.js";
import { buildQuery, textResult } from "../toolHelpers.js";
import type {
  ProjectResponse,
  ProjectStepReferenceResponse,
  ProjectStepResponse,
} from "../types.js";

const contentSchema = z
  .record(z.string(), z.unknown())
  .describe("Rich-text step content as a TipTap JSON document");

export function registerProjectTools(server: McpServer, client: TaskTrackerClient): void {
  // ── Projects ──────────────────────────────────────────────────────────────

  server.registerTool(
    "list_projects",
    {
      title: "List projects",
      description: "List projects, optionally filtered to incomplete ones or by search term.",
      inputSchema: {
        incomplete: z.boolean().optional().describe("Only return projects with incomplete steps"),
        search: z.string().optional().describe("Full-text search on project title"),
        skip: z.number().int().optional(),
        limit: z.number().int().optional(),
      },
    },
    async ({ incomplete, search, skip, limit }) => {
      const qs = buildQuery({ incomplete, search, skip, limit });
      const result = await client.get<{ data: ProjectResponse[] }>(`/api/v1/projects${qs}`);
      return textResult(result.data);
    },
  );

  server.registerTool(
    "create_project",
    {
      title: "Create project",
      description: "Create a new project.",
      inputSchema: {
        title: z.string().max(255),
      },
    },
    async (body) => {
      const result = await client.post<ProjectResponse>("/api/v1/projects", body);
      return textResult(result);
    },
  );

  server.registerTool(
    "get_project",
    {
      title: "Get project",
      description: "Get a single project by id, including all of its steps and their references.",
      inputSchema: {
        id: z.string().describe("Project id"),
      },
    },
    async ({ id }) => {
      const result = await client.get<ProjectResponse>(`/api/v1/projects/${encodeURIComponent(id)}`);
      return textResult(result);
    },
  );

  server.registerTool(
    "update_project",
    {
      title: "Update project",
      description: "Update a project's title.",
      inputSchema: {
        id: z.string().describe("Project id"),
        title: z.string().max(255).optional(),
      },
    },
    async ({ id, ...body }) => {
      const result = await client.patch<ProjectResponse>(`/api/v1/projects/${encodeURIComponent(id)}`, body);
      return textResult(result);
    },
  );

  server.registerTool(
    "delete_project",
    {
      title: "Delete project",
      description: "Delete a project and all of its steps/references. This cannot be undone.",
      inputSchema: {
        id: z.string().describe("Project id"),
      },
    },
    async ({ id }) => {
      await client.delete(`/api/v1/projects/${encodeURIComponent(id)}`);
      return textResult(`Project ${id} deleted.`);
    },
  );

  // ── Steps ─────────────────────────────────────────────────────────────────

  server.registerTool(
    "list_project_steps",
    {
      title: "List project steps",
      description: "List the ordered steps for a project.",
      inputSchema: {
        id: z.string().describe("Project id"),
      },
    },
    async ({ id }) => {
      const result = await client.get<ProjectStepResponse[]>(
        `/api/v1/projects/${encodeURIComponent(id)}/steps`,
      );
      return textResult(result);
    },
  );

  server.registerTool(
    "add_project_step",
    {
      title: "Add project step",
      description: "Add a new step to the end of a project.",
      inputSchema: {
        id: z.string().describe("Project id"),
        title: z.string().max(500),
      },
    },
    async ({ id, ...body }) => {
      const result = await client.post<ProjectStepResponse>(
        `/api/v1/projects/${encodeURIComponent(id)}/steps`,
        body,
      );
      return textResult(result);
    },
  );

  server.registerTool(
    "reorder_project_steps",
    {
      title: "Reorder project steps",
      description: "Reorder a project's steps by providing the full list of step ids in the desired order.",
      inputSchema: {
        id: z.string().describe("Project id"),
        step_ids: z.array(z.string()).min(1).describe("All step ids for this project, in the new order"),
      },
    },
    async ({ id, step_ids }) => {
      const result = await client.request<ProjectStepResponse[]>(
        "PATCH",
        `/api/v1/projects/${encodeURIComponent(id)}/steps/reorder`,
        { step_ids },
      );
      return textResult(result);
    },
  );

  server.registerTool(
    "update_project_step",
    {
      title: "Update project step",
      description: "Update a project step's title or rich-text content.",
      inputSchema: {
        id: z.string().describe("Project id"),
        step_id: z.string().describe("Step id"),
        title: z.string().max(500).optional(),
        content: contentSchema.optional(),
        content_text: z.string().optional().describe("Plain-text mirror of content, used for search"),
      },
    },
    async ({ id, step_id, ...body }) => {
      const result = await client.patch<ProjectStepResponse>(
        `/api/v1/projects/${encodeURIComponent(id)}/steps/${encodeURIComponent(step_id)}`,
        body,
      );
      return textResult(result);
    },
  );

  server.registerTool(
    "toggle_project_step_complete",
    {
      title: "Toggle project step completion",
      description: "Toggle a project step's completed state.",
      inputSchema: {
        id: z.string().describe("Project id"),
        step_id: z.string().describe("Step id"),
      },
    },
    async ({ id, step_id }) => {
      const result = await client.patch<ProjectStepResponse>(
        `/api/v1/projects/${encodeURIComponent(id)}/steps/${encodeURIComponent(step_id)}/complete`,
      );
      return textResult(result);
    },
  );

  server.registerTool(
    "delete_project_step",
    {
      title: "Delete project step",
      description: "Delete a step (and its references) from a project. This cannot be undone.",
      inputSchema: {
        id: z.string().describe("Project id"),
        step_id: z.string().describe("Step id"),
      },
    },
    async ({ id, step_id }) => {
      await client.delete(
        `/api/v1/projects/${encodeURIComponent(id)}/steps/${encodeURIComponent(step_id)}`,
      );
      return textResult(`Step ${step_id} deleted from project ${id}.`);
    },
  );

  // ── References ────────────────────────────────────────────────────────────

  server.registerTool(
    "list_step_references",
    {
      title: "List step references",
      description: "List reference links attached to a project step.",
      inputSchema: {
        id: z.string().describe("Project id"),
        step_id: z.string().describe("Step id"),
      },
    },
    async ({ id, step_id }) => {
      const result = await client.get<ProjectStepReferenceResponse[]>(
        `/api/v1/projects/${encodeURIComponent(id)}/steps/${encodeURIComponent(step_id)}/references`,
      );
      return textResult(result);
    },
  );

  server.registerTool(
    "add_step_reference",
    {
      title: "Add step reference",
      description: "Add a reference link (title, url, description) to a project step.",
      inputSchema: {
        id: z.string().describe("Project id"),
        step_id: z.string().describe("Step id"),
        title: z.string().max(255),
        url: z.string().describe("Reference URL"),
        description: z.string().optional(),
      },
    },
    async ({ id, step_id, ...body }) => {
      const result = await client.post<ProjectStepReferenceResponse>(
        `/api/v1/projects/${encodeURIComponent(id)}/steps/${encodeURIComponent(step_id)}/references`,
        body,
      );
      return textResult(result);
    },
  );

  server.registerTool(
    "update_step_reference",
    {
      title: "Update step reference",
      description: "Update a reference link's title, url, or description.",
      inputSchema: {
        id: z.string().describe("Project id"),
        step_id: z.string().describe("Step id"),
        ref_id: z.string().describe("Reference id"),
        title: z.string().max(255).optional(),
        url: z.string().optional(),
        description: z.string().optional(),
      },
    },
    async ({ id, step_id, ref_id, ...body }) => {
      const result = await client.patch<ProjectStepReferenceResponse>(
        `/api/v1/projects/${encodeURIComponent(id)}/steps/${encodeURIComponent(step_id)}/references/${encodeURIComponent(ref_id)}`,
        body,
      );
      return textResult(result);
    },
  );

  server.registerTool(
    "delete_step_reference",
    {
      title: "Delete step reference",
      description: "Delete a reference link from a project step. This cannot be undone.",
      inputSchema: {
        id: z.string().describe("Project id"),
        step_id: z.string().describe("Step id"),
        ref_id: z.string().describe("Reference id"),
      },
    },
    async ({ id, step_id, ref_id }) => {
      await client.delete(
        `/api/v1/projects/${encodeURIComponent(id)}/steps/${encodeURIComponent(step_id)}/references/${encodeURIComponent(ref_id)}`,
      );
      return textResult(`Reference ${ref_id} deleted from step ${step_id}.`);
    },
  );
}
