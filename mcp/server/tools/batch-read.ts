import { z } from "zod";
import { batchReadRanges } from "../google/sheets-client";

export const batchReadInputSchema = z.object({
  spreadsheetId: z.string().describe("The Google Spreadsheet ID"),
  ranges: z
    .array(
      z.object({
        sheetName: z.string().describe("The tab/sheet name"),
        range: z.string().default("A:ZZ").describe("A1 notation range"),
        alias: z
          .string()
          .optional()
          .describe("Optional alias label for this range in the response"),
      })
    )
    .min(1)
    .max(10)
    .describe("List of ranges to read simultaneously (max 10)"),
});

export type BatchReadInput = z.infer<typeof batchReadInputSchema>;

export async function batchReadHandler(input: BatchReadInput) {
  const { spreadsheetId, ranges } = input;

  try {
    const fullRanges = ranges.map(
      (r) => `${r.sheetName}!${r.range}`
    );

    const results = await batchReadRanges(spreadsheetId, fullRanges);

    return {
      success: true,
      spreadsheetId,
      totalRanges: ranges.length,
      results: results.map((result, i) => ({
        alias: ranges[i].alias || ranges[i].sheetName,
        sheetName: ranges[i].sheetName,
        range: ranges[i].range,
        headers: result.headers,
        rows: result.rows,
        rowCount: result.rows.length,
      })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to batch read ranges",
      spreadsheetId,
    };
  }
}
