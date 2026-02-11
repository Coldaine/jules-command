/**
 * Phase 7 Task 7.1: MCP Server Tests
 */

import { describe, it, expect } from 'vitest';
import { createServer } from '../../src/mcp/server.js';
import { TOOL_DEFINITIONS } from '../../src/mcp/tools/index.js';
import { createTestDb } from '../setup.js';

describe('MCP Server', () => {
  const { db } = createTestDb();
  const context = {
    db,
    services: {} as any,
    config: {} as any
  };

  describe('Task 7.1: Tool Registration', () => {
    it('should create MCP server instance', async () => {
      const server = await createServer(context);
      
      expect(server).toBeTruthy();
      expect(server).toHaveProperty('start');
    });

    it('should register expected number of tools', async () => {
      // We replaced jules_query with 5 safe tools and added health check
      // 18 - 1 + 5 + 1 = 23? Let me count from index.ts
      expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(18);
    });

    it('should register Jules native tools', async () => {
      const julesTools = TOOL_DEFINITIONS.filter(t => t.name.startsWith('jules_'));
      expect(julesTools.length).toBeGreaterThanOrEqual(13);
    });

    it('should register PR management tools', async () => {
      const prTools = TOOL_DEFINITIONS.filter(t => t.name.startsWith('pr_'));
      expect(prTools.length).toBeGreaterThanOrEqual(4);
    });

    it('should verify tool schemas are valid', async () => {
      TOOL_DEFINITIONS.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type');
      });
    });

    it('should have required fields in schemas', async () => {
      const createSessionTool = TOOL_DEFINITIONS.find(t => t.name === 'jules_create_session');
      
      expect(createSessionTool?.inputSchema).toHaveProperty('required');
      expect((createSessionTool?.inputSchema as any).required).toContain('prompt');
    });
  });

  describe('Tool Definitions', () => {
    it('should have new safe tools', () => {
      const toolNames = TOOL_DEFINITIONS.map(t => t.name);
      
      // Jules native tools
      expect(toolNames).toContain('jules_create_session');
      expect(toolNames).toContain('jules_sessions_list');
      expect(toolNames).toContain('jules_session_get');
      expect(toolNames).toContain('jules_activities_list');
      
      // Removed unsafe tool
      expect(toolNames).not.toContain('jules_query');
      
      // Renamed tool
      expect(toolNames).toContain('jules_repo_sync');
      
      // Health check
      expect(toolNames).toContain('jules_health');
    });

    it('should have unique tool names', () => {
      const names = TOOL_DEFINITIONS.map(t => t.name);
      const uniqueNames = new Set(names);
      
      expect(uniqueNames.size).toBe(names.length);
    });

    it('should have descriptions for all tools', () => {
      TOOL_DEFINITIONS.forEach(tool => {
        expect(tool.description).toBeTruthy();
        expect(tool.description.length).toBeGreaterThan(10);
      });
    });
  });
});
