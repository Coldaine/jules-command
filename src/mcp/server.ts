/**
 * MCP Server setup and tool routing.
 */

// import { Server } from '@modelcontextprotocol/sdk/server/index.js';
// import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
// import { tools } from './tools/index.js';

export async function createServer() {
  // TODO: Implement MCP server setup in Phase 6 Task 6.1
  //
  // 1. Create Server instance with name 'jules-command'
  // 2. Register all tools from tools/index.ts
  // 3. Set up ListTools handler
  // 4. Set up CallTool handler with routing
  // 5. Connect via StdioServerTransport
  //
  // For now, return a stub:
  return {
    start: async () => {
      console.log('Jules Command MCP Server — not yet implemented (Phase 6)');
      console.log('Run tests with: npm test');
    },
  };
}
