/**
 * MCP Server setup and tool routing.
 */

import type { Config } from '../config.js';
import type { Db } from '../db/index.js';
import { getToolDefinition, TOOL_DEFINITIONS } from './tools/index.js';

export interface CallToolResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

export async function validateAndCallTool(
  name: string,
  args: unknown,
  context: { config: Config; db: Db },
): Promise<CallToolResult> {
  const tool = getToolDefinition(name);
  if (!tool) {
    return { ok: false, error: `Unknown tool: ${name}` };
  }

  const validation = tool.zodSchema.safeParse(args ?? {});
  if (!validation.success) {
    return {
      ok: false,
      error: `Invalid input for ${name}: ${validation.error.issues.map((issue) => issue.message).join(', ')}`,
    };
  }

  try {
    const result = await tool.handler(validation.data, context);
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function createServer() {
  return {
    start: async () => {
      console.log(`Jules Command MCP Server — ${TOOL_DEFINITIONS.length} tools registered`);
    },
  };
}
