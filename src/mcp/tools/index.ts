/**
 * MCP Tool registry.
 *
 * Each tool is defined as { name, description, inputSchema, handler }.
 * Handlers are wired up in Phase 6.
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // Jules-Native Tools
  {
    name: 'jules_create_session',
    description: 'Create a new Jules task. Persists to local DB.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Task description' },
        repo: { type: 'string', description: 'owner/name (omit for repoless)' },
        branch: { type: 'string', description: 'Starting branch' },
        autoPr: { type: 'boolean', description: 'Auto-create PR (default: true)' },
        requireApproval: { type: 'boolean', description: 'Require plan approval (default: false)' },
        title: { type: 'string', description: 'Session title' },
      },
      required: ['prompt'],
    },
  },
  {
    name: 'jules_list_sessions',
    description: 'List sessions, optionally filtered by state or repo.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string' },
        repo: { type: 'string' },
        limit: { type: 'number' },
        fromDb: { type: 'boolean', description: 'Query local DB (default: true)' },
      },
    },
  },
  {
    name: 'jules_get_session',
    description: 'Get detailed info for one session. Syncs to DB.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
    },
  },
  {
    name: 'jules_get_activities',
    description: 'Get activities for a session.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        type: { type: 'string' },
        limit: { type: 'number' },
        since: { type: 'string' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'jules_approve_plan',
    description: 'Approve a pending plan.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
    },
  },
  {
    name: 'jules_send_message',
    description: 'Send a message to Jules in a session.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        message: { type: 'string' },
        waitForReply: { type: 'boolean' },
      },
      required: ['sessionId', 'message'],
    },
  },
  {
    name: 'jules_get_diff',
    description: 'Get code diff for a session.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        file: { type: 'string' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'jules_get_bash_outputs',
    description: 'Get bash command outputs from a session.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
    },
  },

  // Orchestration Tools
  {
    name: 'jules_dashboard',
    description: 'Comprehensive status dashboard of all Jules work.',
    inputSchema: {
      type: 'object',
      properties: {
        includeCompleted: { type: 'boolean' },
        hours: { type: 'number', description: 'Lookback window in hours' },
      },
    },
  },
  {
    name: 'jules_status',
    description: 'Quick compact status of all non-terminal sessions.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'jules_poll',
    description: 'Run a polling cycle — sync active sessions to DB.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionIds: { type: 'array', items: { type: 'string' } },
        syncPRs: { type: 'boolean' },
      },
    },
  },
  {
    name: 'jules_detect_stalls',
    description: 'Analyze sessions for stall patterns.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'jules_query',
    description: 'Flexible DB query across sessions, activities, PRs, repos.',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', enum: ['sessions', 'activities', 'pr_reviews', 'repos'] },
        where: { type: 'object' },
        orderBy: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['table'],
    },
  },
  {
    name: 'repo_sync',
    description: 'Sync GitHub repo metadata to local DB.',
    inputSchema: {
      type: 'object',
      properties: {
        repos: { type: 'array', items: { type: 'string' } },
        all: { type: 'boolean' },
      },
    },
  },
  {
    name: 'pr_review_status',
    description: 'Get PR review tracking info.',
    inputSchema: {
      type: 'object',
      properties: {
        prUrl: { type: 'string' },
        sessionId: { type: 'string' },
        repo: { type: 'string' },
      },
    },
  },
  {
    name: 'pr_update_review',
    description: 'Update PR review status or notes.',
    inputSchema: {
      type: 'object',
      properties: {
        prUrl: { type: 'string' },
        status: { type: 'string' },
        notes: { type: 'string' },
      },
      required: ['prUrl'],
    },
  },
  {
    name: 'pr_check_auto_merge',
    description: 'Evaluate auto-merge eligibility for pending PRs.',
    inputSchema: {
      type: 'object',
      properties: { prUrl: { type: 'string' } },
    },
  },
  {
    name: 'pr_merge',
    description: 'Merge an approved PR via GitHub API.',
    inputSchema: {
      type: 'object',
      properties: {
        prUrl: { type: 'string' },
        method: { type: 'string', enum: ['merge', 'squash', 'rebase'] },
      },
      required: ['prUrl'],
    },
  },
];
