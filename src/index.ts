#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

interface FinanceApiResponse {
  outputs: [{
    outputs: [{
      results: {
        message: {
          text: string;
        };
      };
    }];
  }];
}

class StatementQAServer {
  private server: Server;
  private readonly apiEndpoint = 'http://localhost:7860/api/v1/run/666cad48-1b9f-4c40-b5fd-21dbd50dc05c';

  constructor() {
    this.server = new Server(
      {
        name: 'statement-qa-tool',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'query_finance',
          description: 'Query personal finance information using a keyword',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query keyword (e.g., "My balance", "credit card", etc.)',
              },
            },
            required: ['query'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'query_finance') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      const args = request.params.arguments as { query: string };
      if (!args.query || typeof args.query !== 'string') {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Query parameter is required and must be a string'
        );
      }

      try {
        const response = await axios.post<FinanceApiResponse>(
          this.apiEndpoint,
          {
            input_value: args.query,
            output_type: 'chat',
            input_type: 'chat',
            tweaks: {
              'ChatInput-rIbgA': {},
              'ChatOutput-oaNin': {},
              'ParseData-TP3z7': {},
              'File-rZLa5': {},
              'Prompt-BlK5R': {},
              'AnthropicModel-0Sjx5': {}
            }
          },
          {
            params: {
              stream: false
            },
            headers: {
              'Content-Type': 'application/json'
            }
          }
        );

        const result = response.data.outputs[0].outputs[0].results.message.text;

        return {
          content: [
            {
              type: 'text',
              text: result,
            },
          ],
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          throw new McpError(
            ErrorCode.InternalError,
            `Finance API error: ${error.response?.data?.message || error.message}`
          );
        }
        throw error;
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Statement QA MCP server running on stdio');
  }
}

const server = new StatementQAServer();
server.run().catch(console.error);