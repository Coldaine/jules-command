/**
 * Smoke Test — Verifies basic build and MCP server startup
 *
 * This test ensures:
 * 1. The project builds successfully
 * 2. The MCP server can be instantiated
 * 3. All expected tools are registered
 */

import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS } from '../src/mcp/tools/index.js';
import * as fs from 'fs';
import * as path from 'path';

describe('Smoke Tests', () => {
  describe('Build Verification', () => {
    it('should have built dist/index.js', () => {
      const distPath = path.resolve(process.cwd(), 'dist', 'index.js');
      expect(fs.existsSync(distPath)).toBe(true);
    });

    it('should have built all service files', () => {
      const services = ['jules.service.js', 'github.service.js', 'poll-manager.js', 'dashboard.js'];
      for (const service of services) {
        const servicePath = path.resolve(process.cwd(), 'dist', 'services', service);
        expect(fs.existsSync(servicePath)).toBe(true);
      }
    });

    it('should have built all database files', () => {
      const dbFiles = ['migrate.js', 'schema.js', 'index.js'];
      for (const file of dbFiles) {
        const dbPath = path.resolve(process.cwd(), 'dist', 'db', file);
        expect(fs.existsSync(dbPath)).toBe(true);
      }
    });
  });

  describe('MCP Server Tool Registration', () => {
    it('should register at least 18 tools', () => {
      expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(18);
    });

    it('should register all required Jules tools', () => {
      const requiredTools = [
        'jules_create_session',
        'jules_sessions_list',
        'jules_session_get',
        'jules_activities_list',
        'jules_approve_plan',
        'jules_send_message',
        'jules_get_diff',
        'jules_get_bash_outputs',
        'jules_dashboard',
        'jules_status',
        'jules_poll',
        'jules_detect_stalls',
      ];

      const registeredTools = TOOL_DEFINITIONS.map(t => t.name);
      for (const tool of requiredTools) {
        expect(registeredTools).toContain(tool);
      }
    });

    it('should register all PR management tools', () => {
      const prTools = [
        'pr_review_status',
        'pr_update_review',
        'pr_check_auto_merge',
        'pr_merge',
      ];

      const registeredTools = TOOL_DEFINITIONS.map(t => t.name);
      for (const tool of prTools) {
        expect(registeredTools).toContain(tool);
      }
    });

    it('should have handler functions for all tools', () => {
      for (const tool of TOOL_DEFINITIONS) {
        expect(tool).toHaveProperty('handler');
        expect(typeof tool.handler).toBe('function');
      }
    });

    it('should have valid input schemas for all tools', () => {
      for (const tool of TOOL_DEFINITIONS) {
        expect(tool).toHaveProperty('inputSchema');
        expect(tool.inputSchema).toHaveProperty('type');
        expect(tool.inputSchema).toHaveProperty('properties');
      }
    });
  });

  describe('Tool Safety Checks', () => {
    it('should mark pr_merge as destructive', () => {
      const prMerge = TOOL_DEFINITIONS.find(t => t.name === 'pr_merge');
      expect(prMerge).toBeTruthy();
      expect(prMerge?.destructiveHint).toBe(true);
    });

    it('should have force and confirm parameters for pr_merge', () => {
      const prMerge = TOOL_DEFINITIONS.find(t => t.name === 'pr_merge');
      expect(prMerge).toBeTruthy();
      const schema = prMerge?.inputSchema as { properties: Record<string, unknown> };
      expect(schema.properties).toHaveProperty('force');
      expect(schema.properties).toHaveProperty('confirm');
    });

    it('should not have the unsafe jules_query tool', () => {
      const toolNames = TOOL_DEFINITIONS.map(t => t.name);
      expect(toolNames).not.toContain('jules_query');
    });
  });

  describe('Documentation Check', () => {
    it('should have README.md', () => {
      const readmePath = path.resolve(process.cwd(), 'README.md');
      expect(fs.existsSync(readmePath)).toBe(true);
    });

    it('should have .env.example', () => {
      const envPath = path.resolve(process.cwd(), '.env.example');
      expect(fs.existsSync(envPath)).toBe(true);
    });
  });
});
