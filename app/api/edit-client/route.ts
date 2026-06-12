import { NextResponse } from "next/server";
import { mcpServerInstance } from "@/mcp/server";

export const dynamic = "force-dynamic";

// Column mapping per client type (matches Clients_Sheet structure)
const COLUMN_MAP: Record<string, { clientName: string; sow: string; budgetHours: string; hourlyRate: string }> = {
  Billable: { clientName: "Client Name", sow: "SOW", budgetHours: "Budget Hours", hourlyRate: "Hourly Rate" },
  Internal: { clientName: "Client Name_1", sow: "SOW_1", budgetHours: "Budget Hours_1", hourlyRate: "Hourly Rate_1" },
  "Pro Bono": { clientName: "Client Name_2", sow: "SOW_2", budgetHours: "Budget Hours_2", hourlyRate: "Hourly Rate_2" },
};

function parseToolResult(result: any): any[] {
  try {
    const text = result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.rows)) return parsed.rows;
    return [];
  } catch {
    return [];
  }
}

// GET /api/edit-client?clientType=Billable
// Returns all unique client names across all month tabs for the given type.
// Also returns per-month records for a specific client if ?clientName= is provided.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const clientType = url.searchParams.get("clientType") || "Billable";
  const clientName = url.searchParams.get("clientName") || "";

  const cols = COLUMN_MAP[clientType];
  if (!cols) {
    return NextResponse.json({ error: `Unknown clientType: ${clientType}` }, { status: 400 });
  }

  try {
    if (!clientName) {
      // STEP 1: Scan all months, collect unique client names and the tabs they exist in
      const clientTabs = new Map<string, Set<string>>();

      // Fetch all dynamic tabs from Clients_Sheet
      const tabsResult = await mcpServerInstance.executeTool("getTabs", { spreadsheetName: "Clients_Sheet" });
      let MONTH_TABS: string[] = [];
      try {
        const text = tabsResult.content?.[0]?.text;
        if (text) MONTH_TABS = JSON.parse(text).tabs || [];
      } catch (e) {
        console.error("Failed to parse getTabs:", e);
      }

      for (const tab of MONTH_TABS) {
        // Skip template or non-month tabs if they exist (optional, but good practice)
        if (!tab.includes("202")) continue; 
        try {
          const result = await mcpServerInstance.executeTool("getRows", {
            spreadsheetName: "Clients_Sheet",
            tabName: tab,
            headerRow: 2,
            limit: 500,
          });
          const rows = parseToolResult(result);
          for (const row of rows) {
            const name = (row[cols.clientName] || "").trim();
            if (name && name !== "Client Name" && name !== "Billable Clients" &&
                name !== "Internal Clients" && name !== "Pro Bono Clients") {
              if (!clientTabs.has(name)) clientTabs.set(name, new Set());
              clientTabs.get(name)!.add(tab);
            }
          }
        } catch {
          // Tab may not exist — skip silently
        }
      }

      const clients = Array.from(clientTabs.keys()).sort();
      const tabsMap: Record<string, string[]> = {};
      for (const [k, v] of clientTabs.entries()) tabsMap[k] = Array.from(v);

      return NextResponse.json({ clients, clientTabs: tabsMap });
    } else {
      const tabsParam = url.searchParams.get("tabs");
      let MONTH_TABS: string[] = [];
      if (tabsParam) {
        MONTH_TABS = tabsParam.split(",");
      } else {
        // Fallback: Fetch tabs first if not provided
        const tabsResult = await mcpServerInstance.executeTool("getTabs", { spreadsheetName: "Clients_Sheet" });
        try {
          const text = tabsResult.content?.[0]?.text;
          if (text) MONTH_TABS = JSON.parse(text).tabs || [];
        } catch (e) {
          console.error("Failed to parse getTabs:", e);
        }
      }
      const monthRecords: any[] = [];

      for (const tab of MONTH_TABS) {
        if (!tab.includes("202")) continue;
        try {
          const result = await mcpServerInstance.executeTool("getRows", {
            spreadsheetName: "Clients_Sheet",
            tabName: tab,
            headerRow: 2,
            limit: 500,
            valueRenderOption: "FORMULA"
          });
          const rows = parseToolResult(result);
          const match = rows.find((r: any) =>
            (r[cols.clientName] || "").trim().toLowerCase() === clientName.trim().toLowerCase()
          );
          if (match) {
            // Extract SOW text and link from HYPERLINK formula if present
            const rawSow = match[cols.sow] || "";
            const sowLinkMatch = rawSow.match(/=HYPERLINK\("([^"]+)",\s*"([^"]+)"\)/i);
            monthRecords.push({
              tab,
              rowNumber: match._rowNumber,
              clientName: match[cols.clientName] || "",
              sowText: sowLinkMatch ? sowLinkMatch[2] : rawSow,
              sowLink: sowLinkMatch ? sowLinkMatch[1] : "",
              budgetHours: match[cols.budgetHours] || "",
              hourlyRate: match[cols.hourlyRate] || "",
              rawSow,
            });
          }
        } catch {
          // Tab may not exist — skip
        }
      }

      return NextResponse.json({ monthRecords });
    }
  } catch (error: any) {
    console.error("[API/EditClient GET Error]", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}

// POST /api/edit-client
// Body: { clientType, updates: [{ tab, rowNumber, changes: { clientName?, sowText?, sowLink?, budgetHours?, hourlyRate? } }] }
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { clientType, updates } = body as {
      clientType: string;
      updates: Array<{
        tab: string;
        rowNumber: string;
        changes: Record<string, string>;
      }>;
    };

    const cols = COLUMN_MAP[clientType];
    if (!cols) {
      return NextResponse.json({ error: `Unknown clientType: ${clientType}` }, { status: 400 });
    }

    const results: Array<{ tab: string; success: boolean; error?: string }> = [];

    for (const update of updates) {
      // Map friendly field names to actual column names used in the sheet
      const mappedUpdates: Record<string, string> = {};
      if ("clientName" in update.changes) mappedUpdates[cols.clientName] = update.changes.clientName;
      if ("budgetHours" in update.changes) mappedUpdates[cols.budgetHours] = update.changes.budgetHours;
      if ("hourlyRate" in update.changes) mappedUpdates[cols.hourlyRate] = update.changes.hourlyRate;

      // Rebuild SOW hyperlink if sowText or sowLink changed
      let bgColorUpdates: Record<string, any> | undefined = undefined;

      if ("sowText" in update.changes || "sowLink" in update.changes) {
        const sowText = update.changes.sowText ?? "";
        const sowLink = update.changes.sowLink ?? "";
        mappedUpdates[cols.sow] = sowLink
          ? `=HYPERLINK("${sowLink}", "${sowText}")`
          : sowText;

        // Apply specific background colors for Billable clients based on the selected dropdown
        if (clientType === "Billable" && update.changes.sowText) {
          const textLower = update.changes.sowText.toLowerCase();
          if (textLower === "project") {
            // #add8e6 -> RGB(173, 216, 230)
            bgColorUpdates = { [cols.sow]: { red: 173 / 255, green: 216 / 255, blue: 230 / 255 } };
          } else if (textLower === "retainer") {
            // #b7e1cd -> RGB(183, 225, 205)
            bgColorUpdates = { [cols.sow]: { red: 183 / 255, green: 225 / 255, blue: 205 / 255 } };
          }
        }
      }

      if (Object.keys(mappedUpdates).length === 0) {
        results.push({ tab: update.tab, success: true });
        continue;
      }

      try {
        await mcpServerInstance.executeTool("updateRow", {
          spreadsheetName: "Clients_Sheet",
          tabName: update.tab,
          rowId: update.rowNumber,
          updates: JSON.stringify(mappedUpdates),
          ...(bgColorUpdates && { bgColorUpdates: JSON.stringify(bgColorUpdates) })
        });
        results.push({ tab: update.tab, success: true });
      } catch (err: any) {
        results.push({ tab: update.tab, success: false, error: err.message });
      }
    }

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error("[API/EditClient POST Error]", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
