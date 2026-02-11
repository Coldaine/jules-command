import { describe, it, expect } from "vitest";
import { createServer } from "../../src/mcp/server.js";
import { TOOL_DEFINITIONS } from "../../src/mcp/tools/index.js";
import { createTestDb } from "../setup.js";

describe("MCP Server", () => {
  const { db } = createTestDb();
  const context = {
    db,
    services: {} as any,
    config: {} as any
  };

  describe("Tool Registration", () => {
    it("should register expected number of tools", () => {
      expect(TOOL_DEFINITIONS.length).toBeGreaterThanOrEqual(18);
    });

    it("should register Jules native tools", () => {
      const julesTools = TOOL_DEFINITIONS.filter(t => t.name.startsWith("jules_"));
      expect(julesTools.length).toBeGreaterThanOrEqual(10);
    });

    it("should register PR management tools", () => {
      const prTools = TOOL_DEFINITIONS.filter(t => t.name.startsWith("pr_"));
      expect(prTools.length).toBeGreaterThanOrEqual(4);
    });

    it("should verify tool schemas are valid", () => {
      TOOL_DEFINITIONS.forEach(tool => {
        expect(tool).toHaveProperty("name");
        expect(tool).toHaveProperty("description");
        expect(tool).toHaveProperty("inputSchema");
      });
    });

    it("should have required fields in schemas", () => {
      const createSessionTool = TOOL_DEFINITIONS.find(t => t.name === "jules_create_session");
      expect(createSessionTool?.inputSchema).toHaveProperty("required");
      expect((createSessionTool?.inputSchema as any).required).toContain("prompt");
    });
  });

  describe("Tool Definitions", () => {
    it("should have new safe tools", () => {
      const toolNames = TOOL_DEFINITIONS.map(t => t.name);
      
      expect(toolNames).toContain("jules_create_session");
      expect(toolNames).toContain("jules_sessions_list");
      expect(toolNames).toContain("jules_session_get");
      expect(toolNames).toContain("jules_activities_list");
      
      expect(toolNames).not.toContain("jules_query");
      
      expect(toolNames).toContain("jules_repo_sync");
      expect(toolNames).toContain("jules_health");
    });

    it("adds safety gate parameters for pr_merge", () => {
      const prMerge = TOOL_DEFINITIONS.find((t) => t.name === "pr_merge");
      expect(prMerge).toBeTruthy();
      expect(prMerge?.destructiveHint).toBe(true);
      expect((prMerge?.inputSchema as any).properties).toHaveProperty("force");
      expect((prMerge?.inputSchema as any).properties).toHaveProperty("confirm");
    });
  });
});

