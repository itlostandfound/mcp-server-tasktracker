import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskTrackerClient } from "../../src/client.js";
import { registerNoteTools } from "../../src/tools/notes.js";
import { createFakeServer } from "../testServer.js";

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("note tools", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let tools: ReturnType<typeof createFakeServer>["tools"];

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new TaskTrackerClient({ baseUrl: "http://localhost:8000", token: "t" });
    const fake = createFakeServer();
    registerNoteTools(fake.server, client);
    tools = fake.tools;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("list_notes nests under the task id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await tools.get("list_notes")!.handler({ task_id: "task-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/tasks/task-1/notes",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("create_note posts TipTap JSON content under the task path", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "note-1" }));
    const content = { type: "doc", content: [] };

    await tools.get("create_note")!.handler({ task_id: "task-1", content, title: "Status" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/tasks/task-1/notes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ content, title: "Status" }),
      }),
    );
  });

  it("update_note PATCHes /api/v1/notes/{id} directly, not nested under task", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "note-1" }));

    await tools.get("update_note")!.handler({ id: "note-1", title: "Renamed" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/notes/note-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ title: "Renamed" }) }),
    );
  });

  it("create_note converts a Markdown string content into a TipTap doc", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "note-1" }));

    await tools.get("create_note")!.handler({ task_id: "task-1", content: "hello **world**" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/tasks/task-1/notes",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
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
        }),
      }),
    );
  });

  it("update_note converts a Markdown string content into a TipTap doc", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "note-1" }));

    await tools.get("update_note")!.handler({ id: "note-1", content: "plain text" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/notes/note-1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "plain text" }] }] },
        }),
      }),
    );
  });

  it("delete_note calls DELETE on /api/v1/notes/{id}", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(204));

    await tools.get("delete_note")!.handler({ id: "note-1" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/notes/note-1",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
