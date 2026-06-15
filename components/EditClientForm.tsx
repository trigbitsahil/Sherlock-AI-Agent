"use client";

import React, { useState } from "react";

type ClientType = "Billable" | "Internal" | "Pro Bono";

interface MonthRecord {
  tab: string;
  rowNumber: string;
  clientName: string;
  sowText: string;
  sowLink: string;
  budgetHours: string;
  hourlyRate: string;
  rawSow: string;
}

interface EditedRecord extends MonthRecord {
  edited: boolean;
}

interface EditClientFormProps {
  onCancel: () => void;
  onDone: (summary: string) => void;
}

type Step =
  | "selectType"
  | "loadingClients"
  | "selectClient"
  | "loadingMonths"
  | "editRecords"
  | "saving"
  | "done";

function TabLabel({ tab }: { tab: string }) {
  return (
    <span className="text-[#4ecdc4] font-semibold">
      {tab.replace("_", " ")}
    </span>
  );
}

// Shared UI components moved outside to prevent re-mounting and losing focus
const Card = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-card border border-border rounded-2xl p-6 my-4 w-full max-w-3xl">
    {children}
  </div>
);

const Title = ({ label }: { label: string }) => (
  <h3 className="text-lg font-bold text-foreground mb-4">{label}</h3>
);

const CancelBtn = ({ onCancel }: { onCancel: () => void }) => (
  <button
    onClick={onCancel}
    className="text-xs text-muted-foreground hover:text-foreground underline mt-3"
  >
    Cancel
  </button>
);

