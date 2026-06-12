import { z } from "zod";
import { getDriveClient } from "../google/auth";
import { getSpreadsheetInfo } from "../google/sheets-client";

export const listSpreadsheetsInputSchema = z.object({
  folderId: z
    .string()
    .optional()
    .describe("Google Drive folder ID to list spreadsheets from. If omitted, uses env-configured spreadsheet IDs."),
  includeDetails: z
    .boolean()
    .optional()
    .default(false)
    .describe("Whether to fetch sheet tab details for each spreadsheet"),
});

export type ListSpreadsheetsInput = z.infer<typeof listSpreadsheetsInputSchema>;

export async function listSpreadsheetsHandler(input: ListSpreadsheetsInput) {
  const { folderId, includeDetails = false } = input;

  try {
    const drive = await getDriveClient();

    let spreadsheets: Array<{ id: string; name: string }> = [];
    let results: Array<{ folderName: string; spreadsheets: Array<{ id: string; name: string }> }> = [];

    if (folderId) {
      console.log(`[MCP] Listing folders and spreadsheets from Google Drive folder ID: ${folderId}`);

      async function listFolderRecursive(currentFolderId: string, folderName: string) {
        console.log(`[Drive] Scanning folder: ${folderName} (${currentFolderId})`);
        
        // 1. Fetch spreadsheets in this folder
        const filesResponse = await drive.files.list({
          q: `'${currentFolderId}' in parents and (mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') and trashed=false`,
          fields: "files(id,name)",
        });
        
        const files = filesResponse.data.files || [];
        if (files.length > 0) {
          results.push({
            folderName: folderName === "Root" ? "Main Folder" : folderName,
            spreadsheets: files.map(f => ({ id: f.id || "", name: f.name || "" }))
          });
        }

        // 2. Fetch subfolders
        const subfolderResponse = await drive.files.list({
          q: `'${currentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: "files(id,name)",
        });
        
        const subfolders = subfolderResponse.data.files || [];
        for (const subfolder of subfolders) {
          if (subfolder.id) {
            await listFolderRecursive(subfolder.id, subfolder.name || "Subfolder");
          }
        }
      }

      try {
        await listFolderRecursive(folderId, "Root");
      } catch (err: any) {
        console.error("[MCP Error] Recursive listing failed:", err);
        // Fallback: just list root
        const rootFilesResponse = await drive.files.list({
          q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
          fields: "files(id,name)",
        });
        results.push({
          folderName: "All Spreadsheets",
          spreadsheets: (rootFilesResponse.data.files || []).map(f => ({ id: f.id || "", name: f.name || "" }))
        });
      }

      spreadsheets = results.flatMap(g => g.spreadsheets);
      console.log(`[MCP] Found ${spreadsheets.length} spreadsheets in ${results.length} groups.`);
      
    } else {
      console.log("[MCP] No folderId provided, listing all accessible spreadsheets globally.");
      // Global search for all spreadsheets accessible to the service account
      const filesResponse = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: "files(id,name)",
        pageSize: 100, // Fetch up to 100 to ensure we get the shared ones
      });
      
      spreadsheets = (filesResponse.data.files || []).map(f => ({ id: f.id || "", name: f.name || "" }));
      results.push({
        folderName: "All Accessible Spreadsheets",
        spreadsheets
      });
      console.log(`[MCP] Found ${spreadsheets.length} spreadsheets globally.`);
    }

    // Return the response early if we are not fetching details
    if (!includeDetails) {
      return {
        success: true,
        groups: results,
        spreadsheets: spreadsheets,
        totalGroups: results.length,
        totalSpreadsheets: spreadsheets.length,
        note: "Use listSheets tool to see tabs inside each spreadsheet",
      };
    }

    // Optionally fetch details for each spreadsheet
    if (includeDetails) {
      const detailed = await Promise.all(
        spreadsheets.map(async (s) => {
          try {
            const info = await getSpreadsheetInfo(s.id);
            return {
              id: s.id,
              name: info.title || s.name,
              url: info.spreadsheetUrl,
              sheets: info.sheets.map((sh) => sh.title),
              totalSheets: info.sheets.length,
            };
          } catch {
            return { id: s.id, name: s.name, error: "Could not fetch details" };
          }
        })
      );
      return { success: true, totalSpreadsheets: detailed.length, spreadsheets: detailed };
    }

    return {
      success: true,
      totalSpreadsheets: spreadsheets.length,
      spreadsheets,
      note: "Use listSheets tool to see tabs inside each spreadsheet",
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to list spreadsheets",
    };
  }
}
