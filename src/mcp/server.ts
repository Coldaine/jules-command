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

// Singleton service instances - created once and reused across all tool calls
let cachedServices: ToolContext['services'] | null = null;

function getOrCreateServices(config: Config, db: Db): NonNullable<ToolContext['services']> {
  if (!cachedServices) {
    const jules = new JulesService(config, db);
    const github = new GitHubService(config, db);
    const dashboard = new DashboardService(db, config);
    const pollManager = new PollManager(jules, github, config, db);

    cachedServices = {
      jules,
      github,
      dashboard,
      pollManager,
      // The following are currently internal to services but could be exposed if needed
      stallDetector: (pollManager as any).stallDetector,
      complexityScorer: (github as any).complexityScorer,
      autoMergeEvaluator: (github as any).autoMergeEvaluator,
    };
  }
  return cachedServices;
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

  // Get or create singleton services
  const services = getOrCreateServices(context.config, context.db);

  const toolContext: ToolContext = {
    ...context,
    services,
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
    // Log internal error details for debugging but don't expose them to clients
    console.error(`Tool ${name} failed:`, error);

    // Return generic error message to avoid leaking internal implementation details
    return {
      ok: false,
      error: `Tool ${name} failed`,
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
