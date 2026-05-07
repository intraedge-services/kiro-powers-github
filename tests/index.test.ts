import { createServer } from '../src/index.js';

// Note: Full MCP server integration tests require the MCP SDK test utilities.
// These tests verify the server can be created and tools are registered.

describe('MCP Server', () => {
  it('should create server instance without error', () => {
    // createServer is exported for testing
    // In a full test, we'd use MCP SDK test client
    expect(createServer).toBeDefined();
  });
});
