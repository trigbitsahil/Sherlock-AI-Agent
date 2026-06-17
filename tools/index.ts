import { tool, jsonSchema } from "ai";
import { mcpServerInstance } from "../mcp/server/index";

const MAX_TOOL_RESPONSE_CHARS = 20000;
const DEFAULT_ROW_LIMIT = 200;

async function callMcp(name: string, args: Record<string, any>) {
  if (name === "getRows" && !args.limit) {
    args = { ...args, limit: DEFAULT_ROW_LIMIT };
  }
  if (name === "searchRows" && !args.limit) {
    args = { ...args, limit: DEFAULT_ROW_LIMIT };
  }

  // Clients_Sheet has a 2-row header: row 1 = group labels, row 2 = actual column names.
  // Auto-inject headerRow=2 so Budget Hours / Client Name are correctly mapped.
  if (
    (name === "getRows" || name === "searchRows") &&
    args.spreadsheetName?.toLowerCase().includes("clients_sheet") &&
    !args.headerRow
  ) {
    args = { ...args, headerRow: 2 };
  }

  // Bypass MCP transport in serverless environments
  const result = await mcpServerInstance.executeTool(name, args ?? {});
  const text = result.content
    .filter((c: any) => c.type === "text")
    .map((c: any) => c.text)
    .join("\n");

  try {
    const parsed = JSON.parse(text);
    const jsonStr = JSON.stringify(parsed);
    if (jsonStr.length > MAX_TOOL_RESPONSE_CHARS) {
      return { _truncated: true, _rawPreview: jsonStr.slice(0, MAX_TOOL_RESPONSE_CHARS) + "..." };
    }
    return parsed;
  } catch {
    return text.slice(0, MAX_TOOL_RESPONSE_CHARS);
  }
}

export async function getMcpTools(requiredTools?: string[]) {
  // Tools are natively exported via mcpServerInstance
  // No warmup needed since we bypass MCP stdio transport

  const allTools = {
    getSheets: tool({
      description: "List all Google Spreadsheet files.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: { _unused: { type: "string" as const } },
        additionalProperties: false,
      }),
      execute: async () => callMcp("getSheets", {}),
    }),

    getSheetStructure: tool({
      description: "Get column headers from a specific tab.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "Spreadsheet name." },
          tabName: { type: "string" as const, description: "Tab name." },
        },
        required: ["spreadsheetName", "tabName"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("getSheetStructure", args),
    }),

    getRows: tool({
      description: "Read rows from a spreadsheet tab. Use headerRow=2 for Clients_Sheet.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "Spreadsheet name." },
          tabName: { type: "string" as const, description: "Tab name." },
          limit: { type: "number" as const, description: "Max rows." },
          offset: { type: "number" as const, description: "Rows to skip." },
          headerRow: { type: "number" as const, description: "Header row number." },
        },
        required: ["spreadsheetName", "tabName"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("getRows", args),
    }),

    searchRows: tool({
      description: "Search for rows matching a keyword.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "Spreadsheet name." },
          tabName: { type: "string" as const, description: "Tab name." },
          query: { type: "string" as const, description: "Search keyword." },
          headerRow: { type: "number" as const, description: "Header row number." },
        },
        required: ["spreadsheetName", "tabName", "query"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("searchRows", args),
    }),

    getRowById: tool({
      description: "Get a specific row by row number.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "Spreadsheet name." },
          tabName: { type: "string" as const, description: "Tab name." },
          rowId: { type: "string" as const, description: "Row number." },
        },
        required: ["spreadsheetName", "tabName", "rowId"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("getRowById", args),
    }),

    updateRow: tool({
      description: "Update a specific row.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "Spreadsheet name." },
          tabName: { type: "string" as const, description: "Tab name." },
          rowId: { type: "string" as const, description: "Row number." },
          updates: { type: "string" as const, description: 'JSON string of updates.' },
        },
        required: ["spreadsheetName", "tabName", "rowId", "updates"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("updateRow", args),
    }),

    createRow: tool({
      description: "Append a new row.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "Spreadsheet name." },
          tabName: { type: "string" as const, description: "Tab name." },
          data: { type: "string" as const, description: 'JSON string for new row.' },
        },
        required: ["spreadsheetName", "tabName", "data"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("createRow", args),
    }),

    generateReport: tool({
      description: "Generate an aggregated report.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "Spreadsheet name." },
          tabName: { type: "string" as const, description: "Tab name." },
          metrics: { type: "string" as const, description: 'JSON array of metrics.' },
        },
        required: ["spreadsheetName", "tabName", "metrics"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("generateReport", args),
    }),

    getYearlyRevenue: tool({
      description: "Calculate YTD revenue and monthly breakdown.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "Spreadsheet name." },
          year: { type: "number" as const, description: "Year." },
        },
        required: ["spreadsheetName", "year"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("getYearlyRevenue", args),
    }),

    getTopClients: tool({
      description: "Get top clients by budget hours.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "Spreadsheet name." },
          year: { type: "number" as const, description: "Year." },
          month: { type: "string" as const, description: "Optional month." },
          limit: { type: "number" as const, description: "Limit." },
        },
        required: ["spreadsheetName", "year"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("getTopClients", args),
    }),

    getStaffUtilizationOverservice: tool({
      description: "Analyze Staff Utilization sheets to find accounts exceeding an overservice threshold (default 120%) in a minimum number of months. Handles tab discovery, batched data fetching, and analysis server-side — always use this tool instead of getRows for overservice/utilization analysis queries.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetNames: {
            type: "array" as const,
            items: { type: "string" as const },
            description: "List of Staff Utilization spreadsheet names to analyze.",
          },
          monthCount: { type: "number" as const, description: "How many recent months to check. Default 6." },
          threshold: { type: "number" as const, description: "Overservice % threshold. Default 120." },
          minMonths: { type: "number" as const, description: "Min months exceeding threshold to include. Default 3." },
        },
        required: ["spreadsheetNames"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("getStaffUtilizationOverservice", args),
    }),
  };

  if (!requiredTools || requiredTools.length === 0) {
    return allTools;
  }

  const filteredTools: Record<string, any> = {};
  for (const toolName of requiredTools) {
    if (toolName in allTools) {
      filteredTools[toolName] = (allTools as any)[toolName];
    }
  }
  return filteredTools;
}
