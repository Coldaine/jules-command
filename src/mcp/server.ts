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
    const fieldErrors = validation.error.issues.map((issue) => issue.path.join('.') || 'input').join(', ');
    return {
      ok: false,
      error: `Invalid input for ${name}: check fields [${fieldErrors}]`,
    };
  }

  try {
    const result = await tool.handler(validation.data, context);
    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Avoid leaking internal details — only pass through "not implemented" or generic messages
    const safeMessage = /not implemented/i.test(message)
      ? message
      : `Tool ${name} failed`;
    return {
      ok: false,
      error: safeMessage,
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
