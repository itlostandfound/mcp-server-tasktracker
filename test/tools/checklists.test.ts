import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TaskTrackerClient } from "../../src/client.js";
import { registerChecklistTools } from "../../src/tools/checklists.js";
import { createFakeServer } from "../testServer.js";

function jsonResponse(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("checklist tools", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let tools: ReturnType<typeof createFakeServer>["tools"];

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new TaskTrackerClient({ baseUrl: "http://localhost:8000", token: "t" });
    const fake = createFakeServer();
    registerChecklistTools(fake.server, client);
    tools = fake.tools;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("list_checklists forwards is_template and search as query params", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { data: [] }));

    await tools.get("list_checklists")!.handler({ is_template: true, search: "phone" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/checklists?is_template=true&search=phone",
      expect.anything(),
    );
  });

  it("create_checklist posts nested items/steps as-is", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "cl-1" }));

    const items = [
      {
        id: "item-1",
        name: "Setup",
        order: 0,
        steps: [
          {
            id: "step-1",
            name: "Install",
            type: "command" as const,
            display_text: "Run installer",
            command: "brew install foo",
          },
        ],
      },
    ];

    await tools.get("create_checklist")!.handler({ name: "New Device", is_template: true, items });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/checklists",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ name: "New Device", is_template: true, items }),
      }),
    );
  });

  it("update_checklist issues a PUT (full replace), not a PATCH", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "cl-1" }));

    await tools.get("update_checklist")!.handler({ id: "cl-1", name: "Renamed" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/checklists/cl-1",
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ name: "Renamed" }) }),
    );
  });

  it("clone_checklist posts checklist_name and device_list to the /clone endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(201, { id: "cl-2" }));

    await tools.get("clone_checklist")!.handler({
      id: "template-1",
      checklist_name: "Office Rollout",
      device_list: ["laptop-1", "laptop-2"],
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/checklists/template-1/clone",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ checklist_name: "Office Rollout", device_list: ["laptop-1", "laptop-2"] }),
      }),
    );
  });

  it("undo_checklist_delete posts to the collection-level /undo endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { id: "cl-1" }));

    await tools.get("undo_checklist_delete")!.handler({});

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8000/api/v1/checklists/undo",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("surfaces a 400 validation error when cloning a non-template checklist", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { detail: "Can only clone templates, not instances" }),
    );

    await expect(
      tools.get("clone_checklist")!.handler({
        id: "instance-1",
        checklist_name: "X",
        device_list: ["a"],
      }),
    ).rejects.toThrow("Can only clone templates, not instances");
  });
});
