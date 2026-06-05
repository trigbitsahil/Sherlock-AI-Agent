import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ListToolsResultSchema, CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import path from "path";

/**
 * Singleton class to manage the MCP client connection to the Google Sheets server.
 */
class McpClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;

  /**
   * Connects to the MCP server via stdio.
   */
  async connect() {
    if (this.client) return this.client;

    this.client = new Client(
      {
        name: "sherlock-web-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );

    // In a real production environment on Vercel, you'd use HTTP/SSE transport.
    const serverPath = path.join(process.cwd(), "mcp/server/index.ts");
    
    this.transport = new StdioClientTransport({
      command: path.join(process.cwd(), "node_modules", ".bin", "tsx"),
      args: [serverPath],
      env: {
        ...process.env,
        // Ensure credentials are passed to the child process
        GOOGLE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "",
        GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY || "",
        GOOGLE_DRIVE_FOLDER_ID: process.env.GOOGLE_DRIVE_FOLDER_ID || "",
      } as any,
    });

    await this.client.connect(this.transport);
    console.log("Connected to Google Sheets MCP server");
    return this.client;
  }

  /**
   * Fetches the list of available tools from the MCP server.
   */
  async listTools() {
    const client = await this.connect();
    const response = await client.request(
      { method: "tools/list" },
      ListToolsResultSchema
    );
    return response.tools;
  }

  /**
   * Calls a specific tool on the MCP server.
   */
  async callTool(name: string, args: any) {
    const client = await this.connect();
    const response = await client.request(
      {
        method: "tools/call",
        params: {
          name,
          arguments: args ?? {}, // Always pass an object, never null
        },
      },
      CallToolResultSchema
    );
    return response;
  }

  /**
   * Properly closes the connection.
   */
  async disconnect() {
    if (this.transport) {
      await this.transport.close();
      this.transport = null;
      this.client = null;
    }
  }
}

// Export a singleton instance
export const mcpClient = new McpClient();
