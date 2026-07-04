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

  it("list_projects forwards incomplete and search filters", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await tools.get("list_projects")!.handler({ incomplete: true, search: "launch" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/projects?incomplete=true&search=launch",
      expect.anything(),
    );
  });
});
