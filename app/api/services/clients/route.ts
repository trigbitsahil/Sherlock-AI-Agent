import { NextResponse } from "next/server";
import { mcpClient } from "@/mcp/client";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { months, clientType } = data; // months: string[], clientType: string

    if (!months || months.length === 0 || !clientType) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    const monthData: Record<string, any[]> = {};
    
    // 1. Fetch rows for all requested months
    for (const month of months) {
      try {
        const result = await mcpClient.callTool("getRows", {
          spreadsheetName: "Clients_Sheet",
          tabName: month,
          headerRow: 2,
          limit: 500
        });

        const text = result.content
          .filter((c: any) => c.type === "text")
          .map((c: any) => c.text)
          .join("\n");
          
        let rows: any[] = [];
        try {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            rows = parsed;
          } else if (parsed && Array.isArray(parsed.rows)) {
            rows = parsed.rows;
          } else if (parsed && typeof parsed === 'object') {
            rows = [parsed];
          }
        } catch(e) {}
        
        monthData[month] = rows;
      } catch (err) {
        console.log(`Error fetching ${month}`, err);
        monthData[month] = [];
      }
    }

    // 2. Determine column mappings based on Client Type
    let nameCol = "Client Name";
    let hoursCol = "Budget Hours";
    let rateCol = "Hourly Rate";

    if (clientType === "Internal") {
      nameCol = "Client Name_1";
      hoursCol = "Budget Hours_1";
      rateCol = "Hourly Rate_1";
    } else if (clientType === "Pro Bono") {
      nameCol = "Client Name_2";
      hoursCol = "Budget Hours_2";
      rateCol = "Hourly Rate_2";
    }

    // 3. Find intersection of clients across all months
    const clientStats: Record<string, Record<string, { budgetHours: number, hourlyRate: number }>> = {};
    
    const clientsPerMonth = months.map(m => {
      const rows = monthData[m];
      const validClients = new Map<string, any>();
      rows.forEach(r => {
        const name = r[nameCol];
        if (name && typeof name === 'string' && name.trim() !== '') {
          validClients.set(name.trim(), r);
        }
      });
      return validClients;
    });

    if (clientsPerMonth.length === 0) {
      return NextResponse.json({ clients: {} });
    }

    // Intersect keys
    let commonNames = Array.from(clientsPerMonth[0].keys());
    for (let i = 1; i < clientsPerMonth.length; i++) {
      const currentMap = clientsPerMonth[i];
      commonNames = commonNames.filter(n => currentMap.has(n));
    }

    // Build response object
    for (const name of commonNames) {
      clientStats[name] = {};
      for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const row = clientsPerMonth[i].get(name);
        
        const bHours = parseFloat(row[hoursCol]) || 0;
        const hRate = parseFloat(row[rateCol]) || 0;
        
        clientStats[name][month] = {
          budgetHours: bHours,
          hourlyRate: hRate
        };
      }
    }

    return NextResponse.json({ clients: clientStats });
    
  } catch (error: any) {
    console.error("[API/Services/Clients Error]", error);
    return NextResponse.json({ error: error.message || "Failed to fetch clients" }, { status: 500 });
  }
}
