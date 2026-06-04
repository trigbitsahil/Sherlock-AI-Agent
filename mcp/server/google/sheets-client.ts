import { getSheetsClient } from "./auth";
import { sheets_v4 } from "googleapis";

export type SheetRow = Record<string, string>;

/**
 * Reads a range from a Google Sheet and returns structured rows.
 */
export async function readSheetRange(
  spreadsheetId: string,
  sheetName: string,
  range: string
): Promise<{ headers: string[]; rows: SheetRow[]; rawValues: string[][] }> {
  const sheets = await getSheetsClient();
  const fullRange = sheetName ? `${sheetName}!${range}` : range;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: fullRange,
  });

  const rawValues = (response.data.values as string[][]) || [];

  if (rawValues.length === 0) {
    return { headers: [], rows: [], rawValues: [] };
  }

  const headers = rawValues[0].map((h) => h?.trim() || "");
  const rows = rawValues.slice(1).map((row) => {
    const obj: SheetRow = {};
    headers.forEach((header, i) => {
      obj[header] = row[i]?.trim() || "";
    });
    return obj;
  });

  return { headers, rows, rawValues };
}

/**
 * Lists all sheets/tabs within a spreadsheet.
 */
export async function listSheetTabs(spreadsheetId: string): Promise<
  Array<{
    id: number;
    title: string;
    rowCount: number;
    columnCount: number;
  }>
> {
  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "sheets.properties",
  });

  return (response.data.sheets || []).map((sheet) => ({
    id: sheet.properties?.sheetId || 0,
    title: sheet.properties?.title || "",
    rowCount: sheet.properties?.gridProperties?.rowCount || 0,
    columnCount: sheet.properties?.gridProperties?.columnCount || 0,
  }));
}

/**
 * Gets spreadsheet metadata (title, URL, sheet list).
 */
export async function getSpreadsheetInfo(spreadsheetId: string): Promise<{
  title: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  sheets: Array<{ id: number; title: string; rowCount: number; columnCount: number }>;
}> {
  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: "spreadsheetId,properties.title,spreadsheetUrl,sheets.properties",
  });

  return {
    title: response.data.properties?.title || "",
    spreadsheetId: response.data.spreadsheetId || spreadsheetId,
    spreadsheetUrl: response.data.spreadsheetUrl || "",
    sheets: (response.data.sheets || []).map((sheet) => ({
      id: sheet.properties?.sheetId || 0,
      title: sheet.properties?.title || "",
      rowCount: sheet.properties?.gridProperties?.rowCount || 0,
      columnCount: sheet.properties?.gridProperties?.columnCount || 0,
    })),
  };
}

/**
 * Batch reads multiple ranges at once (efficient API usage).
 */
export async function batchReadRanges(
  spreadsheetId: string,
  ranges: string[]
): Promise<Array<{ range: string; headers: string[]; rows: SheetRow[] }>> {
  const sheets = await getSheetsClient();

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges,
  });

  return (response.data.valueRanges || []).map((vr, i) => {
    const rawValues = (vr.values as string[][]) || [];
    if (rawValues.length === 0) {
      return { range: ranges[i], headers: [], rows: [] };
    }
    const headers = rawValues[0].map((h) => h?.trim() || "");
    const rows = rawValues.slice(1).map((row) => {
      const obj: SheetRow = {};
      headers.forEach((header, idx) => {
        obj[header] = row[idx]?.trim() || "";
      });
      return obj;
    });
    return { range: vr.range || ranges[i], headers, rows };
  });
}

/**
 * Search rows that contain a query string in any column (or specific columns).
 */
export async function searchRowsInSheet(
  spreadsheetId: string,
  sheetName: string,
  query: string,
  searchColumns?: string[]
): Promise<Array<{ rowIndex: number; data: SheetRow; matchedColumns: string[] }>> {
  const { headers, rows } = await readSheetRange(
    spreadsheetId,
    sheetName,
    "A:ZZ"
  );

  const queryLower = query.toLowerCase();
  const results: Array<{ rowIndex: number; data: SheetRow; matchedColumns: string[] }> = [];

  rows.forEach((row, index) => {
    const columnsToSearch = searchColumns
      ? headers.filter((h) => searchColumns.includes(h))
      : headers;

    const matchedColumns: string[] = [];
    columnsToSearch.forEach((col) => {
      if (row[col]?.toLowerCase().includes(queryLower)) {
        matchedColumns.push(col);
      }
    });

    if (matchedColumns.length > 0) {
      results.push({
        rowIndex: index + 2, // +2: header row + 1-based index
        data: row,
        matchedColumns,
      });
    }
  });

  return results;
}

/**
 * Filter rows by one or more column conditions.
 */
export type FilterOperator = "equals" | "contains" | "startsWith" | "gt" | "lt" | "notEmpty" | "empty";
export interface FilterCondition {
  column: string;
  value: string;
  operator: FilterOperator;
}

export async function filterSheetRows(
  spreadsheetId: string,
  sheetName: string,
  filters: FilterCondition[]
): Promise<Array<{ rowIndex: number; data: SheetRow }>> {
  const { rows } = await readSheetRange(spreadsheetId, sheetName, "A:ZZ");

  const results: Array<{ rowIndex: number; data: SheetRow }> = [];

  rows.forEach((row, index) => {
    const passes = filters.every((f) => {
      const cellValue = (row[f.column] || "").toLowerCase();
      const filterValue = f.value.toLowerCase();

      switch (f.operator) {
        case "equals":
          return cellValue === filterValue;
        case "contains":
          return cellValue.includes(filterValue);
        case "startsWith":
          return cellValue.startsWith(filterValue);
        case "gt":
          return parseFloat(cellValue) > parseFloat(filterValue);
        case "lt":
          return parseFloat(cellValue) < parseFloat(filterValue);
        case "notEmpty":
          return cellValue.trim() !== "";
        case "empty":
          return cellValue.trim() === "";
        default:
          return true;
      }
    });

    if (passes) {
      results.push({ rowIndex: index + 2, data: row });
    }
  });

  return results;
}
