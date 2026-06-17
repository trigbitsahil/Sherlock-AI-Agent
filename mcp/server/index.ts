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

// ─── In-Memory Cache for Sheets API ─────────────────────────────────────────
const sheetCache = new Map<string, { data: any, timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function getCachedSheetData(sheetsApi: any, spreadsheetId: string, range: string, valueRenderOption: string = "FORMATTED_VALUE") {
  const cacheKey = `${spreadsheetId}|${range}|${valueRenderOption}`;
  const cached = sheetCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    console.log(`[MCP Cache] HIT for ${range}`);
    return cached.data;
  }
  console.log(`[MCP Cache] MISS for ${range}`);
  const res = await sheetsApi.spreadsheets.values.get({ spreadsheetId, range, valueRenderOption });
  sheetCache.set(cacheKey, { data: res.data, timestamp: Date.now() });
  return res.data;
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
          name: "getTabs",
          description: "Get all tab names from a spreadsheet.",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetName: { type: "string" },
            },
            required: ["spreadsheetName"],
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
              valueRenderOption: { type: "string", description: "FORMATTED_VALUE (default), UNFORMATTED_VALUE, or FORMULA" },
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
              bgColorUpdates: { type: "string", description: "Map of HeaderName -> {red, green, blue} (0-1 range)" },
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
        {
          name: "getYearlyRevenue",
          description: "Calculate YTD revenue and monthly breakdown for a specific year from Clients_Sheet.",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetName: { type: "string" },
              year: { type: "number" },
            },
            required: ["spreadsheetName", "year"],
          },
        },
        {
          name: "getTopClients",
          description: "Get top clients by budget hours for a specific year or month from Clients_Sheet.",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetName: { type: "string" },
              year: { type: "number" },
              month: { type: "string", description: "Optional. If provided, only gets top clients for this month (e.g. 'January')." },
              limit: { type: "number", description: "Number of top clients to return. Default 10." },
            },
            required: ["spreadsheetName", "year"],
          },
        },
        {
          name: "getStaffUtilizationOverservice",
          description: "Analyze Staff Utilization sheets to find accounts exceeding an overservice threshold (default 120%) in a minimum number of months. Handles tab discovery internally — do NOT call getRows for this use case.",
          inputSchema: {
            type: "object",
            properties: {
              spreadsheetNames: {
                type: "array",
                items: { type: "string" },
                description: "List of Staff Utilization spreadsheet names to analyze (e.g. ['2026 | Staff Utilization - Brazil PR', 'Staff Utilisation Sheet-Chile | Peru | Colombia | Argentina&Uruguay'])."
              },
              monthCount: {
                type: "number",
                description: "How many of the most recent months to check. Default 6."
              },
              threshold: {
                type: "number",
                description: "Overservice percentage threshold (e.g. 120 means >120%). Default 120."
              },
              minMonths: {
                type: "number",
                description: "Minimum number of months an account must exceed the threshold to appear in results. Default 3."
              }
            },
            required: ["spreadsheetNames"],
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
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
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
          supportsAllDrives: true,
          includeItemsFromAllDrives: true,
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
            supportsAllDrives: true,
            includeItemsFromAllDrives: true,
          });
        } catch (e: any) {
          return ok({ error: `Failed to fetch sheets. Google API Error: ${e.message}` });
        }

        const sheets = (res.data.files ?? [])
          .filter(f => f.mimeType === "application/vnd.google-apps.spreadsheet" || f.shortcutDetails?.targetMimeType === "application/vnd.google-apps.spreadsheet")
          .map(f => f.name)
          .filter(Boolean) as string[];

        // Deduplicate sheet names
        const uniqueSheets = [...new Set(sheets)];

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


        // ── getTabs: Get all tab names in a spreadsheet ──────────
        case "getTabs": {
          const spreadsheetId = await resolveSpreadsheetId(auth, args.spreadsheetName);
          if (!spreadsheetId) return ok({ error: `Spreadsheet '${args.spreadsheetName}' not found in Drive folder.` });
          const sheetsApi = google.sheets({ version: "v4", auth });
          try {
            const res = await sheetsApi.spreadsheets.get({ spreadsheetId });
            const tabs = res.data.sheets?.map(s => s.properties?.title).filter(Boolean) || [];
            return ok({ tabs });
          } catch (e: any) {
            return ok({ error: `Failed to get tabs. Google API Error: ${e.message}` });
          }
        }

        // ── getSheetStructure: Read header row (resolves name → ID) ──────────
        case "getSheetStructure": {
          const spreadsheetId = await resolveSpreadsheetId(auth, args.spreadsheetName);
          if (!spreadsheetId) return ok({ error: `Spreadsheet '${args.spreadsheetName}' not found in Drive folder.` });
          const sheetsApi = google.sheets({ version: "v4", auth });
          let resData;
          try {
            resData = await getCachedSheetData(sheetsApi, spreadsheetId, `'${args.tabName}'!1:1`);
          } catch (e: any) {
            return ok({ error: `Failed to fetch structure for tab '${args.tabName}'. Make sure tab exists. Google API Error: ${e.message}` });
          }
          return ok({ columns: resData.values?.[0] ?? [] });
        }

        case "getRows": {
          const spreadsheetId = await resolveSpreadsheetId(auth, args.spreadsheetName);
          if (!spreadsheetId) return ok({ error: `Spreadsheet '${args.spreadsheetName}' not found in Drive folder.` });
          const sheetsApi = google.sheets({ version: "v4", auth });
          const limit = args.limit ?? 1000;
          const offset = args.offset ?? 0;
          const headerRow = Math.max(1, args.headerRow ?? 1); // 1-based row number to use as header
          let resData;
          try {
            resData = await getCachedSheetData(sheetsApi, spreadsheetId, `'${args.tabName}'`, args.valueRenderOption || "FORMATTED_VALUE");
          } catch (e: any) {
            return ok({ error: `Failed to fetch data from tab '${args.tabName}'. Make sure the tab name is exactly correct. Google API Error: ${e.message}` });
          }
          const raw = resData.values ?? [];
          if (raw.length < headerRow + 1) return ok({ rows: [], headers: raw[headerRow - 1] ?? [], total: 0 });
          
          // Find the maximum row length to avoid truncating columns if the header row is shorter
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

          const dataRows = raw.slice(headerRow); // Data starts after header row
          const rows = dataRows.slice(offset, offset + limit).map((row: any[], i: number) => {
            const obj: Record<string, string> = { _rowNumber: String(i + headerRow + 1 + offset) };
            headers.forEach((h, j) => { obj[h] = row[j] ?? ""; });
            return obj;
          });
          return ok({ headers, rows, total: dataRows.length });
        }

        case "searchRows": {
          const spreadsheetId = await resolveSpreadsheetId(auth, args.spreadsheetName);
          if (!spreadsheetId) return ok({ error: `Spreadsheet '${args.spreadsheetName}' not found in Drive folder.` });
          const sheetsApi = google.sheets({ version: "v4", auth });
          const headerRow = Math.max(1, args.headerRow ?? 1);
          let resData;
          try {
            resData = await getCachedSheetData(sheetsApi, spreadsheetId, `'${args.tabName}'`);
          } catch (e: any) {
            return ok({ error: `Failed to search rows in tab '${args.tabName}'. Make sure tab exists. Google API Error: ${e.message}` });
          }
          const raw = resData.values ?? [];
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
          const rows = dataRows.map((row: any[], i: number) => {
            const obj: Record<string, string> = { _rowNumber: String(i + headerRow + 1) };
            headers.forEach((h, j) => { obj[h] = row[j] ?? ""; });
            return obj;
          }).filter((row: any) => {
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

        case "updateRow": {
          const spreadsheetId = await resolveSpreadsheetId(auth, args.spreadsheetName);
          if (!spreadsheetId) return ok({ error: `Spreadsheet '${args.spreadsheetName}' not found.` });

          let updates: Record<string, any> = {};
          let bgColorUpdates: Record<string, { red: number, green: number, blue: number }> | null = null;
          try {
            updates = typeof args.updates === 'string' ? JSON.parse(args.updates) : args.updates;
            if (args.bgColorUpdates) {
              bgColorUpdates = typeof args.bgColorUpdates === 'string' ? JSON.parse(args.bgColorUpdates) : args.bgColorUpdates;
            }
          } catch (e) {
            return ok({ error: "Invalid JSON provided for updates or bgColorUpdates." });
          }

          const sheetsApi = google.sheets({ version: "v4", auth });
          const rowNum = parseInt(args.rowId);
          if (isNaN(rowNum) || rowNum < 1) return ok({ error: `Invalid rowId: ${args.rowId}` });

          // Read headers to map field names → column indices
          let headerRes;
          try {
            headerRes = await sheetsApi.spreadsheets.values.get({
              spreadsheetId,
              range: `'${args.tabName}'!1:2`,
            });
          } catch (e: any) {
            return ok({ error: `Failed to get headers: ${e.message}` });
          }

          const rawHeaders = headerRes.data.values || [];
          const isClientsSheet = args.spreadsheetName.toLowerCase().includes("clients_sheet");
          const headersRow: string[] = isClientsSheet ? (rawHeaders[1] || []) : (rawHeaders[0] || []);

          // Build unique header list matching getRows logic
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

          // Read the current row values
          let currentRowRes;
          try {
            currentRowRes = await sheetsApi.spreadsheets.values.get({
              spreadsheetId,
              range: `'${args.tabName}'!${rowNum}:${rowNum}`,
            });
          } catch (e: any) {
            return ok({ error: `Failed to read row ${rowNum}: ${e.message}` });
          }

          const currentRow: string[] = currentRowRes.data.values?.[0] ?? [];
          // Merge updates into current row
          const newRow = [...currentRow];
          for (const [key, val] of Object.entries(updates)) {
            const colIdx = headers.indexOf(key);
            if (colIdx >= 0) {
              // Extend array if needed
              while (newRow.length <= colIdx) newRow.push("");
              newRow[colIdx] = String(val ?? "");
            }
          }

          try {
            await sheetsApi.spreadsheets.values.update({
              spreadsheetId,
              range: `'${args.tabName}'!${rowNum}:${rowNum}`,
              valueInputOption: "USER_ENTERED",
              requestBody: { values: [newRow] },
            });

            // Update background colors if provided
            if (bgColorUpdates) {
              const sheetsInfo = await sheetsApi.spreadsheets.get({ spreadsheetId });
              const sheetId = sheetsInfo.data.sheets?.find((s: any) => s.properties?.title === args.tabName)?.properties?.sheetId;
              
              if (sheetId !== undefined) {
                const requests = [];
                for (const [key, color] of Object.entries(bgColorUpdates)) {
                  const colIdx = headers.indexOf(key);
                  if (colIdx >= 0) {
                    requests.push({
                      repeatCell: {
                        range: {
                          sheetId,
                          startRowIndex: rowNum - 1,
                          endRowIndex: rowNum,
                          startColumnIndex: colIdx,
                          endColumnIndex: colIdx + 1,
                        },
                        cell: {
                          userEnteredFormat: {
                            backgroundColor: color
                          }
                        },
                        fields: "userEnteredFormat.backgroundColor"
                      }
                    });
                  }
                }
                
                if (requests.length > 0) {
                  await sheetsApi.spreadsheets.batchUpdate({
                    spreadsheetId,
                    requestBody: { requests },
                  });
                }
              }
            }
          } catch (e: any) {
            return ok({ error: `Failed to update row ${rowNum} in tab '${args.tabName}': ${e.message}` });
          }

          return ok({ success: true, message: `Row ${rowNum} updated in '${args.tabName}'.` });
        }
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

      case "getYearlyRevenue": {
        const spreadsheetId = await resolveSpreadsheetId(auth, args.spreadsheetName);
        if (!spreadsheetId) return ok({ error: `Spreadsheet '${args.spreadsheetName}' not found.` });
        const sheetsApi = google.sheets({ version: "v4", auth });
        
        try {
          const res = await sheetsApi.spreadsheets.get({ spreadsheetId });
          const allTabs = res.data.sheets?.map(s => s.properties?.title).filter(Boolean) || [];
          const yearTabs = allTabs.filter(t => t?.endsWith(`_${args.year}`));
          
          if (yearTabs.length === 0) return ok({ error: `No tabs found for year ${args.year}` });
          
          const ranges = yearTabs.map(t => `'${t}'!A3:D`); // Client Name, SOW, Budget Hours, Hourly Rate
          const batchRes = await sheetsApi.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges,
          });
          
          let totalRevenue = 0;
          const monthlyBreakdown: Record<string, number> = {};
          
          batchRes.data.valueRanges?.forEach((range, idx) => {
            const tabName = yearTabs[idx] as string;
            let monthRevenue = 0;
            
            range.values?.forEach(row => {
              const clientName = row[0];
              const budgetHours = parseFloat(row[2]);
              const hourlyRate = parseFloat(row[3]);
              
              if (clientName && !isNaN(budgetHours) && !isNaN(hourlyRate) && budgetHours > 0 && hourlyRate > 0) {
                monthRevenue += (budgetHours * hourlyRate);
              }
            });
            
            monthlyBreakdown[tabName] = monthRevenue;
            totalRevenue += monthRevenue;
          });
          
          return ok({ 
            year: args.year,
            totalYtdRevenue: totalRevenue,
            monthlyBreakdown
          });
        } catch (e: any) {
          return ok({ error: `Failed to calculate yearly revenue: ${e.message}` });
        }
      }

      case "getTopClients": {
        const spreadsheetId = await resolveSpreadsheetId(auth, args.spreadsheetName);
        if (!spreadsheetId) return ok({ error: `Spreadsheet '${args.spreadsheetName}' not found.` });
        const sheetsApi = google.sheets({ version: "v4", auth });
        const limit = args.limit || 10;
        
        try {
          const res = await sheetsApi.spreadsheets.get({ spreadsheetId });
          const allTabs = res.data.sheets?.map(s => s.properties?.title).filter(Boolean) || [];
          
          let targetTabs = [];
          if (args.month) {
            const exactTab = `${args.month}_${args.year}`;
            if (allTabs.includes(exactTab)) targetTabs.push(exactTab);
          } else {
            targetTabs = allTabs.filter(t => t?.endsWith(`_${args.year}`));
          }
          
          if (targetTabs.length === 0) return ok({ error: `No tabs found for the specified criteria.` });
          
          const ranges = targetTabs.map(t => `'${t}'!A3:D`);
          const batchRes = await sheetsApi.spreadsheets.values.batchGet({
            spreadsheetId,
            ranges,
          });
          
          const clientTotals: Record<string, { budgetHours: number, revenue: number }> = {};
          
          batchRes.data.valueRanges?.forEach(range => {
            range.values?.forEach(row => {
              const clientName = row[0];
              const budgetHours = parseFloat(row[2]);
              const hourlyRate = parseFloat(row[3]);
              
              if (clientName && !isNaN(budgetHours) && budgetHours > 0) {
                if (!clientTotals[clientName]) {
                  clientTotals[clientName] = { budgetHours: 0, revenue: 0 };
                }
                clientTotals[clientName].budgetHours += budgetHours;
                if (!isNaN(hourlyRate) && hourlyRate > 0) {
                  clientTotals[clientName].revenue += (budgetHours * hourlyRate);
                }
              }
            });
          });
          
          const sortedClients = Object.entries(clientTotals)
            .sort((a, b) => b[1].budgetHours - a[1].budgetHours)
            .slice(0, limit)
            .map(([name, data]) => ({
              clientName: name,
              totalBudgetHours: data.budgetHours,
              totalRevenue: data.revenue
            }));
            
          return ok({ 
            criteria: { year: args.year, month: args.month || "All" },
            topClients: sortedClients
          });
        } catch (e: any) {
          return ok({ error: `Failed to get top clients: ${e.message}` });
        }
      }

      case "getStaffUtilizationOverservice": {
        const spreadsheetNames: string[] = args.spreadsheetNames ?? [];
        const monthCount: number = args.monthCount ?? 6;
        const threshold: number = args.threshold ?? 120;
        const minMonths: number = args.minMonths ?? 3;

        if (spreadsheetNames.length === 0) {
          return ok({ error: "spreadsheetNames is required and must not be empty." });
        }

        // Known tab name patterns for Staff Utilization sheets (short form preferred)
        const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const MONTH_LONG  = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

        // Build the last N year-month combos (most recent first)
        const now = new Date();
        const recentMonths: Array<{ year: number; monthIdx: number }> = [];
        for (let i = 0; i < monthCount; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          recentMonths.push({ year: d.getFullYear(), monthIdx: d.getMonth() }); // monthIdx 0-based
        }

        // Helper: given real tab list and a desired month/year, find the matching tab name
        function resolveTabName(tabs: string[], monthIdx: number, year: number): string | null {
          const short = MONTH_SHORT[monthIdx];
          const longM = MONTH_LONG[monthIdx];
          const candidates = [
            `${short}${year}`,
            `${longM}${year}`,
            `${short} ${year}`,
            `${longM} ${year}`,
            `${short}_${year}`,
            `${longM}_${year}`,
          ];
          for (const c of candidates) {
            const match = tabs.find(t => t.toLowerCase() === c.toLowerCase());
            if (match) return match;
          }
          return null;
        }

        // Parse percentage string like "120%" or "120" → number
        function parsePct(val: string | undefined): number | null {
          if (!val) return null;
          const n = parseFloat(val.replace(/[^0-9.\-]/g, ""));
          return isNaN(n) ? null : n;
        }

        // ── Step 1: Resolve all spreadsheet IDs in parallel ──────────────────
        const sheetsApi = google.sheets({ version: "v4", auth });

        const resolvedSheets = await Promise.all(
          spreadsheetNames.map(async (name) => {
            const id = await resolveSpreadsheetId(auth, name);
            return { name, id };
          })
        );

        const notFound = resolvedSheets.filter(s => !s.id).map(s => s.name);
        const found = resolvedSheets.filter(s => !!s.id) as Array<{ name: string; id: string }>;

        if (found.length === 0) {
          return ok({ error: `None of the requested spreadsheets were found. Not found: ${notFound.join(", ")}` });
        }

        // ── Step 2: Get real tab names for each sheet (parallel) ──────────────
        const sheetTabsArr = await Promise.all(
          found.map(async (s) => {
            try {
              const res = await sheetsApi.spreadsheets.get({ spreadsheetId: s.id });
              const tabs = (res.data.sheets ?? []).map((sh: any) => sh.properties?.title as string).filter(Boolean);
              return { ...s, tabs };
            } catch (e: any) {
              return { ...s, tabs: [] as string[], error: e.message };
            }
          })
        );

        // ── Step 3: For each sheet × each recent month, build batch ranges ────
        // Staff Utilization sheets: overservice client table starts at row 21 (row 20 = header)
        // Columns: A=Client, B=Supervisor, C=Client Lead, D=OVER/UNDER %, E=Budget Hrs, F=15hrs, G=Real Hrs
        // We read rows 20:200 to capture the client table header + all client rows
        const batchRequests: Array<{
          sheetInfo: { name: string; id: string; tabs: string[] };
          month: { year: number; monthIdx: number };
          tabName: string;
          ranges: string[];
        }> = [];

        for (const sheetInfo of sheetTabsArr) {
          for (const month of recentMonths) {
            const tabName = resolveTabName(sheetInfo.tabs, month.monthIdx, month.year);
            if (!tabName) continue; // tab doesn't exist yet for this month
            batchRequests.push({
              sheetInfo,
              month,
              tabName,
              ranges: [`'${tabName}'!A20:H200`], // overservice client table
            });
          }
        }

        if (batchRequests.length === 0) {
          return ok({
            message: "No matching month tabs found in the provided sheets.",
            notFound,
            analyzedSheets: found.map(s => s.name),
          });
        }

        // ── Step 4: Batch fetch all needed ranges (parallel per sheet) ────────
        const fetchResults: Array<{
          sheetName: string;
          monthLabel: string;
          rows: string[][];
        }> = [];

        // Group batch requests by spreadsheet to use batchGet efficiently
        const bySheet = new Map<string, typeof batchRequests>();
        for (const req of batchRequests) {
          const key = req.sheetInfo.id;
          if (!bySheet.has(key)) bySheet.set(key, []);
          bySheet.get(key)!.push(req);
        }

        await Promise.all(
          Array.from(bySheet.entries()).map(async ([spreadsheetId, reqs]) => {
            const ranges = reqs.map(r => r.ranges[0]);
            try {
              const batchRes = await sheetsApi.spreadsheets.values.batchGet({
                spreadsheetId,
                ranges,
                valueRenderOption: "FORMATTED_VALUE",
              });
              (batchRes.data.valueRanges ?? []).forEach((vr, idx) => {
                const req = reqs[idx];
                const monthLabel = `${MONTH_SHORT[req.month.monthIdx]}${req.month.year}`;
                fetchResults.push({
                  sheetName: req.sheetInfo.name,
                  monthLabel,
                  rows: (vr.values ?? []) as string[][],
                });
              });
            } catch (e: any) {
              // Record fetch failure without killing whole operation
              for (const req of reqs) {
                const monthLabel = `${MONTH_SHORT[req.month.monthIdx]}${req.month.year}`;
                fetchResults.push({ sheetName: req.sheetInfo.name, monthLabel, rows: [] });
              }
            }
          })
        );

        // ── Step 5: Analyse — find accounts exceeding threshold in ≥ minMonths ─
        // Key: "sheetName::clientName" → Map<monthLabel, pct>
        const accountMonthData = new Map<string, Map<string, number>>();

        for (const { sheetName, monthLabel, rows } of fetchResults) {
          if (rows.length === 0) continue;

          // Dynamically find the header row and column indices
          let clientIdx = -1;
          let overUnderIdx = -1;
          let headerRowIdx = -1;

          for (let r = 0; r < Math.min(5, rows.length); r++) {
            for (let c = 0; c < rows[r].length; c++) {
              const h = (rows[r][c] ?? "").toString().toUpperCase().trim();
              if (h === "CLIENT" || h === "CLIENT NAME") {
                clientIdx = c;
                headerRowIdx = r;
              }
              if (h === "OVER/ UNDER" || h === "OVER/UNDER" || h.includes("OVER/UNDER")) {
                overUnderIdx = c;
              }
            }
            if (clientIdx !== -1) break;
          }

          // Fallbacks if headers not found exactly
          if (clientIdx === -1) clientIdx = 1; // Column B
          if (overUnderIdx === -1) overUnderIdx = 4; // Column E
          if (headerRowIdx === -1) headerRowIdx = 0;

          const dataRows = rows.slice(headerRowIdx + 1);

          for (const row of dataRows) {
            const clientName = (row[clientIdx] ?? "").trim();
            if (!clientName || clientName === "" || clientName.toUpperCase() === "CLIENT" || clientName.toUpperCase() === "CLIENT NAME") continue;

            const pctVal = parsePct(row[overUnderIdx]);
            if (pctVal === null) continue;
            if (pctVal <= threshold) continue; // only interested in exceeded entries

            const key = `${sheetName}::${clientName}`;
            if (!accountMonthData.has(key)) accountMonthData.set(key, new Map());
            accountMonthData.get(key)!.set(monthLabel, pctVal);
          }
        }

        // Filter to accounts exceeding threshold in ≥ minMonths months
        const overserviceAccounts: Array<{
          sheet: string;
          client: string;
          monthsExceeded: number;
          monthBreakdown: Record<string, number>;
          avgOverservice: number;
        }> = [];

        for (const [key, monthMap] of accountMonthData.entries()) {
          if (monthMap.size < minMonths) continue;
          const [sheet, client] = key.split("::", 2);
          const breakdown: Record<string, number> = {};
          let total = 0;
          for (const [m, pct] of monthMap.entries()) {
            breakdown[m] = pct;
            total += pct;
          }
          overserviceAccounts.push({
            sheet,
            client,
            monthsExceeded: monthMap.size,
            monthBreakdown: breakdown,
            avgOverservice: Math.round(total / monthMap.size),
          });
        }

        // Sort: most months exceeded first, then highest avg
        overserviceAccounts.sort((a, b) => b.monthsExceeded - a.monthsExceeded || b.avgOverservice - a.avgOverservice);

        return ok({
          summary: {
            sheetsAnalyzed: found.map(s => s.name),
            sheetsNotFound: notFound,
            monthsChecked: recentMonths.map(m => `${MONTH_SHORT[m.monthIdx]}${m.year}`),
            threshold: `>${threshold}%`,
            minMonthsRequired: minMonths,
            totalAccountsOverservice: overserviceAccounts.length,
          },
          overserviceAccounts,
        });
      }

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
