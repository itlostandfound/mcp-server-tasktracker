import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskTrackerClient } from "../../src/client.js";
import { registerTrackerTools } from "../../src/tools/trackers.js";
import { createFakeServer, textOf } from "../testServer.js";

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("tracker tools", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let tools: ReturnType<typeof createFakeServer>["tools"];

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new TaskTrackerClient({ baseUrl: "http://localhost:8000", token: "t" });
    const fake = createFakeServer();
    registerTrackerTools(fake.server, client);
    tools = fake.tools;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers the full tracker CRUD surface", () => {
    expect([...tools.keys()]).toEqual([
      "list_trackers",
      "create_tracker",
      "get_tracker",
      "update_tracker",
      "delete_tracker",
    ]);
  });

  it("list_trackers calls GET /api/v1/trackers and returns the data array", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { data: [{ id: "1", name: "Home", client_type: "project" }] }),
    );

    const result = await tools.get("list_trackers")!.handler({});

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/trackers",
      expect.objectContaining({ method: "GET" }),
    );
    expect(textOf(result)).toContain("Home");
  });

  it("create_tracker posts the name and client_type", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "1", name: "Foo", client_type: "project" }));

    await tools.get("create_tracker")!.handler({ name: "Foo", client_type: "project" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/trackers",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "Foo", client_type: "project" }),
      }),
    );
  });

  it("get_tracker URL-encodes the id into the path", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "a b", name: "Foo" }));

    await tools.get("get_tracker")!.handler({ id: "a b" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/trackers/a%20b",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("update_tracker sends only the provided fields as the PATCH body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "1", name: "New Name" }));

    await tools.get("update_tracker")!.handler({ id: "1", name: "New Name" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/trackers/1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ name: "New Name" }) }),
    );
  });

  it("delete_tracker calls DELETE and confirms deletion in the result text", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    const result = await tools.get("delete_tracker")!.handler({ id: "1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/trackers/1",
      expect.objectContaining({ method: "DELETE" }),
    );
    expect(textOf(result)).toContain("deleted");
  });

  it("propagates a not_found error message when the tracker does not exist", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { detail: "Tracker not found" }));

    await expect(tools.get("get_tracker")!.handler({ id: "missing" })).rejects.toThrow("Tracker not found");
  });
});
