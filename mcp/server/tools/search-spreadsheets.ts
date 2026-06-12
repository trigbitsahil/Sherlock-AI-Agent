import { z } from "zod";
import { searchSpreadsheets } from "../google/drive-client";

export const searchSpreadsheetsInputSchema = z.object({
  query: z
    .string()
    .optional()
    .describe("Optional search query to filter spreadsheets by name"),
});

export type SearchSpreadsheetsInput = z.infer<typeof searchSpreadsheetsInputSchema>;

export async function searchSpreadsheetsHandler(input: SearchSpreadsheetsInput) {
  const { query } = input;

  try {
    const files = await searchSpreadsheets(query);
    return {
      success: true,
      count: files.length,
      spreadsheets: files,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Failed to search spreadsheets",
    };
  }
}
