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
    // Use env-configured folder ID or spreadsheet IDs
    const envFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    
    // Determine which folder to list from
    const targetFolderId = folderId || envFolderId;

    let spreadsheets: Array<{ id: string; name: string }> = [];

    if (targetFolderId) {
      console.log(`[MCP] Listing folders and spreadsheets from Google Drive folder ID: ${targetFolderId}`);
      const drive = await getDriveClient();

      const results: Array<{ folderName: string; spreadsheets: Array<{ id: string; name: string }> }> = [];

      async function listFolderRecursive(folderId: string, folderName: string) {
        console.log(`[Drive] Scanning folder: ${folderName} (${folderId})`);
        
        // 1. Fetch spreadsheets in this folder
        const filesResponse = await drive.files.list({
          q: `'${folderId}' in parents and (mimeType='application/vnd.google-apps.spreadsheet' or mimeType='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') and trashed=false`,
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
          q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
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
        await listFolderRecursive(targetFolderId, "Root");
      } catch (err: any) {
        console.error("[MCP Error] Recursive listing failed:", err);
        // Fallback: just list root
        const rootFilesResponse = await drive.files.list({
          q: `'${targetFolderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
          fields: "files(id,name)",
        });
        results.push({
          folderName: "All Spreadsheets",
          spreadsheets: (rootFilesResponse.data.files || []).map(f => ({ id: f.id || "", name: f.name || "" }))
        });
      }

      const flatSpreadsheets = results.flatMap(g => g.spreadsheets);
      console.log(`[MCP] Found ${flatSpreadsheets.length} spreadsheets in ${results.length} groups.`);
      
      return {
        success: true,
        groups: results,
        spreadsheets: flatSpreadsheets,
        totalGroups: results.length,
        totalSpreadsheets: flatSpreadsheets.length
      };
    } else {
      console.error("[MCP Error] No targetFolderId found in arguments or environment.");
      return {
        success: false,
        error:
          "No Google Drive Folder ID configured. Set GOOGLE_DRIVE_FOLDER_ID in .env or provide a folderId in the tool call.",
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
