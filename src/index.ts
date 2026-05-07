import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createLogger } from './logger.js';
import { ConfigManager } from './config-manager.js';
import { setupGlobalErrorHandler } from './error-handler.js';

const logger = createLogger('mcp-server');
const configManager = new ConfigManager(logger);

// Setup global error handler — fail closed on unhandled errors
setupGlobalErrorHandler(logger);

/**
 * Create and configure the MCP server with registered tools.
 */
function createServer(): Server {
  const server = new Server(
    {
      name: 'github-power',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Register tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'guided_setup',
        description:
          'Walk through initial GitHub Power configuration step by step. Collects auth method, token, repository, project settings, and feature flags.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            step: {
              type: 'number',
              description: 'Optional step number to resume from (1-8)',
            },
          },
        },
      },
      {
        name: 'validate_config',
        description:
          'Validate the current GitHub Power configuration for completeness and connectivity.',
        inputSchema: {
          type: 'object' as const,
          properties: {},
        },
      },
    ],
  }));

  // Register tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name } = request.params;

    switch (name) {
      case 'guided_setup':
        return handleGuidedSetup();
      case 'validate_config':
        return handleValidateConfig();
      default:
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  });

  return server;
}

/**
 * Handle the guided_setup tool call.
 */
async function handleGuidedSetup(): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  try {
    if (configManager.hasConfig()) {
      return {
        content: [
          {
            type: 'text' as const,
            text: 'Configuration already exists at github-power/config.json. To reconfigure, delete the file and run setup again.',
          },
        ],
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            status: 'ready',
            message:
              'GitHub Power guided setup is ready. Please provide setup answers with authType, authConfig, repository, and optional settings.',
            steps: [
              '1. Select authentication method (pat or github-app)',
              '2. Provide credentials (token env var or app details)',
              '3. Validate credentials',
              '4. Specify repository (owner/repo)',
              '5. Create/select GitHub Project',
              '6. Configure label set',
              '7. Select project template',
              '8. Configure feature flags and sync defaults',
            ],
          }),
        },
      ],
    };
  } catch (error) {
    logger.error('Guided setup failed', { error: String(error) });
    return {
      content: [
        {
          type: 'text' as const,
          text: `Setup error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      ],
      isError: true,
    } as { content: Array<{ type: 'text'; text: string }> };
  }
}

/**
 * Handle the validate_config tool call.
 */
async function handleValidateConfig(): Promise<{
  content: Array<{ type: 'text'; text: string }>;
}> {
  try {
    if (!configManager.hasConfig()) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              valid: false,
              errors: [{ field: 'config', message: 'No configuration file found' }],
              warnings: [],
            }),
          },
        ],
      };
    }

    const config = configManager.loadConfig();
    const token = configManager.getToken();
    const tokenValidation = await configManager.validateToken(token);

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            valid: true,
            repository: config.repository,
            authType: config.authType,
            enableGitHubActions: config.enableGitHubActions,
            tokenValid: tokenValidation.valid,
            scopes: tokenValidation.scopes,
            missingScopes: tokenValidation.missingScopes,
          }),
        },
      ],
    };
  } catch (error) {
    logger.error('Config validation failed', { error: String(error) });
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            valid: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          }),
        },
      ],
    };
  }
}

/**
 * Start the MCP server with stdio transport.
 */
async function main(): Promise<void> {
  logger.info('GitHub Power MCP server starting');

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);
  logger.info('GitHub Power MCP server connected via stdio');
}

// Start server
main().catch((error) => {
  logger.error('Failed to start MCP server', { error: String(error) });
  process.exit(1);
});

export { createServer };
