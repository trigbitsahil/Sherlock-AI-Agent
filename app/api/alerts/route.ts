import { NextResponse } from "next/server";
import { google } from "googleapis";
import { getGoogleAuth } from "@/mcp/server/google/auth";

// Folders to skip entirely when scanning for team spreadsheets
const ADMIN_FOLDERS = new Set([
  "Client Sheet",
  "Work Trackers",
  "Service  Sheet",
  "Document",
  "test sheets",
  "Billable Sheets",
]);

const MONTHS = new Set([
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
]);

function isMonthlyTab(tabTitle: string): boolean {
  const [month, year] = tabTitle.split("_");
  return !!(MONTHS.has(month) && year && /^\d{4}$/.test(year));
}

function parsePct(val: string): number {
  return parseFloat(val.replace(/[%,\s]/g, ""));
}

function severity(pct: number): string {
  if (pct >= 150) return "critical";
  if (pct >= 120) return "high";
  return "warning";
}

export async function GET() {
  try {
    const auth = getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });
    const sheets = google.sheets({ version: "v4", auth });

    const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!rootFolderId) return NextResponse.json({ error: "GOOGLE_DRIVE_FOLDER_ID not set" }, { status: 500 });

    // Recursively collect all team spreadsheets
    const teamFiles: { id: string; name: string }[] = [];

    const scan = async (folderId: string) => {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and (mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.google-apps.folder') and trashed=false`,
        fields: "files(id, name, mimeType)",
        pageSize: 1000,
      });
      for (const f of res.data.files ?? []) {
        if (!f.id || !f.name) continue;
        if (f.mimeType === "application/vnd.google-apps.spreadsheet") {
          // Include all spreadsheets found inside non-excluded folders
          teamFiles.push({ id: f.id, name: f.name });
        } else if (f.mimeType === "application/vnd.google-apps.folder") {
          // Skip folders whose name is in ADMIN_FOLDERS
          if (!ADMIN_FOLDERS.has(f.name)) {
            await scan(f.id);
          }
        }
      }
    };

    await scan(rootFolderId);

    const alerts: any[] = [];

    for (const file of teamFiles) {
      // Get tabs
      let spreadsheetMeta;
      try {
        spreadsheetMeta = await sheets.spreadsheets.get({
          spreadsheetId: file.id,
          fields: "sheets.properties",
        });
      } catch { continue; }

      const monthTabs = (spreadsheetMeta.data.sheets ?? [])
        .map(s => s.properties?.title ?? "")
        .filter(isMonthlyTab);

      if (monthTabs.length === 0) continue;

      // Batch read all month tabs at once (A:F covers most column layouts)
      const ranges = monthTabs.map(t => `'${t}'!A:F`);
      let batchRes;
      try {
        batchRes = await sheets.spreadsheets.values.batchGet({ spreadsheetId: file.id, ranges });
      } catch { continue; }

      (batchRes.data.valueRanges ?? []).forEach((vr, idx) => {
        const rawRows = (vr.values as string[][] | undefined) ?? [];
        if (rawRows.length < 2) return;

        const month = monthTabs[idx];
        
        // Scan up to first 40 rows to locate the header row (some sheets have headers on row 24+)
        const findCol = (hdrs: string[], keyword1: string, keyword2: string) =>
          hdrs.findIndex(h => {
            const upper = (h ?? "").toUpperCase();
            return upper.includes(keyword1) && upper.includes(keyword2);
          });
        const findClientCol = (hdrs: string[]) =>
          hdrs.findIndex(h => (h ?? "").toLowerCase().includes("client"));

        let headerRowIdx = -1;
        let headers: string[] = [];
        const scanLimit = Math.min(rawRows.length, 40);

        for (let r = 0; r < scanLimit; r++) {
          const row = rawRows[r];
          if (!row || row.length < 2) continue;
          const hdrs = row.map(h => h?.trim() ?? "");
          if (findCol(hdrs, "OVER", "UNDER") !== -1 && findClientCol(hdrs) !== -1) {
            headerRowIdx = r;
            headers = hdrs;
            break;
          }
        }

        if (headerRowIdx === -1) return;

        const overUnderIdx = findCol(headers, "OVER", "UNDER");
        const clientIdx = findClientCol(headers);

        if (overUnderIdx === -1 || clientIdx === -1) return;

        const dataRows = rawRows.slice(headerRowIdx + 1);

        for (const row of dataRows) {
          const client = row[clientIdx]?.trim();
          const overUnderRaw = row[overUnderIdx]?.trim();
          if (!client || !overUnderRaw) continue;

          const pct = parsePct(overUnderRaw);
          if (isNaN(pct) || pct <= 100) continue;

          const excess = (pct - 100).toFixed(0);
          alerts.push({
            id: `${file.name}-${month}-${client}`.replace(/\s+/g, "-").toLowerCase(),
            month,
            team: file.name,
            client,
            overUnder: pct,
            severity: severity(pct),
            message: `${client} exceeded allocated hours by ${excess}% in ${file.name} during ${month.replace("_", " ")}.`,
            createdAt: Date.now(),
          });
        }
      });
    }

    return NextResponse.json({ success: true, alerts });
  } catch (error: any) {
    console.error("[Alerts API] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
