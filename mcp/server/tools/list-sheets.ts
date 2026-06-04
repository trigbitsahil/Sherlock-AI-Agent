import { z } from "zod";
import { getSpreadsheetInfo, listSheetTabs } from "../google/sheets-client";

export const listSheetsInputSchema = z.object({
  spreadsheetId: z.string().describe("The Google Spreadsheet ID from its URL"),
});

export type ListSheetsInput = z.infer<typeof listSheetsInputSchema>;

export async function listSheetsHandler(input: ListSheetsInput) {
  const { spreadsheetId } = input;

  try {
    const info = await getSpreadsheetInfo(spreadsheetId);
    return {
      success: true,
      spreadsheetId: info.spreadsheetId,
      title: info.title,
      spreadsheetUrl: info.spreadsheetUrl,
      sheets: info.sheets.map((s) => ({
        id: s.id,
        title: s.title,
        rowCount: s.rowCount,
        columnCount: s.columnCount,
      })),
      totalSheets: info.sheets.length,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to list sheets",
      spreadsheetId,
    };
  }
}
