import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskTrackerClient, TaskTrackerError } from "../src/client.js";

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("TaskTrackerClient", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let client: TaskTrackerClient;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    client = new TaskTrackerClient({ baseUrl: "http://localhost:8000", token: "secret-token" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the Authorization header and JSON body on write requests", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "1" }));

    await client.post("/api/v1/trackers", { name: "Foo", client_type: "project" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/trackers",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer secret-token",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ name: "Foo", client_type: "project" }),
      }),
    );
  });

  it("strips trailing slashes from the base URL", async () => {
    const trailing = new TaskTrackerClient({ baseUrl: "http://localhost:8000/", token: "t" });
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await trailing.get("/api/v1/trackers");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/api/v1/trackers", expect.anything());
  });

  it("returns undefined for 204 No Content responses", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204));
    const result = await client.delete("/api/v1/trackers/1");
    expect(result).toBeUndefined();
  });

  it("returns parsed JSON on success", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [{ id: "1" }] }));
    const result = await client.get<{ data: unknown[] }>("/api/v1/trackers");
    expect(result).toEqual({ data: [{ id: "1" }] });
  });

  it("wraps network failures as a connection error naming the base URL", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    await expect(client.get("/api/v1/trackers")).rejects.toMatchObject({
      kind: "connection",
      message: expect.stringContaining("http://localhost:8000"),
    } satisfies Partial<TaskTrackerError>);
  });

  it("surfaces 401 as a clear auth error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { detail: "Invalid or missing API token" }));

    await expect(client.get("/api/v1/trackers")).rejects.toMatchObject({
      kind: "auth",
      status: 401,
      message: expect.stringContaining("Authentication failed"),
    });
  });

  it("surfaces 404 with the API's detail message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(404, { detail: "Tracker not found" }));

    await expect(client.get("/api/v1/trackers/missing")).rejects.toMatchObject({
      kind: "not_found",
      status: 404,
      message: "Tracker not found",
    });
  });

  it("surfaces 409 conflicts with the API's detail message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { detail: "Tracker with name 'Foo' already exists" }),
    );

    await expect(client.post("/api/v1/trackers", { name: "Foo" })).rejects.toMatchObject({
      kind: "conflict",
      status: 409,
    });
  });

  it("formats FastAPI/Pydantic validation error arrays into a readable message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, {
        detail: [{ loc: ["body", "severity"], msg: "Input should be less than or equal to 10" }],
      }),
    );

    await expect(client.post("/api/v1/trackers/1/tasks", { severity: 99 })).rejects.toMatchObject({
      kind: "validation",
      status: 422,
      message: expect.stringContaining("body.severity: Input should be less than or equal to 10"),
    });
  });

  it("surfaces unexpected status codes as an unknown-kind error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(500, { detail: "Internal Server Error" }));

    await expect(client.get("/api/v1/trackers")).rejects.toMatchObject({
      kind: "unknown",
      status: 500,
    });
  });

  it("surfaces a plain-text (non-JSON) error body instead of crashing on JSON.parse", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Internal Server Error", { status: 500, headers: { "Content-Type": "text/plain" } }),
    );

    await expect(client.get("/api/v1/trackers")).rejects.toMatchObject({
      kind: "unknown",
      status: 500,
      message: expect.stringContaining("Internal Server Error"),
    });
  });

  it("surfaces a non-JSON 2xx body as a clear error instead of returning undefined silently", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>not the API</html>", { status: 200, headers: { "Content-Type": "text/html" } }),
    );

    await expect(client.get("/api/v1/trackers")).rejects.toMatchObject({
      kind: "unknown",
      message: expect.stringContaining("TASKTRACKER_API_URL"),
    });
  });

  it("logs requests and responses to stderr when debug is enabled", async () => {
    const debugClient = new TaskTrackerClient({ baseUrl: "http://localhost:8000", token: "t", debug: true });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await debugClient.get("/api/v1/trackers");

    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