export function EditClientForm({ onCancel, onDone }: EditClientFormProps) {
  const [step, setStep] = useState<Step>("selectType");
  const [clientType, setClientType] = useState<ClientType>("Billable");
  const [clients, setClients] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [clientTabs, setClientTabs] = useState<Record<string, string[]>>({});
  const [selectedClient, setSelectedClient] = useState("");
  const [monthRecords, setMonthRecords] = useState<EditedRecord[]>([]);
  const [originalRecords, setOriginalRecords] = useState<MonthRecord[]>([]);
  const [error, setError] = useState("");
  const [saveResults, setSaveResults] = useState<
    { tab: string; changes: string[]; skipped: boolean }[]
  >([]);

  // --- Step 1 → 2: User picks client type ---
  const handleSelectType = async (type: ClientType) => {
    setClientType(type);
    setError("");
    setSearchQuery("");
    setStep("loadingClients");
    try {
      const cacheKey = `editClient_type_${type}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 3600000) {
          setClients(parsed.data.clients || []);
          setClientTabs(parsed.data.clientTabs || {});
          setStep("selectClient");
          return;
        }
      }

      const res = await fetch(
        `/api/edit-client?clientType=${encodeURIComponent(type)}`,
      );
      const data = await res.json();
      if (!res.ok || data.error)
        throw new Error(data.error || "Failed to load clients");

      localStorage.setItem(
        cacheKey,
        JSON.stringify({ timestamp: Date.now(), data }),
      );
      setClients(data.clients || []);
      setClientTabs(data.clientTabs || {});
      setStep("selectClient");
    } catch (e: any) {
      setError(e.message);
      setStep("selectType");
    }
  };

  // --- Step 3 → 4: User picks client, load month records ---
  const handleSelectClient = async (name: string) => {
    setSelectedClient(name);
    setError("");
    setStep("loadingMonths");
    try {
      const cacheKey = `editClient_records_${clientType}_${name}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < 3600000) {
          const records: EditedRecord[] = (parsed.data.monthRecords || []).map(
            (r: MonthRecord) => ({
              ...r,
              edited: false,
            }),
          );
          setMonthRecords(records);
          setOriginalRecords(parsed.data.monthRecords || []);
          setStep("editRecords");
          return;
        }
      }

      const tabsStr = clientTabs[name]
        ? `&tabs=${encodeURIComponent(clientTabs[name].join(","))}`
        : "";
      const res = await fetch(
        `/api/edit-client?clientType=${encodeURIComponent(clientType)}&clientName=${encodeURIComponent(name)}${tabsStr}`,
      );
      const data = await res.json();
      if (!res.ok || data.error)
        throw new Error(data.error || "Failed to load month records");

      localStorage.setItem(
        cacheKey,
        JSON.stringify({ timestamp: Date.now(), data }),
      );
      const records: EditedRecord[] = (data.monthRecords || []).map(
        (r: MonthRecord) => ({
          ...r,
          edited: false,
        }),
      );
      setMonthRecords(records);
      setOriginalRecords(data.monthRecords || []);
      setStep("editRecords");
    } catch (e: any) {
      setError(e.message);
      setStep("selectClient");
    }
  };

  // --- Field change handler ---
  const handleFieldChange = (
    tab: string,
    field: keyof MonthRecord,
    value: string,
  ) => {
    setMonthRecords((prev) =>
      prev.map((r) => {
        if (r.tab !== tab) return r;
        const updated = { ...r, [field]: value };
        // Determine if any field differs from original
        const orig = originalRecords.find((o) => o.tab === tab);
        updated.edited = !!(
          orig &&
          (updated.clientName !== orig.clientName ||
            updated.sowText !== orig.sowText ||
            updated.sowLink !== orig.sowLink ||
            updated.budgetHours !== orig.budgetHours ||
            updated.hourlyRate !== orig.hourlyRate)
        );
        return updated;
      }),
    );
  };

  // --- Save ---
  const handleSave = async () => {
    setStep("saving");
    setError("");

    const changedRecords = monthRecords.filter((r) => r.edited);
    if (changedRecords.length === 0) {
      setStep("done");
      setSaveResults(
        monthRecords.map((r) => ({ tab: r.tab, changes: [], skipped: true })),
      );
      return;
    }

    const updates = changedRecords.map((r) => {
      const orig = originalRecords.find((o) => o.tab === r.tab)!;
      const changes: Record<string, string> = {};
      if (r.clientName !== orig.clientName) changes.clientName = r.clientName;
      if (r.sowText !== orig.sowText || r.sowLink !== orig.sowLink) {
        changes.sowText = r.sowText;
        changes.sowLink = r.sowLink;
      }
      if (r.budgetHours !== orig.budgetHours)
        changes.budgetHours = r.budgetHours;
      if (r.hourlyRate !== orig.hourlyRate) changes.hourlyRate = r.hourlyRate;
      return { tab: r.tab, rowNumber: r.rowNumber, changes };
    });

    try {
      const res = await fetch("/api/edit-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientType, updates }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Save failed");

      // Update the local cache inline instead of clearing it, so it loads instantly next time
      const updatedData = {
        monthRecords: monthRecords.map((r) => {
          const { edited, ...rest } = r;
          return rest;
        }),
      };
      localStorage.setItem(
        `editClient_records_${clientType}_${selectedClient}`,
        JSON.stringify({ timestamp: Date.now(), data: updatedData }),
      );

      // Build human-readable summary
      const allResults = monthRecords.map((r) => {
        if (!r.edited) return { tab: r.tab, changes: [], skipped: true };
        const orig = originalRecords.find((o) => o.tab === r.tab)!;
        const changes: string[] = [];
        if (r.clientName !== orig.clientName) changes.push("Client Name");
        if (r.sowText !== orig.sowText) changes.push("SOW Text");
        if (r.sowLink !== orig.sowLink) changes.push("SOW Link");
        if (r.budgetHours !== orig.budgetHours) changes.push("Budget Hours");
        if (r.hourlyRate !== orig.hourlyRate) changes.push("Hourly Rate");
        return { tab: r.tab, changes, skipped: false };
      });

      setSaveResults(allResults);
      setStep("done");

      const updated = allResults.filter((r) => !r.skipped);
      const skipped = allResults.filter((r) => r.skipped);
      let msg = `Client records for **${selectedClient}** updated successfully.\n\n`;
      if (updated.length) {
        msg += `**Updated Records:**\n${updated.map((r) => `✓ ${r.tab.replace("_", " ")} → ${r.changes.join(", ")} updated`).join("\n")}\n\n`;
      }
      if (skipped.length) {
        msg += `**Skipped Records:**\n${skipped.map((r) => `• ${r.tab.replace("_", " ")} → No changes detected`).join("\n")}`;
      }
      onDone(msg);
    } catch (e: any) {
      setError(e.message);
      setStep("editRecords");
    }
  };

  const editedCount = monthRecords.filter((r) => r.edited).length;

  // ── Render Steps ─────────────────────────────────────────────────────────────

  if (step === "selectType") {
    return (
      <Card>
        <Title label="✏️ Edit Client — Select Category" />
        <p className="text-sm text-muted-foreground mb-4">
          Which type of client do you want to edit?
        </p>
        <div className="flex flex-wrap gap-3">
          {(["Billable", "Internal", "Pro Bono"] as ClientType[]).map((t) => (
            <button
              key={t}
              onClick={() => handleSelectType(t)}
              className="px-5 py-3 rounded-xl font-medium bg-hover-bg hover:bg-gray-600 text-foreground border border-border transition-all"
            >
              {t} Clients
            </button>
          ))}
        </div>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        <div className="mt-4">
          <CancelBtn onCancel={onCancel} />
        </div>
      </Card>
    );
  }

  // Replace the loadingClients section (line 306-317)
