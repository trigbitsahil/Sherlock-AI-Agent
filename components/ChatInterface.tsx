"use client";

import React, { useState, useRef, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ToolCallCard } from "./ToolCallCard";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ClientForm } from "./ClientForm";
import { ServiceForm } from "./ServiceForm";
import { RevenueDatePicker } from "./RevenueForms";
export function ChatInterface() {
  const [input, setInput] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [showRevenueSubmenu, setShowRevenueSubmenu] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const [selectedModel, setSelectedModel] = useState("minimax/minimax-m2.7");
  const modelRef = useRef(selectedModel);

  useEffect(() => {
    modelRef.current = selectedModel;
  }, [selectedModel]);

  // Bulletproof interception of fetch to completely bypass useChat caching
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      if (typeof input === 'string' && input.startsWith('/api/chat')) {
        try {
          const parsedBody = JSON.parse((init?.body as string) || "{}");
          parsedBody.model = modelRef.current;
          init = { ...init, body: JSON.stringify(parsedBody) };
        } catch (e) {
          console.error("Failed to intercept fetch body", e);
        }
      }
      return originalFetch(input, init);
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const { messages, setMessages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
    onError: (err) => {
      console.error("[Chat] Error:", err);
    },
  });

  const safeInput = input ?? "";

  const isLoading = status === "submitted" || status === "streaming";

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!safeInput.trim() || isLoading) return;
    sendMessage({ text: safeInput });
    setInput("");
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden relative">
      {/* Header moved to layout */}

      {/* Main Content Container - fills remaining height */}
      <div className="flex flex-col flex-1 max-w-5xl mx-auto px-6 py-6 w-full min-h-0">
        {/* Chat Area - only this scrolls */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-5 pr-2 mb-4 min-h-0">
          {messages.length === 0 && (
            <div className="flex flex-col items-start mt-8 mb-4">
              <div className="max-w-sm rounded-2xl px-5 py-4 bg-card text-foreground border border-border/40 mb-4 shadow-sm">
                <div className="text-base leading-relaxed font-medium">
                  Welcome back! 👋
                </div>
                <div className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  What would you like to do today?
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => sendMessage({ text: "Add Client" })}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] hover:from-[#45bbb3] hover:to-[#3a9a7d] text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95"
                >
                  <span>➕</span> Add Client
                </button>
                <button
                  onClick={() => setMessages(prev => [...prev, { id: Math.random().toString(), role: "assistant", content: `{"action": "showServiceForm", "title": "Add Service"}`, parts: [{ type: 'text', text: `{"action": "showServiceForm"}` }] } as any])}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] hover:from-[#45bbb3] hover:to-[#3a9a7d] text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95"
                >
                  <span>📋</span> Add Service
                </button>
              </div>
            </div>
          )}

          {messages.map((m) => {
            // Robustly handle different versions of Vercel AI SDK
            let parts: any[] = m.parts && m.parts.length > 0 ? [...m.parts] : [];

            // CRITICAL FIX: If there are no TEXT parts (only tool-invocations), but m.content has text,
            // the final AI response text is stored in m.content — inject it as a synthetic text part.
            const hasTextPart = parts.some((p: any) => p.type === 'text' && p.text);
            if (!hasTextPart && (m as any).content) {
              parts = [{ type: 'text', text: (m as any).content }, ...parts];
            }

            // If SDK placed toolInvocations directly on the message instead of in parts, append them
            if ((m as any).toolInvocations && (m as any).toolInvocations.length > 0) {
              (m as any).toolInvocations.forEach((ti: any) => {
                if (!parts.find(p => p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === ti.toolCallId)) {
                  parts.push({ type: 'tool-invocation', toolInvocation: ti });
                }
              });
            }

            const textContent = (m as any).content || (parts ? parts.map((p: any) => p.type === "text" ? p.text : "").join("") : "");

            return (
              <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                {/* User bubble */}
                {m.role === "user" && !textContent.startsWith("Generate revenue for") && !textContent.startsWith("Generate a chart of that data") && !textContent.startsWith("Processing request:") && !textContent.startsWith("Cancelled revenue") && (
                  <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-black shadow-md">
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {textContent}
                    </div>
                  </div>
                )}

                {/* Assistant parts */}
                {m.role === "assistant" && parts.map((part: any, pIdx: number) => {
                  if (part.type === "text" && part.text) {
                    // Strip out <think> blocks (both closed and currently streaming unclosed)
                    let content = part.text.replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, "").trim();

                    let hasChartButton = false;
                    const chartRegex = /```json\s*\{\s*"action"\s*:\s*"showChartButton"\s*\}\s*```|\{\s*"action"\s*:\s*"showChartButton"\s*\}/g;
                    if (content.match(chartRegex)) {
                      hasChartButton = true;
                      content = content.replace(chartRegex, "").trim();
                    }

                    if (!content && !hasChartButton) return null; // Don't render empty message bubbles

                    // Check if content is a JSON form action
                    let parsedForm = null;
                    let parsedAction = null;
                    try {
                      const jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*(?:```|$)/) || content.match(/(\{[\s\S]*"action"\s*:\s*"(?:showClientForm|showServiceForm|showRevenueOptions|showRevenueByClientOptions|showRevenueByTeamOptions|showRevenueTeamTimeOptions|showRevenueDatePicker)"[\s\S]*\})/);
                      if (jsonMatch) {
                        const data = JSON.parse(jsonMatch[1]);
                        if (data.action === "showClientForm" || data.action === "showServiceForm") {
                          parsedForm = data;
                        } else if (data.action.startsWith("showRevenue")) {
                          parsedAction = data;
                        }
                      } else if (content.trim().startsWith('{')) {
                        const data = JSON.parse(content.trim());
                        if (data.action === "showClientForm" || data.action === "showServiceForm") {
                          parsedForm = data;
                        } else if (data.action.startsWith("showRevenue")) {
                          parsedAction = data;
                        }
                      }
                    } catch (e) {
                      // ignore
                    }

                    // If it looks like a form but isn't fully parsed yet, hide it while streaming
                    if ((!parsedForm && !parsedAction) && content.includes('"action":')) {
                      return null;
                    }

                    if (parsedAction) {
                      if (parsedAction.action === "showRevenueByClientOptions") {
                        return (
                          <div key={pIdx} className="w-full flex justify-start mb-3">
                            <div className="flex flex-col gap-2">
                              <button onClick={() => setMessages(prev => [...prev, { id: Math.random().toString(), role: 'assistant', content: `{"action": "showRevenueDatePicker", "type": "client", "timeRange": "specific_months"}`, parts: [{ type: 'text', text: `{"action": "showRevenueDatePicker", "type": "client", "timeRange": "specific_months"}` }] } as any])} className="px-4 py-2 border border-border cursor-pointer bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white hover:bg-hover-bg text-foreground rounded-lg text-sm text-left">Generate revenue by specific months</button>
                              <button onClick={() => sendMessage({ text: "Generate revenue for the current month by client from Clients_Sheet" })} className="px-4 py-2 border border-border cursor-pointer bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white hover:bg-hover-bg text-foreground rounded-lg text-sm text-left">Revenue for current month</button>
                              <button onClick={() => sendMessage({ text: "Generate revenue for the current year by client from Clients_Sheet, considering my month tabs only for the current year like January_2026, February_2026, etc." })} className="px-4 py-2 border border-border cursor-pointer bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white hover:bg-hover-bg text-foreground rounded-lg text-sm text-left">Revenue for current year</button>
                              <button onClick={() => setMessages(prev => [...prev, { id: Math.random().toString(), role: 'assistant', content: `{"action": "showRevenueDatePicker", "type": "client", "timeRange": "specific_year"}`, parts: [{ type: 'text', text: `{"action": "showRevenueDatePicker", "type": "client", "timeRange": "specific_year"}` }] } as any])} className="px-4 py-2 border border-border cursor-pointer bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white hover:bg-hover-bg text-foreground rounded-lg text-sm text-left">Revenue for specific year</button>
                            </div>
                          </div>
                        );
                      }
                      if (parsedAction.action === "showRevenueByTeamOptions") {
                        const teams = ["BR AMA", "BR MAU", "BR DAN", "BR FAB", "CSR FAB", "BR MIG", "ARG/URU", "ANDEAN", "CHILE", "CAM/CAR", "MEXICO", "EVENTS", "DIG-SM", "DIG-SEO", "DIG-PM/INBOUND", "DIG-INF", "DESIGN"];
                        return (
                          <div key={pIdx} className="w-full flex justify-start mb-3">
                            <div className="flex flex-wrap gap-2 max-w-lg bg-card p-4 rounded-xl border border-border">
                              <div className="w-full text-sm font-bold mb-2">Select a Team:</div>
                              {teams.map(team => (
                                <button key={team} onClick={() => setMessages(prev => [...prev, { id: Math.random().toString(), role: 'assistant', content: `{"action": "showRevenueTeamTimeOptions", "team": "${team}"}`, parts: [{ type: 'text', text: `{"action": "showRevenueTeamTimeOptions", "team": "${team}"}` }] } as any])} className="px-3 py-1.5 border border-border bg-input hover:bg-hover-bg text-foreground rounded-lg text-sm">
                                  {team}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      if (parsedAction.action === "showRevenueTeamTimeOptions") {
                        return (
                          <div key={pIdx} className="w-full flex justify-start mb-3">
                            <div className="flex flex-col gap-2">
                              <div className="text-sm font-bold text-blue-400 mb-1">Team: {parsedAction.team}</div>
                              <button onClick={() => setMessages(prev => [...prev, { id: Math.random().toString(), role: 'assistant', content: `{"action": "showRevenueDatePicker", "type": "team", "team": "${parsedAction.team}", "timeRange": "specific_months"}`, parts: [{ type: 'text', text: `{"action": "showRevenueDatePicker", "type": "team", "team": "${parsedAction.team}", "timeRange": "specific_months"}` }] } as any])} className="px-4 py-2 border border-border cursor-pointer bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white hover:bg-hover-bg text-foreground rounded-lg text-sm text-left">Generate revenue by specific months</button>
                              <button onClick={() => sendMessage({ text: `Generate revenue for the current month for team ${parsedAction.team} from Services Lookup Sheet` })} className="px-4 py-2 border border-border cursor-pointer bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white hover:bg-hover-bg text-foreground rounded-lg text-sm text-left">Revenue for current month</button>
                              <button onClick={() => sendMessage({ text: `Generate revenue for the current year for team ${parsedAction.team} from Services Lookup Sheet, considering month tabs only for the current year.` })} className="px-4 py-2 border border-border cursor-pointer bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white hover:bg-hover-bg text-foreground rounded-lg text-sm text-left">Revenue for current year</button>
                              <button onClick={() => setMessages(prev => [...prev, { id: Math.random().toString(), role: 'assistant', content: `{"action": "showRevenueDatePicker", "type": "team", "team": "${parsedAction.team}", "timeRange": "specific_year"}`, parts: [{ type: 'text', text: `{"action": "showRevenueDatePicker", "type": "team", "team": "${parsedAction.team}", "timeRange": "specific_year"}` }] } as any])} className="px-4 py-2 border border-border cursor-pointer bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white hover:bg-hover-bg text-foreground rounded-lg text-sm text-left">Revenue for specific year</button>
                            </div>
                          </div>
                        );
                      }
                      if (parsedAction.action === "showRevenueDatePicker") {
                        return (
                          <div key={pIdx} className="w-full flex justify-start mb-3">
                            <RevenueDatePicker
                              type={parsedAction.type}
                              timeRange={parsedAction.timeRange}
                              team={parsedAction.team}
                              onSubmit={(msg: string) => {
                                // Add a temporary confirmation message
                                setMessages(prev => [...prev, { id: Math.random().toString(), role: 'assistant', content: `Processing request: ${msg}`, parts: [{ type: 'text', text: `Processing request...` }] } as any]);
                                sendMessage({ text: msg });
                              }}
                              onCancel={() => {
                                setMessages(prev => [...prev, { id: Math.random().toString(), role: 'assistant', content: `Cancelled revenue generation.`, parts: [{ type: 'text', text: `Cancelled.` }] } as any]);
                              }}
                            />
                          </div>
                        );
                      }
                    }

                    if (parsedForm) {
                      if (parsedForm.action === "showClientForm") {
                        return (
                          <div key={pIdx} className="w-full flex justify-start mb-3">
                            <ClientForm
                              title={parsedForm.title || "Add Client"}
                              fields={parsedForm.fields || []}
                              onSubmit={async (formData) => {
                                try {
                                  const res = await fetch("/api/clients", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify(formData)
                                  });
                                  const result = await res.json();

                                  if (!res.ok) {
                                    setMessages(prev => [...prev, {
                                      id: Math.random().toString(),
                                      role: 'assistant',
                                      content: `❌ **Submission Failed**: ${result.error}`,
                                      parts: [{ type: 'text', text: `❌ **Submission Failed**: ${result.error}` }]
                                    } as any]);
                                  } else {
                                    const monthsList = formData.months.map((m: string) => `- ${m.replace('_', ' ')}: ${formData.budgetHours[m]} hours`).join('\n');
                                    setMessages(prev => [...prev, {
                                      id: Math.random().toString(),
                                      role: 'assistant',
                                      content: `✅ **Success!** I've added **${formData.clientName}** to the sheets.\n\n**Months Added:**\n${monthsList}\n\n- **Type:** ${formData.clientType}\n- **SOW:** [${formData.sow}](${formData.sowLink})\n- **Rate:** $${formData.hourlyRate}`,
                                      parts: [{ type: 'text', text: `✅ **Success!** I've added **${formData.clientName}** to the sheets.\n\n**Months Added:**\n${monthsList}\n\n- **Type:** ${formData.clientType}\n- **SOW:** [${formData.sow}](${formData.sowLink})\n- **Rate:** $${formData.hourlyRate}` }]
                                    } as any]);
                                  }
                                } catch (e: any) {
                                  setMessages(prev => [...prev, {
                                    id: Math.random().toString(),
                                    role: 'assistant',
                                    content: `❌ **Error**: Failed to connect to server.`,
                                    parts: [{ type: 'text', text: `❌ **Error**: Failed to connect to server.` }]
                                  } as any]);
                                }
                              }}
                              onCancel={() => {
                                setMessages(prev => [...prev, {
                                  id: Math.random().toString(),
                                  role: 'assistant',
                                  content: `Form cancelled.`,
                                  parts: [{ type: 'text', text: `Form cancelled.` }]
                                } as any]);
                              }}
                            />
                          </div>
                        );
                      } else if (parsedForm.action === "showServiceForm") {
                        return (
                          <div key={pIdx} className="w-full flex justify-start mb-3 animate-in fade-in slide-in-from-bottom-2">
                            <ServiceForm
                              onSubmit={(result: any, payload: any) => {
                                if (result.error) {
                                  setMessages(prev => [...prev, {
                                    id: Math.random().toString(),
                                    role: 'assistant',
                                    content: `❌ **Service Allocation Failed**: ${result.error}`,
                                    parts: [{ type: 'text', text: `❌ **Service Allocation Failed**: ${result.error}` }]
                                  } as any]);
                                } else {
                                  setMessages(prev => [...prev, {
                                    id: Math.random().toString(),
                                    role: 'assistant',
                                    content: `✅ **Success!** Team services successfully allocated for **${payload.clientName}** across ${payload.months.length} month(s).`,
                                    parts: [{ type: 'text', text: `✅ **Success!** Team services successfully allocated for **${payload.clientName}** across ${payload.months.length} month(s).` }]
                                  } as any]);
                                }
                              }}
                              onCancel={() => {
                                setMessages(prev => [...prev, {
                                  id: Math.random().toString(),
                                  role: 'assistant',
                                  content: `Service allocation cancelled.`,
                                  parts: [{ type: 'text', text: `Service allocation cancelled.` }]
                                } as any]);
                              }}
                            />
                          </div>
                        );
                      }
                    }

                    let finalContent = content;

                    // Hide incomplete markdown links while they are streaming so raw URLs don't flash
                    finalContent = finalContent.replace(/\[([^\]]*)\]\([^)]*$/, "$1...");

                    // Force tight lists by removing double newlines before list items
                    finalContent = finalContent.replace(/\n\s*\n\s*-/g, '\n-');
                    finalContent = finalContent.replace(/\n\s*\n\s*\*/g, '\n*');

                    // Hide raw SVG lines while streaming
                    const lastSvgStart = finalContent.lastIndexOf("<svg");
                    const lastSvgEnd = finalContent.lastIndexOf("</svg>");

                    if (lastSvgStart !== -1 && (lastSvgEnd === -1 || lastSvgEnd < lastSvgStart)) {
                      // SVG is incomplete
                      finalContent = finalContent.substring(0, lastSvgStart) + "\n\n*(Generating chart... 📊)*";
                    }

                    const renderedContent = finalContent.split(/(<svg[\s\S]*?<\/svg>)/i).map((partStr: string, i: number) => {
                      if (/^<svg/i.test(partStr)) {
                        return (
                          <div key={i} className="relative group w-full my-4 rounded-xl border border-border/30 overflow-hidden bg-card/50">
                            <button
                              onClick={() => {
                                let cleanSvg = partStr;
                                let w = 1200;
                                let h = 600;
                                const vbMatch = cleanSvg.match(/viewBox=["']([^"']+)["']/i);
                                if (vbMatch) {
                                  const parts = vbMatch[1].split(/[\s,]+/).filter(Boolean);
                                  if (parts.length >= 4) {
                                    w = parseInt(parts[2], 10) || w;
                                    h = parseInt(parts[3], 10) || h;
                                  }
                                }

                                cleanSvg = cleanSvg.replace(/<svg([^>]+)>/i, (match, attrs) => {
                                  let newAttrs = attrs.replace(/\b(width|height)=["'][^"']*["']/ig, '');
                                  if (!newAttrs.includes('xmlns=')) {
                                    newAttrs += ' xmlns="http://www.w3.org/2000/svg"';
                                  }
                                  return `<svg width="${w}" height="${h}" ${newAttrs}>`;
                                });

                                const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(cleanSvg);

                                const img = new Image();
                                img.onload = () => {
                                  const canvas = document.createElement('canvas');
                                  canvas.width = w;
                                  canvas.height = h;

                                  const ctx = canvas.getContext('2d');
                                  if (ctx) {
                                    ctx.fillStyle = '#1a1a2e';
                                    ctx.fillRect(0, 0, w, h);
                                    ctx.drawImage(img, 0, 0, w, h);

                                    try {
                                      const a = document.createElement('a');
                                      a.href = canvas.toDataURL('image/png');
                                      a.download = 'revenue_chart.png';
                                      a.click();
                                    } catch (e) {
                                      console.error("Canvas export failed:", e);
                                      // Fallback to SVG download if tainted
                                      const fallbackA = document.createElement('a');
                                      fallbackA.href = url;
                                      fallbackA.download = 'revenue_chart.svg';
                                      fallbackA.click();
                                    }
                                  }
                                  URL.revokeObjectURL(url);
                                };
                                img.onerror = () => {
                                  console.error("Failed to load SVG into Image");
                                  URL.revokeObjectURL(url);
                                };
                                img.src = url;
                              }}
                              className="absolute top-3 right-3 bg-card border border-border/40 hover:bg-gradient-to-r hover:from-[#4ecdc4] hover:to-[#44a08d] text-foreground hover:text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all flex items-center gap-2 text-xs font-semibold z-10 shadow-sm"
                              title="Download Chart"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                              Download
                            </button>
                            <span
                              className="block w-full overflow-x-auto overflow-y-auto"
                              style={{ maxHeight: "80vh" }}
                              dangerouslySetInnerHTML={{ __html: partStr }}
                            />
                          </div>
                        );
                      }
                      return (
                        <div key={i} className="prose prose-sm max-w-none prose-a:text-blue-600 dark:prose-invert dark:prose-a:text-blue-400 hover:prose-a:text-blue-700 prose-th:bg-card/50 prose-td:border-border/30 prose-p:m-0 prose-li:m-0 prose-ul:m-0 prose-headings:m-0 whitespace-pre-wrap text-foreground [&_*]:text-foreground [&_strong]:text-foreground [&_th]:text-foreground [&_td]:text-foreground [&_li]:text-foreground [&_p]:text-foreground">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              table: ({ node, ...props }) => (
                                <div className="relative group w-full my-4 overflow-hidden rounded-lg border border-border/30 bg-card/50">
                                  <button
                                    onClick={(e) => {
                                      // Extract data from the rendered table
                                      const tableContainer = e.currentTarget.nextElementSibling;
                                      const tableNode = tableContainer?.querySelector('table');
                                      if (!tableNode) return;

                                      const rows = Array.from(tableNode.querySelectorAll('tr'));
                                      const csv = rows.map(row => {
                                        const cells = Array.from(row.querySelectorAll('th, td'));
                                        return cells.map(cell => {
                                          const text = cell.textContent?.replace(/"/g, '""') || '';
                                          return `"${text}"`;
                                        }).join(',');
                                      }).join('\n');

                                      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                                      const url = URL.createObjectURL(blob);
                                      const a = document.createElement('a');
                                      a.href = url;
                                      a.download = 'table_data.csv';
                                      a.click();
                                      URL.revokeObjectURL(url);
                                    }}
                                    className="absolute top-3 right-3 bg-card border border-border/40 hover:bg-gradient-to-r hover:from-[#4ecdc4] hover:to-[#44a08d] text-foreground hover:text-white p-2 rounded-lg   transition-all flex items-center gap-2 text-xs font-semibold z-10 shadow-sm"
                                    title="Download"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    Download
                                  </button>
                                  <div className="overflow-x-auto w-full p-3">
                                    <table className="w-full text-sm text-left m-0" {...props} />
                                  </div>
                                </div>
                              ),
                              a: ({ node, ...props }) => (
                                <a {...props} target="_blank" rel="noopener noreferrer" />
                              )
                            }}
                          >
                            {partStr}
                          </ReactMarkdown>
                        </div>
                      );
                    });

                    return (
                      <div key={pIdx} className="flex flex-col items-start gap-2">
                        {content && (
                          <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-card text-foreground border border-border/40 shadow-sm">
                            <div className="text-sm leading-relaxed">{renderedContent}</div>
                          </div>
                        )}
                        {hasChartButton && (
                          <button
                            onClick={() => sendMessage({ text: "Generate a chart of that data" })}
                            className="px-4 py-2 bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] text-white rounded-lg text-sm font-semibold shadow-md flex items-center gap-2 hover:scale-[1.02] transition-transform ml-2 mb-2"
                          >
                            <span>📈</span> Generate Chart
                          </button>
                        )}
                      </div>
                    );
                  }

                  if (part.type === "tool-invocation") {
                    const ti = part.toolInvocation;
                    return (
                      <div key={pIdx} className="w-full max-w-[85%] mb-3">
                        <ToolCallCard
                          toolName={ti.toolName}
                          args={ti.args}
                          result={ti.state === "result" ? ti.result : undefined}
                        />
                      </div>
                    );
                  }

                  return null;
                })}
              </div>
            );
          })}

          {/* Inline Action for Assistant Responses */}
          {messages.length > 0 && messages[messages.length - 1].role === "assistant" && !isLoading && (
            <div className="flex flex-col items-start mt-6 mb-3 animate-in fade-in slide-in-from-bottom-2">
              <div className="max-w-sm rounded-2xl px-5 py-4 bg-card text-foreground border border-border/40 mb-3 shadow-sm">
                <div className="text-sm leading-relaxed">
                  Would you like to do anything else?
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => sendMessage({ text: "Add Client" })}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] hover:from-[#45bbb3] hover:to-[#3a9a7d] text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95"
                >
                  <span>➕</span> Add Client
                </button>
                <button
                  onClick={() => setMessages(prev => [...prev, { id: Math.random().toString(), role: "assistant", content: `{"action": "showServiceForm", "title": "Add Service"}`, parts: [{ type: 'text', text: `{"action": "showServiceForm"}` }] } as any])}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] hover:from-[#45bbb3] hover:to-[#3a9a7d] text-white rounded-lg text-sm font-semibold transition-all duration-200 flex items-center justify-center gap-2 shadow-md hover:shadow-lg active:scale-95"
                >
                  <span>📋</span> Add Service
                </button>
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex gap-3 items-center text-muted-foreground">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <span className="text-sm">Thinking...</span>
            </div>
          )}
        </div>

        {/* Input Area - Sticky at Bottom */}
        <div className="border-t border-border/30 bg-background pt-4 flex-shrink-0">
          <form onSubmit={handleSubmit} className="flex flex-wrap md:flex-nowrap gap-2 md:gap-3 relative">

            {/* Action Menu & Text Input (Always on one line) */}
            <div className="flex gap-2 w-full md:w-auto md:flex-1">
              <div className="relative flex-shrink-0" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowMenu(!showMenu)}
                  className="w-12 h-12 flex items-center justify-center rounded-lg bg-input text-foreground border border-border hover:bg-hover-bg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-primary z-10 relative"
                >
                  <svg className={`w-6 h-6 transition-transform duration-200 ${showMenu ? 'rotate-45' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                </button>

                {/* Popup Menu */}
                {showMenu && (
                  <div className="absolute bottom-full left-0 mb-2 w-56 bg-card rounded-lg shadow-xl border border-border overflow-visible z-50">
                    <button
                      type="button"
                      onClick={() => {
                        sendMessage({ text: "Add Client" });
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-hover-bg flex items-center gap-3 transition-colors rounded-t-lg"
                    >
                      <span>➕</span> Add Client
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMessages(prev => [...prev, { id: Math.random().toString(), role: "assistant", content: `{"action": "showServiceForm", "title": "Add Service"}`, parts: [{ type: 'text', text: `{"action": "showServiceForm"}` }] } as any]);
                        setShowMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-hover-bg flex items-center gap-3 transition-colors border-t border-border/30"
                    >
                      <span>📋</span> Add Service
                    </button>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowRevenueSubmenu(s => !s)}
                        className="w-full text-left px-4 py-3 text-sm text-foreground hover:bg-hover-bg flex items-center justify-between transition-colors border-t border-border/30 rounded-b-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span>📊</span> Generate Revenue
                        </div>
                        <svg className={`w-4 h-4 text-muted-foreground transition-transform ${showRevenueSubmenu ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </button>
                      {/* Submenu - click-based so it works on mobile too */}
                      {showRevenueSubmenu && (
                        <div className="w-full bg-hover-bg rounded-b-lg border-t border-border/20">
                          <button
                            type="button"
                            onClick={() => {
                              setMessages(prev => [...prev, { id: Math.random().toString(), role: "assistant", content: `{"action": "showRevenueByClientOptions"}`, parts: [{ type: 'text', text: `{"action": "showRevenueByClientOptions"}` }] } as any]);
                              setShowMenu(false);
                              setShowRevenueSubmenu(false);
                            }}
                            className="w-full text-left px-6 py-2.5 text-sm text-foreground hover:bg-hover-bg transition-colors"
                          >
                            📋 By Client
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMessages(prev => [...prev, { id: Math.random().toString(), role: "assistant", content: `{"action": "showRevenueByTeamOptions"}`, parts: [{ type: 'text', text: `{"action": "showRevenueByTeamOptions"}` }] } as any]);
                              setShowMenu(false);
                              setShowRevenueSubmenu(false);
                            }}
                            className="w-full text-left px-6 py-2.5 text-sm text-foreground hover:bg-hover-bg transition-colors rounded-b-lg"
                          >
                            👥 By Team
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <input
                type="text"
                placeholder="Ask me anything..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                className="flex-1 w-full min-w-0 px-4 py-3 rounded-lg bg-input text-foreground placeholder-muted-foreground border border-border focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
              />
            </div>

            {/* Model Selector & Send Button (Wraps to next line on mobile) */}
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:flex-none flex items-center">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className=" md:w-[100px] px-2 py-3 h-full bg-input border border-border text-foreground rounded-lg shadow-sm text-xs focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer pr-6 disabled:opacity-50"
                  disabled={isLoading}
                  title="Select AI Model"
                  style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23475569%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right .7rem top 50%', backgroundSize: '.65rem auto' }}
                >
                  <option value="minimax/minimax-m2.7">🚀 MiniMax M2.7 (Default)</option>
                  <option value="openai/gpt-4o">🧠 GPT-4o</option>
                  <option value="openai/gpt-4.1">🧠 GPT-4.1</option>
                  <option value="anthropic/claude-opus-4">💡 Claude Opus 4</option>
                  <option value="anthropic/claude-sonnet-4-5">💡 Claude Sonnet 4.5</option>
                  <option value="google/gemini-2.5-pro">✨ Gemini 2.5 Pro</option>
                  <option value="google/gemini-2.5-flash">✨ Gemini 2.5 Flash</option>
                  <option value="deepseek/deepseek-chat-v3-5">🔬 DeepSeek V3.5</option>
                  <option value="x-ai/grok-3">⚡ Grok 3</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isLoading || !safeInput.trim()}
                className="flex-shrink-0 px-5 py-3 bg-gradient-to-r from-[#4ecdc4] to-[#44a08d] hover:from-[#45bbb3] hover:to-[#3a9a7d] text-white rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg active:scale-95 text-sm"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full border-2 border-white border-r-transparent animate-spin"></span>
                    <span>Sending</span>
                  </span>
                ) : (
                  "Send"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
