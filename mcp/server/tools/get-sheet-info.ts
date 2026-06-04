import { z } from "zod";
import { readSheetRange, listSheetTabs, getSpreadsheetInfo } from "../google/sheets-client";

export const getSheetInfoInputSchema = z.object({
  spreadsheetId: z.string().describe("The Google Spreadsheet ID"),
  sheetName: z
    .string()
    .optional()
    .describe(
      "Specific tab name to inspect. If omitted, returns info for all tabs."
    ),
  detectSchema: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to detect headers and column schema from first row"),
});

export type GetSheetInfoInput = z.infer<typeof getSheetInfoInputSchema>;

export async function getSheetInfoHandler(input: GetSheetInfoInput) {
  const { spreadsheetId, sheetName, detectSchema = true } = input;

  try {
    const spreadsheetInfo = await getSpreadsheetInfo(spreadsheetId);

    // If specific sheet requested, analyze it deeply
    if (sheetName) {
      const { headers, rows } = await readSheetRange(
        spreadsheetId,
        sheetName,
        "A1:ZZ5" // Read first 5 rows for schema detection
      );

      // Analyze column types from sample data
      const columnAnalysis = headers
        .filter((h) => h.trim())
        .map((header) => {
          const sampleValues = rows
            .map((r) => r[header])
            .filter((v) => v && v.trim());
          const nonEmpty = sampleValues.length;
          const isNumeric = sampleValues.every(
            (v) => !isNaN(parseFloat(v)) && v.trim() !== ""
          );
          const isDate = sampleValues.some((v) =>
            /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(v)
          );
          return {
            header,
            sampleValues: sampleValues.slice(0, 3),
            nonEmptyCount: nonEmpty,
            inferredType: isNumeric ? "number" : isDate ? "date" : "text",
          };
        });

      const sheetMeta = spreadsheetInfo.sheets.find(
        (s) => s.title === sheetName
      );

      return {
        success: true,
        spreadsheetId,
        spreadsheetTitle: spreadsheetInfo.title,
        sheetName,
        rowCount: sheetMeta?.rowCount || 0,
        columnCount: sheetMeta?.columnCount || 0,
        headers,
        columnAnalysis: detectSchema ? columnAnalysis : undefined,
        sampleRows: rows.slice(0, 3),
      };
    }

    // Return overview of all sheets
    return {
      success: true,
      spreadsheetId,
      spreadsheetTitle: spreadsheetInfo.title,
      spreadsheetUrl: spreadsheetInfo.spreadsheetUrl,
      totalSheets: spreadsheetInfo.sheets.length,
      sheets: spreadsheetInfo.sheets,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to get sheet info",
      spreadsheetId,
    };
  }
}
