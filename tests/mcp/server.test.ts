import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS } from '../../src/mcp/tools/index.js';

describe('MCP tool definitions', () => {
  it('does not expose jules_query tool', () => {
    const toolNames = TOOL_DEFINITIONS.map((t) => t.name);
    expect(toolNames).not.toContain('jules_query');
  });

  it('registers safe query replacement tools', () => {
    const toolNames = TOOL_DEFINITIONS.map((t) => t.name);
    expect(toolNames).toContain('jules_sessions_by_state');
    expect(toolNames).toContain('jules_sessions_by_repo');
    expect(toolNames).toContain('jules_recent_activities');
    expect(toolNames).toContain('pr_list_pending');
  });

  it('adds safety gate parameters for pr_merge', () => {
    const prMerge = TOOL_DEFINITIONS.find((t) => t.name === 'pr_merge');
    expect(prMerge).toBeTruthy();
    expect(prMerge?.destructiveHint).toBe(true);
    expect(prMerge?.inputSchema).toMatchObject({
      properties: {
        force: { type: 'boolean', default: false },
      },
    });
  });
});
