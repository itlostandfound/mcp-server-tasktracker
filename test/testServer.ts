import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type Handler = (args: any, extra?: any) => any;

export interface CapturedTool {
  config: Record<string, unknown>;
  handler: Handler;
}

/**
 * Minimal stand-in for McpServer that only implements registerTool, so tool
 * modules can be exercised directly without spinning up a real MCP transport.
 */
export function createFakeServer(): { server: McpServer; tools: Map<string, CapturedTool> } {
  const tools = new Map<string, CapturedTool>();
  const server = {
    registerTool: (name: string, config: Record<string, unknown>, handler: Handler) => {
      tools.set(name, { config, handler });
      return { name };
    },
  } as unknown as McpServer;
  return { server, tools };
}

export function textOf(result: { content: { type: string; text: string }[] }): string {
  return result.content.map((c) => c.text).join("\n");
}
