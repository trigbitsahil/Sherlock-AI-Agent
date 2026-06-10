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

export async function getMcpTools() {
  // Tools are natively exported via mcpServerInstance
  // No warmup needed since we bypass MCP stdio transport

  return {
    getSheets: tool({
      description: "List all Google Spreadsheet files from the Drive folder. Call this first to discover available spreadsheet names.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          _unused: { type: "string" as const }
        },
        additionalProperties: false,
      }),
      execute: async () => callMcp("getSheets", {}),
    }),

    getSheetStructure: tool({
      description: "Get column headers from a specific tab inside a Google Spreadsheet.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "The exact NAME of the spreadsheet file." },
          tabName: { type: "string" as const, description: "The tab/worksheet name inside the spreadsheet (e.g. January_2026)." },
        },
        required: ["spreadsheetName", "tabName"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("getSheetStructure", args),
    }),

    getRows: tool({
      description: "Read rows from a specific tab of a named Google Spreadsheet. Use limit to control how many rows to fetch (default 200, max 500). Use headerRow=2 for sheets like Clients_Sheet where row 1 has group labels and row 2 has the actual column names (Client Name, SOW, Budget Hours, etc.).",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "The exact NAME of the spreadsheet file." },
          tabName: { type: "string" as const, description: "The tab/worksheet name inside the spreadsheet." },
          limit: { type: "number" as const, description: "Maximum number of rows to return. Defaults to 1000." },
          offset: { type: "number" as const, description: "Number of data rows to skip (for pagination)." },
          headerRow: { type: "number" as const, description: "1-based row number to treat as column headers. Default 1. Use 2 for Clients_Sheet (row 1 = group labels like 'Billable Clients', row 2 = actual column names like 'Client Name', 'SOW', 'Budget Hours')." },
        },
        required: ["spreadsheetName", "tabName"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("getRows", args),
    }),

    searchRows: tool({
      description: "Search for rows matching a keyword in a specific tab of a Google Spreadsheet.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "The exact NAME of the spreadsheet file." },
          tabName: { type: "string" as const, description: "The tab/worksheet name to search in." },
          query: { type: "string" as const, description: "The keyword to search for." },
          headerRow: { type: "number" as const, description: "1-based row number to treat as column headers. Default 1. Use 2 for Clients_Sheet." },
        },
        required: ["spreadsheetName", "tabName", "query"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("searchRows", args),
    }),

    getRowById: tool({
      description: "Get a specific row by row number from a Google Spreadsheet tab.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "The exact NAME of the spreadsheet file." },
          tabName: { type: "string" as const, description: "The tab/worksheet name." },
          rowId: { type: "string" as const, description: "The row number as a string (e.g. '5')." },
        },
        required: ["spreadsheetName", "tabName", "rowId"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("getRowById", args),
    }),

    updateRow: tool({
      description: "Update a specific row in a Google Spreadsheet tab.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "The exact NAME of the spreadsheet file." },
          tabName: { type: "string" as const, description: "The tab/worksheet name." },
          rowId: { type: "string" as const, description: "The row number to update." },
          updates: { type: "string" as const, description: 'JSON string of key-value pairs. E.g. {"status":"Approved"}' },
        },
        required: ["spreadsheetName", "tabName", "rowId", "updates"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("updateRow", args),
    }),

    createRow: tool({
      description: "Append a new row to a Google Spreadsheet tab.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "The exact NAME of the spreadsheet file." },
          tabName: { type: "string" as const, description: "The tab/worksheet name." },
          data: { type: "string" as const, description: 'JSON string for the new row. E.g. {"name":"John"}' },
        },
        required: ["spreadsheetName", "tabName", "data"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("createRow", args),
    }),

    generateReport: tool({
      description: "Generate an aggregated report from a Google Spreadsheet tab.",
      inputSchema: jsonSchema({
        type: "object" as const,
        properties: {
          spreadsheetName: { type: "string" as const, description: "The exact NAME of the spreadsheet file." },
          tabName: { type: "string" as const, description: "The tab/worksheet name." },
          metrics: { type: "string" as const, description: 'JSON array of metrics. E.g. ["sum(revenue)","count(id)"]' },
        },
        required: ["spreadsheetName", "tabName", "metrics"],
        additionalProperties: false,
      }),
      execute: async (args: any) => callMcp("generateReport", args),
    }),
  };
}
