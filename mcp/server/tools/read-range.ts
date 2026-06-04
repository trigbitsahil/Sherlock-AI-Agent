import { z } from "zod";
import { readSheetRange } from "../google/sheets-client";

export const readRangeInputSchema = z.object({
  spreadsheetId: z.string().describe("The Google Spreadsheet ID"),
  sheetName: z.string().describe("The tab/sheet name (e.g. 'May 2026', 'Staff Sheet')"),
  range: z
    .string()
    .default("A:ZZ")
    .describe("A1 notation range to read (e.g. 'A1:F50' or 'A:Z'). Defaults to all columns."),
  maxRows: z
    .number()
    .optional()
    .default(1000)
    .describe("Maximum number of data rows to return (excluding header). Max 1000."),
});

export type ReadRangeInput = z.infer<typeof readRangeInputSchema>;

export async function readRangeHandler(input: ReadRangeInput) {
  const { spreadsheetId, sheetName, range, maxRows = 200 } = input;

  try {
    const { headers, rows, rawValues } = await readSheetRange(
      spreadsheetId,
      sheetName,
      range
    );

    const limitedRows = rows.slice(0, Math.min(maxRows, 1000));

    // Detect empty columns
    const nonEmptyHeaders = headers.filter((h) => h.trim() !== "");

    return {
      success: true,
      spreadsheetId,
      sheetName,
      range,
      headers: nonEmptyHeaders,
      rows: limitedRows,
      totalRows: rows.length,
      returnedRows: limitedRows.length,
      truncated: rows.length > limitedRows.length,
      summary: {
        totalDataRows: rows.length,
        columns: nonEmptyHeaders.length,
        hasData: rows.length > 0,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to read range",
      spreadsheetId,
      sheetName,
      range,
    };
  }
}