if (step === "loadingClients") {
  return (
    <Card>
      <Title label="✏️ Edit Client" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-muted-foreground animate-pulse">
        <div className="w-4 h-4 flex-shrink-0 border-2 border-[#4ecdc4] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs sm:text-sm">
          Scanning all monthly sheets and collecting client records...
        </span>
      </div>
    </Card>
  );
}

  if (step === "selectClient") {
    const filteredClients = clients.filter((c) =>
      c.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    return (
      <Card>
        <Title label={`✏️ Edit Client — ${clientType} Clients`} />
        <div className="mb-4">
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#4ecdc4]/50"
          />
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Found <strong>{filteredClients.length}</strong> unique client(s).
          Select a client to edit:
        </p>
        <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto pr-1">
          {filteredClients.map((name) => (
            <button
              key={name}
              onClick={() => handleSelectClient(name)}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-hover-bg hover:bg-[#4ecdc4]/20 hover:border-[#4ecdc4] text-foreground border border-border transition-all"
            >
              {name}
            </button>
          ))}
        </div>
        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
        <div className="flex items-center gap-4 mt-4">
          <button
            onClick={() => setStep("selectType")}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            ← Back
          </button>
          <CancelBtn onCancel={onCancel} />
        </div>
      </Card>
    );
  }

  // Replace the loadingMonths section (line 366-379)
if (step === "loadingMonths") {
  return (
    <Card>
      <Title label="✏️ Edit Client" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-muted-foreground animate-pulse">
        <div className="w-4 h-4 flex-shrink-0 border-2 border-[#4ecdc4] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs sm:text-sm">
          Searching all months where{" "}
          <strong className="text-foreground">{selectedClient}</strong>{" "}
          exists...
        </span>
      </div>
    </Card>
  );
}

 if (step === "saving") {
  return (
    <Card>
      <Title label="✏️ Edit Client — Saving" />
      <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-muted-foreground animate-pulse">
        <div className="w-4 h-4 flex-shrink-0 border-2 border-[#4ecdc4] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs sm:text-sm">Updating selected client records...</span>
      </div>
    </Card>
  );
}

  if (step === "editRecords") {
    if (monthRecords.length === 0) {
      return (
        <Card>
          <Title label="✏️ Edit Client" />
          <p className="text-sm text-muted-foreground">
            No month records found for <strong>{selectedClient}</strong> in the
            current year.
          </p>
          <div className="mt-4">
            <CancelBtn onCancel={onCancel} />
          </div>
        </Card>
      );
    }

    const showHourlyRate = clientType === "Billable";

    return (
      <Card>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              ✏️ Edit Client — {selectedClient}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              Found in {monthRecords.length} month(s) ·{" "}
              {editedCount > 0 ? (
                <span className="text-[#4ecdc4]">{editedCount} modified</span>
              ) : (
                "No changes yet"
              )}
            </p>
          </div>
        </div>

        {/* Horizontal scroll table */}
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-hover-bg text-muted-foreground">
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  Month
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  Client Name
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  SOW Text
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  SOW Link
                </th>
                <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                  Budget Hours
                </th>
                {showHourlyRate && (
                  <th className="text-left px-4 py-3 font-medium whitespace-nowrap">
                    Hourly Rate
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {monthRecords.map((r) => (
                <tr key={r.tab}>
                  <td className="px-4 py-3 text-muted-foreground font-medium whitespace-nowrap">
                    <TabLabel tab={r.tab} />
                    {r.edited && (
                      <span className="ml-2 text-xs text-yellow-400">✦ </span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={r.clientName}
                      onChange={(e) =>
                        handleFieldChange(r.tab, "clientName", e.target.value)
                      }
                      className="w-full min-w-[160px] bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#4ecdc4]/50"
                    />
                  </td>
                  <td className="px-4 py-2">
                    {clientType === "Billable" ? (
                      <select
                        value={r.sowText}
                        onChange={(e) =>
                          handleFieldChange(r.tab, "sowText", e.target.value)
                        }
                        className="w-full min-w-[140px] bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#4ecdc4]/50"
                      >
                        <option value="">Select Option</option>
                        {r.sowText &&
                          r.sowText.toLowerCase() !== "project" &&
                          r.sowText.toLowerCase() !== "retainer" && (
                            <option value={r.sowText}>{r.sowText}</option>
                          )}
                        <option value="Project">Project</option>
                        <option value="Retainer">Retainer</option>
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={r.sowText}
                        readOnly
                        className="w-full min-w-[140px] bg-input/50 text-muted-foreground border border-border rounded-lg px-3 py-2 text-sm cursor-not-allowed outline-none"
                      />
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="url"
                      value={r.sowLink}
                      onChange={(e) =>
                        handleFieldChange(r.tab, "sowLink", e.target.value)
                      }
                      className="w-full min-w-[200px] bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#4ecdc4]/50"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      step="any"
                      value={r.budgetHours}
                      onChange={(e) =>
                        handleFieldChange(r.tab, "budgetHours", e.target.value)
                      }
                      className="w-full min-w-[100px] bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#4ecdc4]/50"
                    />
                  </td>
                  {showHourlyRate && (
                    <td className="px-4 py-2">
                      <input
                        type="number"
                        step="any"
                        value={r.hourlyRate}
                        onChange={(e) =>
                          handleFieldChange(r.tab, "hourlyRate", e.target.value)
                        }
                        className="w-full min-w-[100px] bg-input border border-border rounded-lg px-3 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#4ecdc4]/50"
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {error && <p className="text-red-400 text-sm mt-3">{error}</p>}

        <div className="flex flex-col-reverse sm:flex-row justify-between sm:items-center gap-4 mt-5 pt-4 border-t border-border">
          <div className="flex items-center justify-center sm:justify-start gap-4">
            <button
              onClick={() => setStep("selectClient")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={onCancel}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Cancel
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={editedCount === 0}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] hover:from-[#45bbb3] hover:to-[#3a9a7d] text-white font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm"
          >
            {editedCount > 0
              ? `Save Changes (${editedCount} month${editedCount > 1 ? "s" : ""})`
              : "No Changes to Save"}
          </button>
        </div>
      </Card>
    );
  }

  // done step — handled by parent via onDone, just return null
  return null;
}
