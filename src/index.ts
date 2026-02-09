#!/usr/bin/env node

/**
 * Jules Command — MCP Server Entry Point
 *
 * Starts the MCP server with all registered tools.
 */

import { createServer } from './mcp/server.js';

async function main() {
  const server = await createServer();
  // MCP SDK handles stdio transport
  await server.start();
}

main().catch((err) => {
  console.error('Fatal: Failed to start Jules Command server', err);
  process.exit(1);
});
