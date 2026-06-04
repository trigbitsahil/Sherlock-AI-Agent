import { z } from "zod";
import { filterSheetRows, FilterCondition } from "../google/sheets-client";

export const filterDataInputSchema = z.object({
  spreadsheetId: z.string().describe("The Google Spreadsheet ID"),
  sheetName: z.string().describe("The tab/sheet name to filter"),
  filters: z
    .array(
      z.object({
        column: z.string().describe("The column header name to filter on"),
        value: z
          .string()
          .default("")
          .describe("The value to compare against (not needed for notEmpty/empty operators)"),
        operator: z
          .enum(["equals", "contains", "startsWith", "gt", "lt", "notEmpty", "empty"])
          .describe(
            "Filter operator: equals, contains, startsWith, gt (greater than), lt (less than), notEmpty, empty"
          ),
      })
    )
    .describe("List of filter conditions (AND logic applied between conditions)"),
  maxResults: z
    .number()
    .optional()
    .default(100)
    .describe("Maximum rows to return"),
});

export type FilterDataInput = z.infer<typeof filterDataInputSchema>;

export async function filterDataHandler(input: FilterDataInput) {
  const { spreadsheetId, sheetName, filters, maxResults = 100 } = input;

  try {
    const results = await filterSheetRows(
      spreadsheetId,
      sheetName,
      filters as FilterCondition[]
    );

    const limited = results.slice(0, maxResults);

    return {
      success: true,
      spreadsheetId,
      sheetName,
      appliedFilters: filters,
      totalMatched: results.length,
      returnedRows: limited.length,
      truncated: results.length > limited.length,
      rows: limited.map((r) => ({ rowIndex: r.rowIndex, data: r.data })),
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to filter data",
      spreadsheetId,
      sheetName,
    };
  }
}
