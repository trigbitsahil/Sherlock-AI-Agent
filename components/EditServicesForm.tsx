"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ServiceRow {
  _rowNumber: string;
  "Client Name": string;
  "SOW Link": string;
  "Client Type": string;
  Teams: string;
  "Account Lead": string;
  "Budget Allocation": string;
  "Hourly Rate": string;
  [key: string]: any;
}

interface EditableRow extends ServiceRow {
  _modified: boolean;
  _budgetError: string;
  _validating: boolean;
  _selectedAdditionalMonths: string[];
  _additionalMonthsLoading: boolean;
  _availableAdditionalMonths: string[];
}

interface SuccessItem {
  tab: string;
  clientName: string;
  message: string;
}

interface SkippedItem {
  clientName: string;
  reason: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SERVICES_SHEET = "Services Lookup Sheet";
const CLIENTS_SHEET_NAME = "Clients_Sheet";

async function apiFetch(action: string, args: Record<string, any> = {}) {
  const params = new URLSearchParams({ action, ...args });
  const res = await fetch(`/api/edit-services?${params.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(body: Record<string, any>) {
  const res = await fetch("/api/edit-services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// ─── Month Order for Sorting ─────────────────────────────────────────────────
const MONTH_ORDER = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function sortTabs(tabs: string[]): string[] {
  return [...tabs].sort((a, b) => {
    const parseTab = (t: string) => {
      const match = t.match(/^([A-Za-z]+)_?(\d{4})$/);
      if (!match) return { month: 0, year: 0 };
      const monthIdx = MONTH_ORDER.findIndex(
        (m) => m.toLowerCase() === match[1].toLowerCase(),
      );
      return { month: monthIdx, year: parseInt(match[2]) };
    };
    const pa = parseTab(a);
    const pb = parseTab(b);
    if (pa.year !== pb.year) return pb.year - pa.year;
    return pb.month - pa.month;
  });
}

// ─── Team Options ────────────────────────────────────────────────────────────
const ALL_TEAMS = [
  "BR AMA",
  "BR MAU",
  "BR DAN",
  "BR FAB",
  "CSR FAB",
  "BR MIG",
  "ARG/URU",
  "ANDEAN",
  "CHILE",
  "CAM/CAR",
  "MEXICO",
  "EVENTS",
  "DIG-SM",
  "DIG-SEO",
  "DIG-PM/INBOUND",
  "DIG-INF",
  "DESIGN",
];

// ─── Main Component ───────────────────────────────────────────────────────────

interface EditServicesFormProps {
  onClose?: () => void;
}

export function EditServicesForm({ onClose }: EditServicesFormProps) {
  // ── State ──────────────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [availableTabs, setAvailableTabs] = useState<string[]>([]);
  const [tabsLoading, setTabsLoading] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [monthSearchQuery, setMonthSearchQuery] = useState("");

  const [serviceRows, setServiceRows] = useState<EditableRow[]>([]);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState("");

  const budgetCache = useRef<Record<string, Record<string, number>>>({});
  const validationTimers = useRef<Record<string | number, ReturnType<typeof setTimeout> | null>>({});

  const [saving, setSaving] = useState(false);
  const [successItems, setSuccessItems] = useState<SuccessItem[]>([]);
  const [skippedItems, setSkippedItems] = useState<SkippedItem[]>([]);
  const [saveError, setSaveError] = useState("");

  // ── Step 1 → Step 2: Load tabs ────────────────────────────────────────────
  const loadTabs = useCallback(async () => {
    setTabsLoading(true);
    try {
      const result = await apiFetch("getTabs");
      const tabs: string[] = result.tabs || [];
      const monthTabs = tabs.filter((t) => /^[A-Za-z]+[_]?\d{4}$/.test(t));
      setAvailableTabs(sortTabs(monthTabs));
      setStep(2);
    } catch {
      setAvailableTabs([]);
      setStep(2);
    } finally {
      setTabsLoading(false);
    }
  }, []);

  // ── Step 2 → Step 3: Load rows for selected month ─────────────────────────
  const loadServiceRows = useCallback(async (month: string) => {
    setRowsLoading(true);
    setSelectedMonth(month);
    try {
      const result = await apiFetch("getRows", { month });
      const rows: ServiceRow[] = result.rows || [];
      const editable: EditableRow[] = rows
        .filter((r) => r["Client Name"]?.trim())
        .map((r) => ({
          ...r,
          _modified: false,
          _budgetError: "",
          _validating: false,
          _selectedAdditionalMonths: [],
          _additionalMonthsLoading: false,
          _availableAdditionalMonths: [],
        }));
      setServiceRows(editable);
      setStep(3);
    } catch {
      setServiceRows([]);
      setStep(3);
    } finally {
      setRowsLoading(false);
    }
  }, []);

  // ── Get client budget from Clients Sheet ──────────────────────────────────
  const getClientBudget = useCallback(
    async (clientName: string, tabName: string): Promise<number> => {
      if (budgetCache.current[clientName]?.[tabName] !== undefined) {
        return budgetCache.current[clientName][tabName];
      }
      try {
        const result = await apiFetch("getBudget", { clientName, tabName });
        const budget = result.budget || 0;
        if (!budgetCache.current[clientName])
          budgetCache.current[clientName] = {};
        budgetCache.current[clientName][tabName] = budget;
        return budget;
      } catch {
        return 0;
      }
    },
    [],
  );

  // ── Load additional months for a row ─────────────────────────────────────
  const loadAdditionalMonths = useCallback(
    async (rowId: string | number, clientName: string, team: string) => {
      setServiceRows((prev) =>
        prev.map((r) =>
          String(r._rowNumber) === String(rowId) ? { ...r, _additionalMonthsLoading: true } : r,
        ),
      );
      try {
        const result = await apiFetch("searchAdditionalMonths", {
          clientName,
          team,
          excludeMonth: selectedMonth,
        });
        const matchingTabs: string[] = result.matchingTabs || [];
        setServiceRows((prev) =>
          prev.map((r) =>
            String(r._rowNumber) === String(rowId)
              ? {
                  ...r,
                  _additionalMonthsLoading: false,
                  _availableAdditionalMonths: sortTabs(matchingTabs),
                }
              : r,
          ),
        );
      } catch {
        setServiceRows((prev) =>
          prev.map((r) =>
            String(r._rowNumber) === String(rowId) ? { ...r, _additionalMonthsLoading: false } : r,
          ),
        );
      }
    },
    [selectedMonth],
  );

  // ── Live Validation ───────────────────────────────────────────────────────
  const validateBudget = useCallback(
    async (rowId: string | number, newValue: string) => {
      const row = serviceRows.find((r) => String(r._rowNumber) === String(rowId));
      if (!row) return;

      if (!newValue || isNaN(parseFloat(newValue))) {
        setServiceRows((prev) =>
          prev.map((r) =>
            String(r._rowNumber) === String(rowId)
              ? { ...r, _budgetError: "", _validating: false }
              : r,
          ),
        );
        return;
      }

      const val = parseFloat(newValue);
      setServiceRows((prev) =>
        prev.map((r) =>
          String(r._rowNumber) === String(rowId) ? { ...r, _validating: true } : r,
        ),
      );

      const errors: string[] = [];
      try {
        const primaryMax = await getClientBudget(row["Client Name"], selectedMonth);
        if (primaryMax > 0 && val > primaryMax) {
          errors.push(`${selectedMonth}: max allowed = ${primaryMax}`);
        } else {
          setServiceRows((prev) =>
            prev.map((r) =>
              String(r._rowNumber) === String(rowId)
                ? { ...r, _clientPrimaryBudget: primaryMax }
                : r,
            ),
          );
        }

        for (const tab of row._selectedAdditionalMonths) {
          const tabMax = await getClientBudget(row["Client Name"], tab);
          if (tabMax > 0 && val > tabMax) {
            errors.push(`${tab}: max allowed = ${tabMax}`);
          }
        }

        setServiceRows((prev) =>
          prev.map((r) =>
            String(r._rowNumber) === String(rowId)
              ? { ...r, _budgetError: errors.join(" | "), _validating: false }
              : r,
          ),
        );
      } catch (e) {
        setServiceRows((prev) =>
          prev.map((r) =>
            String(r._rowNumber) === String(rowId)
              ? { ...r, _budgetError: "Validation failed", _validating: false }
              : r,
          ),
        );
      }
    },
    [serviceRows, selectedMonth, getClientBudget],
  );

  // ── Handle field edits ────────────────────────────────────────────────────
  const handleFieldChange = useCallback(
    (rowIdx: number, field: string, value: string) => {
      const rowId = serviceRows[rowIdx]?._rowNumber;
      setServiceRows((prev) =>
        prev.map((r, i) => {
          if (i !== rowIdx) return r;
          const originalVal = r[field] ?? "";
          const wasModified = r._modified;
          const updated = { ...r, [field]: value, _modified: true };
          if (field === "Budget Allocation") {
            updated._validating = true;
            updated._budgetError = "";
          }
          if (value === originalVal && !wasModified) {
            updated._modified = false;
          }
          return updated;
        }),
      );
      if (field === "Budget Allocation") {
        if (rowId !== undefined) {
          if (validationTimers.current[rowId]) {
            clearTimeout(validationTimers.current[rowId] as ReturnType<typeof setTimeout>);
          }
          validationTimers.current[rowId] = setTimeout(() => {
            validateBudget(rowId, value);
            validationTimers.current[rowId] = null;
          }, 400);
        }
      }
    },
    [validateBudget, serviceRows],
  );

  // ── Toggle additional month ───────────────────────────────────────────────
  const toggleAdditionalMonth = useCallback(
    async (rowIdx: number, month: string) => {
      const rowId = serviceRows[rowIdx]?._rowNumber;
      setServiceRows((prev) =>
        prev.map((r, i) => {
          if (i !== rowIdx) return r;
          const already = r._selectedAdditionalMonths.includes(month);
          return {
            ...r,
            _selectedAdditionalMonths: already
              ? r._selectedAdditionalMonths.filter((m) => m !== month)
              : [...r._selectedAdditionalMonths, month],
            _modified: true,
            _validating: true,
            _budgetError: "",
          };
        }),
      );
      if (rowId !== undefined) {
        if (validationTimers.current[rowId]) {
          clearTimeout(validationTimers.current[rowId] as ReturnType<typeof setTimeout>);
        }
        validationTimers.current[rowId] = setTimeout(() => {
          const row = serviceRows.find((r) => String(r._rowNumber) === String(rowId));
          if (row) validateBudget(rowId, row["Budget Allocation"]);
          validationTimers.current[rowId] = null;
        }, 200);
      }
    },
    [serviceRows, validateBudget],
  );

  // ── Save Changes ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    const success: SuccessItem[] = [];
    const skipped: SkippedItem[] = [];

    for (const row of serviceRows) {
      if (!row._modified) {
        skipped.push({
          clientName: row["Client Name"],
          reason: "No changes detected",
        });
        continue;
      }
      if (row._budgetError) {
        skipped.push({
          clientName: row["Client Name"],
          reason: "Validation error: " + row._budgetError,
        });
        continue;
      }

      const updates: Record<string, string> = {};
      const internalFields = [
        "_modified",
        "_budgetError",
        "_selectedAdditionalMonths",
        "_additionalMonthsLoading",
        "_availableAdditionalMonths",
        "_rowNumber",
      ];
      for (const key of Object.keys(row)) {
        if (!internalFields.includes(key)) {
          updates[key] = row[key];
        }
      }
      const updatesJson = JSON.stringify(updates);

      try {
        await apiPost({
          tabName: selectedMonth,
          rowId: row._rowNumber,
          updates: updatesJson,
        });
        success.push({
          tab: selectedMonth,
          clientName: row["Client Name"],
          message: "Budget hours updated",
        });
      } catch (e: any) {
        skipped.push({
          clientName: row["Client Name"],
          reason: `Failed to update ${selectedMonth}: ${e.message}`,
        });
      }

      for (const tab of row._selectedAdditionalMonths) {
        try {
          const searchResult = await apiFetch("searchRowInTab", {
            clientName: row["Client Name"],
            team: row["Teams"],
            tabName: tab,
          });
          const matchRow = searchResult.row;
          if (!matchRow) {
            skipped.push({
              clientName: row["Client Name"],
              reason: `Row not found in ${tab}`,
            });
            continue;
          }
          await apiPost({
            tabName: tab,
            rowId: matchRow._rowNumber,
            updates: updatesJson,
          });
          success.push({
            tab,
            clientName: row["Client Name"],
            message: "Budget hours updated",
          });
        } catch (e: any) {
          skipped.push({
            clientName: row["Client Name"],
            reason: `Failed to update ${tab}: ${e.message}`,
          });
        }
      }
    }

    setSaving(false);
    setSuccessItems(success);
    setSkippedItems(skipped);
    setStep(4);
  }, [serviceRows, selectedMonth]);

  // ── Overall has-errors check ─────────────────────────────────────────────
  const hasErrors = serviceRows.some((r) => r._budgetError);
  const hasModified = serviceRows.some((r) => r._modified);
  const isValidating = serviceRows.some((r) => r._validating);

  // ─────────────────────────────── Render ──────────────────────────────────

  // Step 1 — Start button
  if (step === 1) {
    return (
      <div className="w-full px-4 py-6 sm:px-6">
        <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-6 max-w-2xl w-full shadow-md mx-auto">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xl sm:text-2xl">✏️</span>
            <h2 className="text-lg sm:text-xl font-bold text-foreground">Edit Services</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
            Update service allocation records for clients across monthly tabs in
            the Services Lookup Sheet.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={loadTabs}
              disabled={tabsLoading}
              className="px-5 py-2.5 bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-60 w-full sm:w-auto"
            >
              {tabsLoading ? (
                <>
                  <span className="animate-spin">⟳</span>
                  <span>Preparing...</span>
                </>
              ) : (
                <>
                  <span>📅</span>
                  <span>Get Started</span>
                </>
              )}
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors w-full sm:w-auto"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Step 2 — Select month
  if (step === 2) {
    return (
      <div className="w-full px-4 py-6 sm:px-6">
        <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-6 max-w-2xl w-full shadow-md mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-4">
            <span className="text-xl sm:text-2xl">📅</span>
            <div className="flex-1">
              <h2 className="text-lg sm:text-xl font-bold text-foreground">Select Month</h2>
              <p className="text-xs text-muted-foreground">
                Choose which month to edit services for
              </p>
            </div>
          </div>

          {rowsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <span className="animate-spin text-lg">⟳</span>
              <span>Loading records for {selectedMonth}...</span>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search months..."
                  value={monthSearchQuery}
                  onChange={(e) => setMonthSearchQuery(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#4ecdc4]/50"
                />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-5">
                {availableTabs.length === 0 ? (
                  <p className="text-sm text-muted-foreground col-span-2 sm:col-span-3">
                    No month tabs found.
                  </p>
                ) : (
                  availableTabs
                    .filter((tab) =>
                      tab.toLowerCase().includes(monthSearchQuery.toLowerCase()),
                    )
                    .map((tab) => (
                      <button
                        key={tab}
                        onClick={() => loadServiceRows(tab)}
                        className="px-3 py-2 text-xs sm:text-sm font-medium rounded-lg border border-border/60 hover:border-[#4ecdc4] hover:bg-[#4ecdc4]/10 transition-all text-foreground text-center"
                      >
                        📋 {tab.replace("_", " ")}
                      </button>
                    ))
                )}
              </div>
              <button
                onClick={() => setStep(1)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Step 3 — Editable rows
  if (step === 3) {
    return (
      <div className="w-full px-4 py-6 sm:px-6">
        <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-6 max-w-6xl w-full shadow-md mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div className="flex items-start gap-3">
              <span className="text-xl sm:text-2xl">📊</span>
              <div className="flex-1">
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  {selectedMonth.replace("_", " ")} — Service Records
                </h2>
                <p className="text-xs text-muted-foreground">
                  {serviceRows.length} records. Edit and save changes.
                </p>
              </div>
            </div>
            <button
              onClick={() => setStep(2)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
            >
              ← Change Month
            </button>
          </div>

          {rowsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <span className="animate-spin text-lg">⟳</span>
              Loading service records...
            </div>
          ) : serviceRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">
              No service records found for {selectedMonth}.
            </p>
          ) : (
            <>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search services..."
                  value={serviceSearchQuery}
                  onChange={(e) => setServiceSearchQuery(e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#4ecdc4]/50"
                />
              </div>
              <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                {serviceRows
                  .filter(
                    (row) =>
                      row["Client Name"]
                        ?.toLowerCase()
                        .includes(serviceSearchQuery.toLowerCase()) ||
                      row["Teams"]
                        ?.toLowerCase()
                        .includes(serviceSearchQuery.toLowerCase()),
                  )
                  .map((row, idx) => {
                    const actualIdx = serviceRows.findIndex(
                      (r) => r._rowNumber === row._rowNumber,
                    );
                    return (
                      <ServiceRowEditor
                        key={row._rowNumber}
                        row={row}
                        rowIdx={actualIdx}
                        availableTabs={availableTabs}
                        selectedMonth={selectedMonth}
                        onFieldChange={handleFieldChange}
                        onToggleAdditionalMonth={toggleAdditionalMonth}
                        onLoadAdditionalMonths={loadAdditionalMonths}
                      />
                    );
                  })}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-5 pt-4 border-t border-border/40">
                <button
                  onClick={handleSave}
                  disabled={saving || hasErrors || !hasModified || isValidating}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 w-full sm:w-auto"
                >
                  {saving ? (
                    <>
                      <span className="animate-spin">⟳</span>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <span>💾</span>
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs w-full sm:w-auto">
                  {isValidating && (
                    <span className="text-blue-400 font-medium flex items-center gap-1">
                      <span className="animate-spin">⟳</span> Validating...
                    </span>
                  )}
                  {hasErrors && !isValidating && (
                    <span className="text-red-500 font-medium">
                      ⚠️ Fix validation errors
                    </span>
                  )}
                  {!hasModified && !hasErrors && !isValidating && (
                    <span className="text-muted-foreground">
                      No changes to save
                    </span>
                  )}
                  {saveError && (
                    <span className="text-red-500">{saveError}</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Step 4 — Success summary
  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <div className="rounded-2xl border border-border/50 bg-card p-4 sm:p-6 max-w-2xl w-full shadow-md mx-auto">
        <div className="flex items-start gap-3 mb-4">
          <span className="text-xl sm:text-2xl">✅</span>
          <h2 className="text-lg sm:text-xl font-bold text-foreground">
            Services Updated Successfully
          </h2>
        </div>

        {successItems.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Updated
            </p>
            <div className="space-y-1">
              {successItems.map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm text-foreground break-words"
                >
                  <span className="text-green-500">✓</span>
                  <span className="font-medium">{item.tab.replace("_", " ")}</span>
                  <span className="hidden sm:inline text-muted-foreground">→</span>
                  <span className="break-words">{item.clientName}</span>
                  <span className="text-muted-foreground text-xs">
                    — {item.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {skippedItems.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Skipped
            </p>
            <div className="space-y-1">
              {skippedItems.map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-xs sm:text-sm text-muted-foreground break-words"
                >
                  <span>•</span>
                  <span className="break-words">{item.clientName}</span>
                  <span className="text-xs">— {item.reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 mt-5 pt-4 border-t border-border/40">
          <button
            onClick={() => {
              setStep(1);
              setServiceRows([]);
              setSelectedMonth("");
              setSuccessItems([]);
              setSkippedItems([]);
            }}
            className="px-5 py-2 bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white rounded-lg text-sm font-semibold hover:opacity-90 transition-all w-full sm:w-auto text-center"
          >
            ✏️ Edit More Services
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 border border-border text-sm text-foreground rounded-lg hover:bg-hover-bg transition-colors w-full sm:w-auto"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Individual Row Editor ────────────────────────────────────────────────────

interface ServiceRowEditorProps {
  row: EditableRow;
  rowIdx: number;
  availableTabs: string[];
  selectedMonth: string;
  onFieldChange: (rowIdx: number, field: string, value: string) => void;
  onToggleAdditionalMonth: (rowIdx: number, month: string) => void;
  onLoadAdditionalMonths: (
    rowId: string | number,
    clientName: string,
    team: string,
  ) => void;
}

function ServiceRowEditor({
  row,
  rowIdx,
  availableTabs,
  selectedMonth,
  onFieldChange,
  onToggleAdditionalMonth,
  onLoadAdditionalMonths,
}: ServiceRowEditorProps) {
  const [additionalExpanded, setAdditionalExpanded] = useState(false);
  const hasLoaded =
    row._availableAdditionalMonths.length > 0 || row._additionalMonthsLoading;

  const handleExpandAdditional = () => {
    if (!hasLoaded && !row._additionalMonthsLoading) {
      onLoadAdditionalMonths(row._rowNumber, row["Client Name"], row["Teams"]);
    }
    setAdditionalExpanded((v) => !v);
  };

  return (
    <div
      className={`rounded-xl border p-3 sm:p-4 transition-all ${
        row._modified
          ? "border-[#4ecdc4]/60 bg-[#4ecdc4]/5"
          : "border-border/40 bg-background/50"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground">
            #{row._rowNumber}
          </span>
          {row._modified && (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-[#4ecdc4]/20 text-[#44a08d] font-medium">
              Modified
            </span>
          )}
        </div>
      </div>

      {/* Horizontal fields grid - responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
        {/* Client Name */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            Client Name
          </label>
          <input
            type="text"
            value={row["Client Name"]}
            onChange={(e) =>
              onFieldChange(rowIdx, "Client Name", e.target.value)
            }
            className="px-3 py-2 rounded-lg border border-border/60 bg-input text-sm focus:outline-none focus:border-[#4ecdc4] transition-colors text-foreground"
          />
        </div>

        {/* Team */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            Team
          </label>
          <select
            value={row["Teams"]}
            onChange={(e) => onFieldChange(rowIdx, "Teams", e.target.value)}
            className="px-3 py-2 rounded-lg border border-border/60 bg-input text-sm focus:outline-none focus:border-[#4ecdc4] transition-colors text-foreground"
          >
            <option value="">Select Team</option>
            {ALL_TEAMS.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
            {row["Teams"] && !ALL_TEAMS.includes(row["Teams"]) && (
              <option value={row["Teams"]}>{row["Teams"]}</option>
            )}
          </select>
        </div>

        {/* Budget Allocation */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            Budget Allocation (hrs)
          </label>
          <div className="flex flex-col gap-1">
            <input
              type="number"
              value={row["Budget Allocation"]}
              onChange={(e) =>
                onFieldChange(rowIdx, "Budget Allocation", e.target.value)
              }
              className={`w-full px-3 py-2 rounded-lg border text-sm focus:outline-none transition-colors text-foreground bg-input ${
                row._budgetError
                  ? "border-red-500 bg-red-500/5"
                  : "border-border/60 focus:border-[#4ecdc4]"
              }`}
            />
            {row._clientPrimaryBudget !== undefined && (
              <span className="text-xs text-muted-foreground">
                Limit: {row._clientPrimaryBudget}
              </span>
            )}
          </div>
        </div>

        {/* Hourly Rate */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground font-medium">
            Hourly Rate
          </label>
          <input
            type="number"
            value={row["Hourly Rate"]}
            readOnly
            className="px-3 py-2 rounded-lg border border-border/60 bg-input/50 text-sm text-muted-foreground cursor-not-allowed outline-none"
          />
        </div>
      </div>

      {/* Live validation error / loading */}
      {row._validating && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-xs text-blue-400 flex items-center gap-2">
          <span className="animate-spin">⟳</span>
          <span>Validating budget hours...</span>
        </div>
      )}
      {row._budgetError && !row._validating && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-500">
          ⚠️ Budget limit exceeded — {row._budgetError}
        </div>
      )}

      {/* Additional Months */}
      <div className="mt-2">
        <button
          onClick={handleExpandAdditional}
          className="flex items-center cursor-pointer gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>{additionalExpanded ? "▼" : "▶"}</span>
          <span>Apply same changes to other months</span>
          {row._selectedAdditionalMonths.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#4ecdc4]/20 text-[#44a08d] font-medium">
              {row._selectedAdditionalMonths.length} selected
            </span>
          )}
        </button>

        {additionalExpanded && (
          <div className="mt-2 pl-3 sm:pl-4 border-l-2 border-border/40">
            {row._additionalMonthsLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                <span className="animate-spin">⟳</span>
                <span>Searching matching assignments...</span>
              </div>
            ) : row._availableAdditionalMonths.length === 0 ? (
              <p className="text-xs text-muted-foreground py-1">
                No other months found where {row["Client Name"]} is assigned to{" "}
                {row["Teams"]}.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2 py-2">
                {row._availableAdditionalMonths.map((month) => {
                  const isSelected =
                    row._selectedAdditionalMonths.includes(month);
                  return (
                    <button
                      key={month}
                      onClick={() => onToggleAdditionalMonth(rowIdx, month)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border whitespace-nowrap ${
                        isSelected
                          ? "bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white border-transparent"
                          : "border-border/60 text-foreground hover:border-[#4ecdc4]"
                      }`}
                    >
                      {isSelected ? "✓" : "+"} {month.replace("_", " ")}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}