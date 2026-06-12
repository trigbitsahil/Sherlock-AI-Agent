import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { google } from "googleapis";

// ─── Google Auth Helper ─────────────────────────────────────────────────────
function getGoogleAuth() {
  const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
    },
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/spreadsheets",
    ],
  });
}

class DataPlatformMcpServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      { name: "data-platform-mcp-server", version: "2.0.0" },
      { capabilities: { tools: {} } }
    );
    this.setupToolHandlers();
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // ─── List Tools ───────────────────────────────────────────────────────────
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "getSheets",
          description: "List ALL Google Spreadsheet FILES the agent can access, including those in the Drive folder and all files shared with the service account (which appear under 'Shared with me'). No parameters needed.",
          inputSchema: { type: "object", properties: { sourceId: { type: "string" } } },
        },
        {
          name: "searchSharedSpreadsheets",
          description: "List or search Google Spreadsheets shared with the service account. Call without parameters to list ALL shared sheets.",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Optional name to search for" },
            },
          },
        },
        {
          name: "getSheetStructure",
          description: "Get column headers from a spreadsheet tab.",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetName: { type: "string" },
              tabName: { type: "string" },
            },
            required: ["spreadsheetName", "tabName"],
          },
        },
        {
          name: "getRows",
          description: "Retrieve rows from a spreadsheet tab.",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetName: { type: "string" },
              tabName: { type: "string" },
              limit: { type: "number" },
              offset: { type: "number" },
              headerRow: { type: "number", description: "1-based row number to use as column headers. Default is 1. Use 2 for sheets where row 1 has group labels and row 2 has actual column names (e.g. Clients_Sheet)." },
            },
            required: ["spreadsheetName", "tabName"],
          },
        },
        {
          name: "searchRows",
          description: "Search for rows matching a keyword.",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetName: { type: "string" },
              tabName: { type: "string" },
              query: { type: "string" },
              column: { type: "string" },
              headerRow: { type: "number" },
            },
            required: ["spreadsheetName", "tabName", "query"],
          },
        },
        {
          name: "getRowById",
          description: "Get a row by its row number.",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetName: { type: "string" },
              tabName: { type: "string" },
              rowId: { type: "string" },
            },
            required: ["spreadsheetName", "tabName", "rowId"],
          },
        },
        {
          name: "updateRow",
          description: "Update a specific row.",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetName: { type: "string" },
              tabName: { type: "string" },
              rowId: { type: "string" },
              updates: { type: "string" },
            },
            required: ["spreadsheetName", "tabName", "rowId", "updates"],
          },
        },
        {
          name: "createRow",
          description: "Append a new row.",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetName: { type: "string" },
              tabName: { type: "string" },
              data: { type: "string" },
            },
            required: ["spreadsheetName", "tabName", "data"],
          },
        },
        {
          name: "generateReport",
          description: "Generate aggregated reports.",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetName: { type: "string" },
              tabName: { type: "string" },
              metrics: { type: "string" },
              groupBy: { type: "string" },
            },
            required: ["spreadsheetName", "tabName", "metrics"],
          },
        },
      ],
    }));

    // Register CallToolRequestSchema handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return this.executeTool(request.params.name, request.params.arguments ?? {});
    });
  }

  // Direct tool execution without going through stdio transport
  async executeTool(name: string, args: any) {
    const ok = (data: any) => ({ content: [{ type: "text", text: JSON.stringify(data) }] });

    let auth: any;
    try {
      auth = getGoogleAuth();
    } catch (e: any) {
      return ok({ error: "Failed to initialize Google Auth: " + e.message });
    }

    // ─── Name-to-ID resolver (scans Drive folder for matching spreadsheet) ────
    const resolveSpreadsheetId = async (auth: any, name: string): Promise<string | null> => {
      const drive = google.drive({ version: "v3", auth });
      const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
      
      let found: string | null = null;
      
      if (rootFolderId) {
        const scan = async (folderId: string) => {
          if (found) return;
          const res = await drive.files.list({
            q: `'${folderId}' in parents and (mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.folder' or mimeType='application/vnd.google-apps.shortcut') and trashed=false`,
            fields: "files(id, name, mimeType, shortcutDetails)",
            pageSize: 1000,
          });
          for (const f of res.data.files ?? []) {
            if ((f.mimeType === "application/vnd.google-apps.spreadsheet" || (f.mimeType === "application/vnd.google-apps.shortcut" && f.shortcutDetails?.targetMimeType === "application/vnd.google-apps.spreadsheet")) && f.name?.toLowerCase() === name.toLowerCase()) {
              found = f.mimeType === "application/vnd.google-apps.shortcut" ? f.shortcutDetails!.targetId! : f.id!;
              return;
            } else if (f.mimeType === "application/vnd.google-apps.folder" && f.id) {
              await scan(f.id);
            }
          }
        };
        await scan(rootFolderId);
      }

      // If not found in the specific folder, or if folder ID isn't set, search globally (e.g. shared with me)
      if (!found) {
        // Escape single quotes in name for the query
        const safeName = name.replace(/'/g, "\\'");
        const res = await drive.files.list({
          q: `name = '${safeName}' and (mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.shortcut') and trashed=false`,
          fields: "files(id, name, mimeType, shortcutDetails)",
          pageSize: 5,
        });
        if (res.data.files && res.data.files.length > 0) {
          const f = res.data.files[0];
          found = f.mimeType === "application/vnd.google-apps.shortcut" ? f.shortcutDetails!.targetId! : f.id!;
        }
      }

      return found;
    };

    switch (name) {
      // ── getSheets: Recursive Drive folder scan ────────────────────────────
      case "getSheets": {
        const drive = google.drive({ version: "v3", auth });
        let res;
        try {
          res = await drive.files.list({
            q: "(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.shortcut') and trashed=false",
            fields: "files(id, name, webViewLink, mimeType, shortcutDetails)",
            orderBy: "modifiedTime desc",
            pageSize: 1000,
          });
        } catch (e: any) {
          return ok({ error: `Failed to fetch sheets. Google API Error: ${e.message}` });
        }

        const sheets = (res.data.files ?? [])
          .filter(f => f.mimeType === "application/vnd.google-apps.spreadsheet" || f.shortcutDetails?.targetMimeType === "application/vnd.google-apps.spreadsheet")
          .map(f => {
            const targetId = f.mimeType === "application/vnd.google-apps.shortcut" ? f.shortcutDetails!.targetId! : f.id!;
            return {
              id: targetId,
              name: f.name,
              url: f.webViewLink || `https://docs.google.com/spreadsheets/d/${targetId}/edit`
            };
          });

        // Deduplicate sheets by ID
        const uniqueSheets = Array.from(new Map(sheets.map(s => [s.id, s])).values());

        return ok({ sheets: uniqueSheets, totalSheets: uniqueSheets.length });
      }

        // ── searchSharedSpreadsheets: List sheets shared with the service account ──
        case "searchSharedSpreadsheets": {
          const drive = google.drive({ version: "v3", auth });
          let q = "(mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.shortcut') and trashed=false";
          if (args.query) {
            q += ` and name contains '${args.query}'`;
          }

          let res;
          try {
            res = await drive.files.list({
              q,
              fields: "files(id, name, webViewLink, createdTime, mimeType, shortcutDetails)",
              orderBy: "modifiedTime desc",
              pageSize: 100,
            });
          } catch (e: any) {
            return ok({ error: `Failed to search shared spreadsheets. Google API Error: ${e.message}` });
          }

          const files = res.data.files ?? [];
          return ok({
            total: files.length,
            spreadsheets: files.filter(f => f.mimeType === "application/vnd.google-apps.spreadsheet" || f.shortcutDetails?.targetMimeType === "application/vnd.google-apps.spreadsheet").map(f => {
              const targetId = f.mimeType === "application/vnd.google-apps.shortcut" ? f.shortcutDetails!.targetId! : f.id!;
              return {
                id: targetId,
                name: f.name,
                url: f.webViewLink || `https://docs.google.com/spreadsheets/d/${targetId}/edit`
              };
            })
          });
        }


        // ── getSheetStructure: Read header row (resolves name → ID) ──────────
        case "getSheetStructure": {
          const spreadsheetId = await resolveSpreadsheetId(auth, args.spreadsheetName);
          if (!spreadsheetId) return ok({ error: `Spreadsheet '${args.spreadsheetName}' not found in Drive folder.` });
          const sheetsApi = google.sheets({ version: "v4", auth });
          let res;
          try {
            res = await sheetsApi.spreadsheets.values.get({
              spreadsheetId,
              range: `'${args.tabName}'!1:1`,
            });
          } catch (e: any) {
            return ok({ error: `Failed to fetch structure for tab '${args.tabName}'. Make sure tab exists. Google API Error: ${e.message}` });
          }
          return ok({ columns: res.data.values?.[0] ?? [] });
        }

        case "getRows": {
          const spreadsheetId = await resolveSpreadsheetId(auth, args.spreadsheetName);
          if (!spreadsheetId) return ok({ error: `Spreadsheet '${args.spreadsheetName}' not found in Drive folder.` });
          const sheetsApi = google.sheets({ version: "v4", auth });
          const limit = args.limit ?? 1000;
          const offset = args.offset ?? 0;
          const headerRow = Math.max(1, args.headerRow ?? 1); // 1-based row number to use as header
          let res;
          try {
            res = await sheetsApi.spreadsheets.values.get({
              spreadsheetId,
              range: `'${args.tabName}'`,
            });
          } catch (e: any) {
            return ok({ error: `Failed to fetch data from tab '${args.tabName}'. Make sure the tab name is exactly correct. Google API Error: ${e.message}` });
          }
          const raw = res.data.values ?? [];
          if (raw.length < headerRow + 1) return ok({ rows: [], headers: raw[headerRow - 1] ?? [], total: 0 });
          
          // Find the maximum row length to avoid truncating columns if the header row is shorter
          const maxCols = Math.max(...raw.map(r => r.length));
          const rawHeaders = raw[headerRow - 1] || []; 
          
          const headers: string[] = [];
          const headerCounts: Record<string, number> = {};
          
          for (let i = 0; i < maxCols; i++) {
            const h = rawHeaders[i];
            const base = h || `Column_${i + 1}`;
            if (headerCounts[base]) {
              headers.push(`${base}_${headerCounts[base]}`);
              headerCounts[base]++;
            } else {
              headers.push(base);
              headerCounts[base] = 1;
            }
          }

          const dataRows = raw.slice(headerRow); // Data starts after header row
          const rows = dataRows.slice(offset, offset + limit).map((row, i) => {
            const obj: Record<string, string> = { _rowNumber: String(i + headerRow + 1 + offset) };
            headers.forEach((h, j) => { obj[h] = row[j] ?? ""; });
            return obj;
          });
          return ok({ headers, rows, total: dataRows.length });
        }

        // ── searchRows: Filter rows by keyword (resolves name → ID) ──────────
        case "searchRows": {
          const spreadsheetId = await resolveSpreadsheetId(auth, args.spreadsheetName);
          if (!spreadsheetId) return ok({ error: `Spreadsheet '${args.spreadsheetName}' not found in Drive folder.` });
          const sheetsApi = google.sheets({ version: "v4", auth });
          const headerRow = Math.max(1, args.headerRow ?? 1);
          let res;
          try {
            res = await sheetsApi.spreadsheets.values.get({
              spreadsheetId,
              range: `'${args.tabName}'`,
            });
          } catch (e: any) {
            return ok({ error: `Failed to search rows in tab '${args.tabName}'. Make sure tab exists. Google API Error: ${e.message}` });
          }
          const raw = res.data.values ?? [];
          if (raw.length < headerRow + 1) return ok({ rows: [], matchCount: 0 });
          
          const maxCols = Math.max(...raw.map((r: any[]) => r.length));
          const rawHeaders = raw[headerRow - 1] || [];
          
          const headers: string[] = [];
          const headerCounts: Record<string, number> = {};
          
          for (let i = 0; i < maxCols; i++) {
            const h = rawHeaders[i];
            const base = h || `Column_${i + 1}`;
            if (headerCounts[base]) {
              headers.push(`${base}_${headerCounts[base]}`);
              headerCounts[base]++;
            } else {
              headers.push(base);
              headerCounts[base] = 1;
            }
          }

          const q = String(args.query ?? "").toLowerCase();
          const colIdx = args.column ? headers.indexOf(args.column) : -1;
          const dataRows = raw.slice(headerRow);
          const rows = dataRows.map((row, i) => {
            const obj: Record<string, string> = { _rowNumber: String(i + headerRow + 1) };
            headers.forEach((h, j) => { obj[h] = row[j] ?? ""; });
            return obj;
          }).filter((row) => {
            const vals = Object.entries(row).filter(([k]) => k !== "_rowNumber");
            if (colIdx >= 0) return String(vals[colIdx]?.[1] ?? "").toLowerCase().includes(q);
            return vals.some(([, v]) => String(v).toLowerCase().includes(q));
          });
          return ok({ headers, rows, matchCount: rows.length });
        }

        // ── getRowById: Get a row by number (resolves name → ID) ─────────────
        case "getRowById": {
          const spreadsheetId = await resolveSpreadsheetId(auth, args.spreadsheetName);
          if (!spreadsheetId) return ok({ error: `Spreadsheet '${args.spreadsheetName}' not found.` });
          const sheetsApi = google.sheets({ version: "v4", auth });
          const rowNum = parseInt(args.rowId);
          let rowRes, headerRes;
          try {
            [rowRes, headerRes] = await Promise.all([
              sheetsApi.spreadsheets.values.get({ spreadsheetId, range: `'${args.tabName}'!${rowNum}:${rowNum}` }),
              sheetsApi.spreadsheets.values.get({ spreadsheetId, range: `'${args.tabName}'!1:1` }),
            ]);
          } catch (e: any) {
             return ok({ error: `Failed to get row by ID in tab '${args.tabName}'. Make sure tab exists. Google API Error: ${e.message}` });
          }
          const headers = headerRes.data.values?.[0] ?? [];
          const row = rowRes.data.values?.[0] ?? [];
          const obj: Record<string, string> = {};
          headers.forEach((h, i) => { obj[h] = row[i] ?? ""; });
          return ok({ row: obj });
        }

        case "updateRow":
          return ok({ success: true, message: "Row update not yet implemented." });
        case "createRow": {
          const spreadsheetId = await resolveSpreadsheetId(auth, args.spreadsheetName);
          if (!spreadsheetId) return ok({ error: `Spreadsheet '${args.spreadsheetName}' not found.` });
          
          let rowData: Record<string, any> = {};
          try {
            rowData = typeof args.data === 'string' ? JSON.parse(args.data) : args.data;
          } catch (e) {
            return ok({ error: "Invalid JSON data provided for createRow." });
          }

          const sheetsApi = google.sheets({ version: "v4", auth });
          
          // First get the headers to know column order
          let headerRes;
          try {
            headerRes = await sheetsApi.spreadsheets.values.get({
              spreadsheetId,
              range: `'${args.tabName}'!1:2`,
            });
          } catch (e: any) {
            return ok({ error: `Failed to get headers for createRow in tab '${args.tabName}'. Make sure tab exists. Google API Error: ${e.message}` });
          }
          
          const rawHeaders = headerRes.data.values || [];
          // Use row 2 for Clients_Sheet, row 1 for others
          const isClientsSheet = args.spreadsheetName.toLowerCase().includes("clients_sheet");
          const headersRow = isClientsSheet ? (rawHeaders[1] || []) : (rawHeaders[0] || []);
          
          // Make headers unique to match what getRows does
          const headers: string[] = [];
          const headerCounts: Record<string, number> = {};
          headersRow.forEach((h: string) => {
            const base = h || `Column_${headers.length + 1}`;
            if (headerCounts[base]) {
              headers.push(`${base}_${headerCounts[base]}`);
              headerCounts[base]++;
            } else {
              headers.push(base);
              headerCounts[base] = 1;
            }
          });

          // Build the row array
          const newRow: any[] = [];
          headers.forEach(h => {
            newRow.push(rowData[h] ?? "");
          });

          try {
            await sheetsApi.spreadsheets.values.append({
              spreadsheetId,
              range: `'${args.tabName}'`,
              valueInputOption: "USER_ENTERED",
              insertDataOption: "INSERT_ROWS",
              requestBody: {
                values: [newRow]
              }
            });
          } catch (e: any) {
            return ok({ error: `Failed to create row in tab '${args.tabName}'. Google API Error: ${e.message}` });
          }

          return ok({ success: true, message: "Row successfully created." });
        }
      case "generateReport":
        return ok({ message: "Use getRows first, then I will analyze the data." });

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Data Platform MCP server running on stdio");
  }
}

export const mcpServerInstance = new DataPlatformMcpServer();

// Only start the stdio server if explicitly run as a standalone process
if (process.env.RUN_MCP_SERVER === "true" || (typeof require !== "undefined" && typeof module !== "undefined" && require.main === module)) {
  mcpServerInstance.run().catch(console.error);
}
