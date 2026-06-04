import { NextResponse } from "next/server";
import { mcpClient } from "@/mcp/client";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    // Expected structure:
    // {
    //   months: string[],
    //   clientType: string,
    //   clientName: string,
    //   accountLead: string,
    //   teamHours: Record<string, Record<string, number>>, // { month: { team: hours } }
    //   hourlyRates: Record<string, number>
    // }

    for (const month of data.months) {
      const teamsObj = data.teamHours[month];
      if (!teamsObj) continue;

      for (const team of Object.keys(teamsObj)) {
        const hours = parseFloat(teamsObj[team] as any);
        if (isNaN(hours) || hours <= 0) continue;

        const rowData = {
          "Client Name": data.clientName,
          "SOW Link": "Retainer", // Ignored for now per instruction, but we should fill dummy or skip. Will leave empty or set text.
          "Client Type": data.clientType,
          "Teams": team,
          "Account Lead": data.accountLead && data.accountLead.trim() !== '' ? data.accountLead : "N/A",
          "Budget Allocation": hours,
          "Hourly Rate": data.hourlyRates[month] || ""
        };

        await mcpClient.callTool("createRow", {
          spreadsheetName: "Services Lookup Sheet",
          tabName: month,
          data: JSON.stringify(rowData)
        });
      }
    }

    return NextResponse.json({ success: true, message: `Successfully allocated teams for ${data.clientName}.` });
    
  } catch (error: any) {
    console.error("[API/Services/Submit Error]", error);
    return NextResponse.json({ error: error.message || "Failed to submit service allocation" }, { status: 500 });
  }
}
