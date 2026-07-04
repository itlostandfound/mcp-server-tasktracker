import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskTrackerClient } from "../../src/client.js";
import { registerTaskTools } from "../../src/tools/tasks.js";
import { createFakeServer } from "../testServer.js";

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("task tools", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let tools: ReturnType<typeof createFakeServer>["tools"];

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new TaskTrackerClient({ baseUrl: "http://localhost:8000", token: "t" });
    const fake = createFakeServer();
    registerTaskTools(fake.server, client);
    tools = fake.tools;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("list_tasks nests under the tracker id and omits the query string when unset", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await tools.get("list_tasks")!.handler({ tracker_id: "tr-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/trackers/tr-1/tasks",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("list_tasks forwards include_completed as a query param", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await tools.get("list_tasks")!.handler({ tracker_id: "tr-1", include_completed: false });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/trackers/tr-1/tasks?include_completed=false",
      expect.anything(),
    );
  });

  it("create_task posts title and severity under the tracker path", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "1" }));

    await tools.get("create_task")!.handler({ tracker_id: "tr-1", title: "Ship it", severity: 8 });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/trackers/tr-1/tasks",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ title: "Ship it", severity: 8 }),
      }),
    );
  });

  it("update_task PATCHes only the fields given, keyed on task id not tracker id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "task-1" }));

    await tools.get("update_task")!.handler({ id: "task-1", is_completed: true });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/tasks/task-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ is_completed: true }) }),
    );
  });

  it("delete_task calls DELETE on /api/v1/tasks/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await tools.get("delete_task")!.handler({ id: "task-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/tasks/task-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
