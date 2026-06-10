"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";

export interface Alert {
  id: string;
  month: string;
  team: string;
  client: string;
  overUnder: number;
  severity: "warning" | "high" | "critical";
  message: string;
  createdAt: number;
  read?: boolean;
}

const STORAGE_KEY = "team_capacity_alerts";
const READ_KEY = "team_capacity_alerts_read";

function getSeverityStyles(severity: string) {
  switch (severity) {
    case "critical": return { dot: "bg-red-500", badge: "bg-red-500/10 text-red-400 border-red-500/20", label: "Critical" };
    case "high":     return { dot: "bg-orange-500", badge: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "High" };
    default:         return { dot: "bg-yellow-500", badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20", label: "Warning" };
  }
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterSeverity, setFilterSeverity] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const lastFetch = useRef<number>(0);

  const loadFromStorage = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setAlerts(JSON.parse(stored));
      const readStored = localStorage.getItem(READ_KEY);
      if (readStored) setReadIds(new Set(JSON.parse(readStored)));
    } catch {}
  }, []);

  const fetchAlerts = useCallback(async (force = false) => {
    const now = Date.now();
    if (!force && now - lastFetch.current < 60_000) return; // throttle to once/min
    lastFetch.current = now;
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      const data = await res.json();
      if (data.success && data.alerts) {
        setAlerts(data.alerts);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.alerts));
      }
    } catch {}
    setLoading(false);
  }, []);

  // Load from cache immediately, fetch fresh in bg on mount
  useEffect(() => {
    loadFromStorage();
    fetchAlerts();
  }, [loadFromStorage, fetchAlerts]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const markAllRead = () => {
    const allIds = new Set(alerts.map(a => a.id));
    setReadIds(allIds);
    localStorage.setItem(READ_KEY, JSON.stringify([...allIds]));
  };

  const markRead = (id: string) => {
    const updated = new Set(readIds);
    updated.add(id);
    setReadIds(updated);
    localStorage.setItem(READ_KEY, JSON.stringify([...updated]));
  };

  const clearAll = () => {
    setAlerts([]);
    setReadIds(new Set());
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(READ_KEY);
  };

  const months = [...new Set(alerts.map(a => a.month))].sort();
  const teams = [...new Set(alerts.map(a => a.team))].sort();

  const filtered = alerts.filter(a => {
    if (filterMonth && a.month !== filterMonth) return false;
    if (filterTeam && a.team !== filterTeam) return false;
    if (filterSeverity && a.severity !== filterSeverity) return false;
    return true;
  });

  const unread = alerts.filter(a => !readIds.has(a.id)).length;

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2.5 rounded-lg bg-card border border-border/50 text-foreground hover:bg-card/80 transition-colors duration-200"
        title="Notifications"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* Dropdown Panel - Responsive */}
      {open && (
        <div className="fixed md:absolute top-[64px] md:top-12 md:inset-auto md:right-0 md:-right-2 left-4 right-4 md:left-auto md:right-auto md:mx-0 md:w-[420px] w-auto bottom-4 md:bottom-auto md:max-h-[600px] flex flex-col bg-card border border-border/40 md:rounded-2xl rounded-t-xl shadow-2xl z-[100] overflow-hidden animate-in fade-in slide-in-from-top-2 md:slide-in-from-top-2">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-foreground">🔔 Notifications</span>
              {unread > 0 && (
                <span className="px-2 py-0.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-full text-xs font-semibold">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchAlerts(true)}
                disabled={loading}
                className="p-1.5 rounded-lg hover:bg-hover-bg text-muted-foreground hover:text-foreground transition-colors"
                title="Refresh"
              >
                <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              {unread > 0 && (
                <button onClick={markAllRead} className="text-xs text-muted-foreground hover:text-foreground transition-colors hidden sm:block">
                  Mark all read
                </button>
              )}
              {alerts.length > 0 && (
                <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-300 transition-colors hidden sm:block">
                  Clear all
                </button>
              )}
              {/* Mobile close button */}
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-hover-bg text-muted-foreground hover:text-foreground transition-colors md:hidden"
                title="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Filters */}
          {alerts.length > 0 && (
            <div 
              className="flex gap-2 px-4 py-3 border-b border-border/30 flex-shrink-0 overflow-x-auto overflow-y-hidden custom-scrollbar touch-pan-x scroll-smooth pb-4"
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="text-xs bg-input border border-border/40 text-foreground rounded-lg px-2 py-1.5 flex-shrink-0"
              >
                <option value="">All months</option>
                {months.map(m => <option key={m} value={m}>{m.replace("_", " ")}</option>)}
              </select>
              <select
                value={filterTeam}
                onChange={e => setFilterTeam(e.target.value)}
                className="text-xs bg-input border border-border/40 text-foreground rounded-lg px-2 py-1.5 flex-shrink-0"
              >
                <option value="">All teams</option>
                {teams.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={filterSeverity}
                onChange={e => setFilterSeverity(e.target.value)}
                className="text-xs bg-input border border-border/40 text-foreground rounded-lg px-2 py-1.5 flex-shrink-0"
              >
                <option value="">All severity</option>
                <option value="warning">⚠️ Warning</option>
                <option value="high">🔶 High</option>
                <option value="critical">🔴 Critical</option>
              </select>
            </div>
          )}

          {/* Alert List */}
          <div className="overflow-y-auto flex-1">
            {loading && alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                <svg className="w-6 h-6 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-sm">Scanning team sheets…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-3">
                <span className="text-3xl">✅</span>
                <span className="text-sm font-medium">No capacity alerts</span>
                <span className="text-xs">All teams are within allocated hours</span>
              </div>
            ) : (
              <div className="divide-y divide-border/20">
                {filtered.map(alert => {
                  const isRead = readIds.has(alert.id);
                  const styles = getSeverityStyles(alert.severity);
                  return (
                    <div
                      key={alert.id}
                      onClick={() => markRead(alert.id)}
                      className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-hover-bg transition-colors ${!isRead ? "bg-primary/5" : ""}`}
                    >
                      {/* Severity dot */}
                      <div className="flex-shrink-0 mt-1">
                        <span className={`block w-2 h-2 rounded-full ${styles.dot} ${!isRead ? "ring-2 ring-offset-1 ring-offset-card ring-current opacity-80" : ""}`} />
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-sm font-semibold text-foreground truncate">{alert.client}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${styles.badge}`}>
                            {styles.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground/70 font-medium">{alert.team}</span>
                          <span className="text-[10px] text-muted-foreground/50">·</span>
                          <span className="text-[10px] text-muted-foreground/70">{alert.month.replace("_", " ")}</span>
                          <span className="text-[10px] text-muted-foreground/50">·</span>
                          <span className={`text-[10px] font-bold ${alert.overUnder >= 150 ? "text-red-400" : alert.overUnder >= 120 ? "text-orange-400" : "text-yellow-400"}`}>
                            {alert.overUnder.toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {filtered.length > 0 && (
            <div className="px-4 py-2 border-t border-border/30 flex-shrink-0">
              <p className="text-xs text-muted-foreground text-center">
                Showing {filtered.length} of {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
              </p>
            </div>
          )}

          {/* Mobile action buttons */}
          {alerts.length > 0 && (
            <div className="px-4 py-2 border-t border-border/30 flex-shrink-0 flex gap-2 md:hidden">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-2 rounded-lg hover:bg-hover-bg"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={clearAll}
                className="flex-1 text-xs text-red-400 hover:text-red-300 transition-colors py-2 rounded-lg hover:bg-hover-bg"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}