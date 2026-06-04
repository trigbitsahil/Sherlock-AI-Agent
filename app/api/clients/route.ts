import { NextResponse } from "next/server";
import { mcpClient } from "@/mcp/client";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // Check if client exists in ANY of the selected month tabs
    for (const month of data.months) {
      try {
        const result = await mcpClient.callTool("searchRows", {
          spreadsheetName: "Clients_Sheet",
          tabName: month,
          query: data.clientName
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
        
        const exists = rows.some((r: any) => {
          const flat = JSON.stringify(r).toLowerCase();
          return flat.includes(data.clientName.toLowerCase());
        });
        
        if (exists) {
          return NextResponse.json({ error: `Client "${data.clientName}" already exists in the ${month} tab. Submission blocked.` }, { status: 400 });
        }
      } catch (err: any) {
        return NextResponse.json({ error: `Validation failed: ${err.message}` }, { status: 500 });
      }
    }
    
    // Insert into each month
    for (const month of data.months) {
      const bHours = data.budgetHours[month];
      
      let rowData: any = {};
      const sowHyperlink = `=HYPERLINK("${data.sowLink}", "${data.sow}")`;
      
      if (data.clientType === "Billable") {
        rowData = {
          "Client Name": data.clientName,
          "SOW": sowHyperlink,
          "Budget Hours": bHours,
          "Hourly Rate": data.hourlyRate
        };
      } else if (data.clientType === "Internal") {
        rowData = {
          "Client Name_1": data.clientName,
          "SOW_1": sowHyperlink,
          "Budget Hours_1": bHours,
          "Hourly Rate_1": data.hourlyRate
        };
      } else if (data.clientType === "Pro Bono") {
        rowData = {
          "Client Name_2": data.clientName,
          "SOW_2": sowHyperlink,
          "Budget Hours_2": bHours,
          "Hourly Rate_2": data.hourlyRate
        };
      }
      
      await mcpClient.callTool("createRow", {
        spreadsheetName: "Clients_Sheet",
        tabName: month,
        data: JSON.stringify(rowData)
      });
    }
    
    return NextResponse.json({ success: true });
    
  } catch (error: any) {
    console.error("[API/Clients Error]", error);
    return NextResponse.json({ error: error.message || "Failed to add client" }, { status: 500 });
  }
}
