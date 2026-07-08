#!/usr/bin/env node
import type { Request, Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { TaskTrackerClient } from "./client.js";
import { registerTrackerTools } from "./tools/trackers.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerNoteTools } from "./tools/notes.js";
import { registerChecklistTools } from "./tools/checklists.js";
import { registerProjectTools } from "./tools/projects.js";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(
      `[mcp-server-tasktracker] Missing required environment variable ${name}.`,
    );
    process.exit(1);
  }
  return value;
}

function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return undefined;
  return token;
}

function buildServer(baseUrl: string, token: string, debug: boolean): McpServer {
  const client = new TaskTrackerClient({ baseUrl, token, debug });

  const server = new McpServer({
    name: "mcp-server-tasktracker",
    version: "1.0.0",
  });

  registerTrackerTools(server, client);
  registerTaskTools(server, client);
  registerNoteTools(server, client);
  registerChecklistTools(server, client);
  registerProjectTools(server, client);

  return server;
}

function main(): void {
  const baseUrl = requireEnv("TASKTRACKER_API_URL");
  const debug = process.env.DEBUG === "true";
  const port = Number(process.env.PORT ?? 3000);

  const app = createMcpExpressApp();

  app.post("/mcp", async (req: Request, res: Response) => {
    const token = extractBearerToken(req);
    if (!token) {
      res.status(401).json({
        error: "Missing or malformed Authorization header — expected 'Bearer <TASKTRACKER_API_TOKEN>'.",
      });
      return;
    }

    try {
      const server = buildServer(baseUrl, token, debug);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });

      res.on("close", () => {
        transport.close();
        server.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("[mcp-server-tasktracker] Error handling request:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error." });
      }
    }
  });

  app.get("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({ error: "Method not allowed — this server does not support server-initiated streams." });
  });

  app.delete("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({ error: "Method not allowed — this server does not track sessions." });
  });

  app.listen(port, () => {
    console.error(
      `[mcp-server-tasktracker] Listening on port ${port}. Talking to Task-Tracker at ${baseUrl}`,
    );
  });
}

main();
