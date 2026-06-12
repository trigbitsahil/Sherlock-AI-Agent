import { getDriveClient } from "./auth";

/**
 * Searches for all Google Spreadsheets accessible by the Service Account.
 */
export async function searchSpreadsheets(query: string = "") {
  const drive = await getDriveClient();
  
  // MimeType for Google Sheets
  let q = "mimeType='application/vnd.google-apps.spreadsheet'";
  
  // If the user provides a query to search by name
  if (query) {
    q += ` and name contains '${query}'`;
  }
  
  // Service accounts usually don't have their own "My Drive" clutter, 
  // they primarily see files shared with them.
  const response = await drive.files.list({
    q,
    fields: "files(id, name, webViewLink, createdTime, modifiedTime)",
    orderBy: "modifiedTime desc",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  
  return response.data.files || [];
}
