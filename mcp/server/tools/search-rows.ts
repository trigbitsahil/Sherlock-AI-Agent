import { z } from "zod";
import { searchRowsInSheet } from "../google/sheets-client";

export const searchRowsInputSchema = z.object({
  spreadsheetId: z.string().describe("The Google Spreadsheet ID"),
  sheetName: z.string().describe("The tab/sheet name to search in"),
  query: z.string().describe("Search query string (case-insensitive)"),
  searchColumns: z
    .array(z.string())
    .optional()
    .describe("Limit search to specific column names. If omitted, searches all columns."),
  maxResults: z
    .number()
    .optional()
    .default(50)
    .describe("Maximum number of matching rows to return"),
});

export type SearchRowsInput = z.infer<typeof searchRowsInputSchema>;

export async function searchRowsHandler(input: SearchRowsInput) {
  const { spreadsheetId, sheetName, query, searchColumns, maxResults = 50 } = input;

  try {
    const matches = await searchRowsInSheet(
      spreadsheetId,
      sheetName,
      query,
      searchColumns
    );

    const limitedMatches = matches.slice(0, maxResults);

    return {
      success: true,
      spreadsheetId,
      sheetName,
      query,
      searchColumns: searchColumns || "all columns",
      totalMatches: matches.length,
      returnedMatches: limitedMatches.length,
      truncated: matches.length > limitedMatches.length,
      matches: limitedMatches,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to search rows",
      spreadsheetId,
      sheetName,
      query,
    };
  }
}
