import { NextResponse } from "next/server";
import { mcpServerInstance } from "@/mcp/server";

export const dynamic = "force-dynamic";

const SERVICES_SHEET = "Services Lookup Sheet";
const CLIENTS_SHEET = "Clients_Sheet";

function parseToolResult(result: any): any {
  try {
    const text = result.content
      .filter((c: any) => c.type === "text")
      .map((c: any) => c.text)
      .join("");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  try {
    if (action === "getTabs") {
      const result = await mcpServerInstance.executeTool("getTabs", { spreadsheetName: SERVICES_SHEET });
      const parsed = parseToolResult(result);
      return NextResponse.json({ tabs: parsed?.tabs || [] });
    }

    if (action === "getRows") {
      const month = url.searchParams.get("month");
      if (!month) return NextResponse.json({ error: "Month required" }, { status: 400 });
      
      const result = await mcpServerInstance.executeTool("getRows", {
        spreadsheetName: SERVICES_SHEET,
        tabName: month,
        limit: 500,
      });
      const parsed = parseToolResult(result);
      return NextResponse.json({ rows: parsed?.rows || [] });
    }

    if (action === "getBudget") {
      const clientName = url.searchParams.get("clientName");
      const tabName = url.searchParams.get("tabName");
      if (!clientName || !tabName) return NextResponse.json({ error: "Missing params" }, { status: 400 });

      const result = await mcpServerInstance.executeTool("searchRows", {
        spreadsheetName: CLIENTS_SHEET,
        tabName: tabName,
        query: clientName,
        headerRow: 2,
      });
      const parsed = parseToolResult(result);
      const rows = parsed?.rows || [];
      const match = rows.find((r: any) => r["Client Name"]?.toLowerCase().trim() === clientName.toLowerCase().trim());
      const budget = match ? parseFloat(match["Budget Allocation"] || match["Budget Hours"] || "0") : 0;
      return NextResponse.json({ budget });
    }

    if (action === "searchAdditionalMonths") {
      const clientName = url.searchParams.get("clientName");
      const team = url.searchParams.get("team");
      const excludeMonth = url.searchParams.get("excludeMonth");
      if (!clientName || !team || !excludeMonth) return NextResponse.json({ error: "Missing params" }, { status: 400 });

      // First get all tabs
      const tabsResult = await mcpServerInstance.executeTool("getTabs", { spreadsheetName: SERVICES_SHEET });
      const parsedTabs = parseToolResult(tabsResult);
      const allTabs: string[] = parsedTabs?.tabs || [];
      const monthTabs = allTabs.filter(t => /^[A-Za-z]+[_]?\d{4}$/.test(t) && t !== excludeMonth);

      const matchingTabs: string[] = [];
      await Promise.all(
        monthTabs.map(async (tab) => {
          try {
            const result = await mcpServerInstance.executeTool("searchRows", {
              spreadsheetName: SERVICES_SHEET,
              tabName: tab,
              query: clientName,
            });
            const parsed = parseToolResult(result);
            const rows = parsed?.rows || [];
            const found = rows.some((r: any) => 
              r["Client Name"]?.toLowerCase().trim() === clientName.toLowerCase().trim() &&
              r["Teams"]?.toLowerCase().trim() === team.toLowerCase().trim()
            );
            if (found) matchingTabs.push(tab);
          } catch {
            // ignore
          }
        })
      );
      return NextResponse.json({ matchingTabs });
    }

    if (action === "searchRowInTab") {
      const clientName = url.searchParams.get("clientName");
      const team = url.searchParams.get("team");
      const tabName = url.searchParams.get("tabName");
      if (!clientName || !team || !tabName) return NextResponse.json({ error: "Missing params" }, { status: 400 });

      const result = await mcpServerInstance.executeTool("searchRows", {
        spreadsheetName: SERVICES_SHEET,
        tabName: tabName,
        query: clientName,
      });
      const parsed = parseToolResult(result);
      const rows = parsed?.rows || [];
      const match = rows.find((r: any) => 
        r["Client Name"]?.toLowerCase().trim() === clientName.toLowerCase().trim() &&
        r["Teams"]?.toLowerCase().trim() === team.toLowerCase().trim()
      );
      return NextResponse.json({ row: match || null });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error: any) {
    console.error("[API/EditServices GET Error]", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { tabName, rowId, updates } = body;

    if (!tabName || !rowId || !updates) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const result = await mcpServerInstance.executeTool("updateRow", {
      spreadsheetName: SERVICES_SHEET,
      tabName,
      rowId,
      updates,
    });
    
    return NextResponse.json({ success: true, result: parseToolResult(result) });
  } catch (error: any) {
    console.error("[API/EditServices POST Error]", error);
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
