/**
 * MCP Server setup and tool routing.
 */

import type { Config } from '../config.js';
import type { Db } from '../db/index.js';
import { JulesService } from '../services/jules.service.js';
import { GitHubService } from '../services/github.service.js';
import { DashboardService } from '../services/dashboard.js';
import { PollManager } from '../services/poll-manager.js';
import { getToolDefinition, TOOL_DEFINITIONS, type ToolContext } from './tools/index.js';

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

  // Initialize services for the handler
  const jules = new JulesService(context.config, context.db);
  const github = new GitHubService(context.config, context.db);
  const dashboard = new DashboardService(context.db, context.config);
  const pollManager = new PollManager(jules, github, context.config, context.db);

  const toolContext: ToolContext = {
    ...context,
    services: {
      jules,
      github,
      dashboard,
      pollManager,
      // The following are currently internal to services but could be exposed if needed
      stallDetector: (pollManager as any).stallDetector,
      complexityScorer: (github as any).complexityScorer,
      autoMergeEvaluator: (github as any).autoMergeEvaluator,
    },
  };

  const validation = tool.zodSchema.safeParse(args ?? {});
  if (!validation.success) {
    const fieldErrors = validation.error.issues.map((issue) => issue.path.join('.') || 'input').join(', ');
    return {
      ok: false,
      error: `Invalid input for ${name}: check fields [${fieldErrors}]`,
    };
  }

  try {
    const result = await tool.handler(validation.data, toolContext);
    return { ok: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Avoid leaking internal details — only pass through "not implemented" or generic messages
    const safeMessage = /not implemented/i.test(message)
      ? message
      : `Tool ${name} failed: ${message}`;
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
