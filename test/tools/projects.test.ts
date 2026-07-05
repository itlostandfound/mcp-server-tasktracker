import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskTrackerClient } from "../../src/client.js";
import { registerProjectTools } from "../../src/tools/projects.js";
import { createFakeServer } from "../testServer.js";

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("project tools", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let tools: ReturnType<typeof createFakeServer>["tools"];

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new TaskTrackerClient({ baseUrl: "http://localhost:8000", token: "t" });
    const fake = createFakeServer();
    registerProjectTools(fake.server, client);
    tools = fake.tools;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers the full project/step/reference surface", () => {
    expect([...tools.keys()]).toEqual([
      "list_projects",
      "create_project",
      "get_project",
      "update_project",
      "delete_project",
      "list_project_steps",
      "add_project_step",
      "reorder_project_steps",
      "update_project_step",
      "toggle_project_step_complete",
      "delete_project_step",
      "list_step_references",
      "add_step_reference",
      "update_step_reference",
      "delete_step_reference",
    ]);
  });

  it("reorder_project_steps PATCHes the nested /steps/reorder path with step_ids", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, []));

    await tools.get("reorder_project_steps")!.handler({ id: "proj-1", step_ids: ["s2", "s1"] });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/projects/proj-1/steps/reorder",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ step_ids: ["s2", "s1"] }) }),
    );
  });

  it("toggle_project_step_complete PATCHes the /complete sub-path with no body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "step-1", is_completed: true }));

    await tools.get("toggle_project_step_complete")!.handler({ id: "proj-1", step_id: "step-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/projects/proj-1/steps/step-1/complete",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("add_project_step accepts content at creation time and converts Markdown to a TipTap doc", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "step-1" }));

    await tools.get("add_project_step")!.handler({
      id: "proj-1",
      title: "Set up repo",
      content: "hello **world**",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/projects/proj-1/steps",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          title: "Set up repo",
          content: {
            type: "doc",
            content: [
              {
                type: "paragraph",
                content: [
                  { type: "text", text: "hello " },
                  { type: "text", text: "world", marks: [{ type: "bold" }] },
                ],
              },
            ],
          },
          content_text: "hello world",
        }),
      }),
    );
  });

  it("add_project_step respects an explicit content_text instead of deriving it", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "step-1" }));

    await tools.get("add_project_step")!.handler({
      id: "proj-1",
      title: "Set up repo",
      content: "hello **world**",
      content_text: "custom search text",
    });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string).content_text).toBe("custom search text");
  });

  it("add_project_step omits content entirely when not provided", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "step-1" }));

    await tools.get("add_project_step")!.handler({ id: "proj-1", title: "Set up repo" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/projects/proj-1/steps",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ title: "Set up repo" }) }),
    );
  });

  it("add_step_reference nests project id and step id into the references path", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "ref-1" }));

    await tools.get("add_step_reference")!.handler({
      id: "proj-1",
      step_id: "step-1",
      title: "Docs",
      url: "https://example.com",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/projects/proj-1/steps/step-1/references",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Docs", url: "https://example.com" }),
      }),
    );
  });

  it("delete_step_reference DELETEs the fully-nested reference path", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await tools.get("delete_step_reference")!.handler({ id: "proj-1", step_id: "step-1", ref_id: "ref-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/projects/proj-1/steps/step-1/references/ref-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });

  it("update_project_step converts a Markdown string content into a TipTap doc", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "step-1" }));

    await tools.get("update_project_step")!.handler({
      id: "proj-1",
      step_id: "step-1",
      content: "## Sub-tasks\n\n1. Create directory",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/projects/proj-1/steps/step-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          content: {
            type: "doc",
            content: [
              { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Sub-tasks" }] },
              {
                type: "orderedList",
                content: [
                  {
                    type: "listItem",
                    content: [{ type: "paragraph", content: [{ type: "text", text: "Create directory" }] }],
                  },
                ],
              },
            ],
          },
          content_text: "Sub-tasks\nCreate directory",
        }),
      }),
    );
  });

  it("update_project_step leaves content untouched when omitted", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "step-1" }));

    await tools.get("update_project_step")!.handler({ id: "proj-1", step_id: "step-1", title: "Renamed" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/projects/proj-1/steps/step-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: "Renamed" }) }),
    );
  });

  it("list_projects forwards incomplete and search filters", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await tools.get("list_projects")!.handler({ incomplete: true, search: "launch" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/projects?incomplete=true&search=launch",
      expect.anything(),
    );
  });
});
