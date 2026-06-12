"use client";

import React, { useEffect, useState } from "react";
import { useSettings } from "@/lib/SettingsContext";

const models = [
  { id: "minimax/minimax-m2.7", name: "🚀 MiniMax M2.7" },
  { id: "minimax/minimax-m3", name: "🚀 MiniMax M3 (Default)" },
  { id: "openai/gpt-4o", name: "🧠 GPT-4o" },
  { id: "openai/gpt-4.1", name: "🧠 GPT-4.1" },
  { id: "anthropic/claude-opus-4", name: "💡 Claude Opus 4" },
  { id: "anthropic/claude-sonnet-4-5", name: "💡 Claude Sonnet 4.5 " },
  { id: "google/gemini-2.5-pro", name: "✨ Gemini 2.5 Pro" },
  { id: "google/gemini-2.5-flash", name: "✨ Gemini 2.5 Flash" },
  { id: "deepseek/deepseek-v4-flash", name: "🔬 DeepSeek V4 Flash" },
  { id: "x-ai/grok-3", name: "⚡ Grok 3" },
];

export function SettingsModal() {
  const {
    isSettingsOpen,
    setIsSettingsOpen,
    apiKey,
    setApiKey,
    selectedModel,
    setSelectedModel,
  } = useSettings();
  const [tempKey, setTempKey] = useState(apiKey);
  const [tempModel, setTempModel] = useState(selectedModel);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (isSettingsOpen) {
      setTempKey(apiKey);
      setTempModel(selectedModel);
    }
  }, [isSettingsOpen, apiKey, selectedModel]);

  if (!isSettingsOpen) return null;

  const handleSave = () => {
    setApiKey(tempKey);
    setSelectedModel(tempModel);
    setIsSettingsOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-4 border-b border-border/50 flex justify-between items-center bg-card">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            ⚙️ Settings
          </h2>
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="text-muted-foreground hover:text-foreground hover:bg-card/80 p-1 rounded-md transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">
              OpenRouter API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={tempKey}
                onChange={(e) => setTempKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="w-full pl-3 pr-10 py-2 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary placeholder-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted-foreground hover:text-foreground"
              >
                {showApiKey ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Your API key is securely stored in project settings.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground block">
              Model Selection
            </label>
            <select
              value={tempModel}
              onChange={(e) => setTempModel(e.target.value)}
              className="w-full px-3 py-2 bg-input border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border/50 bg-card/50 flex justify-end gap-3">
          <button
            onClick={() => setIsSettingsOpen(false)}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg shadow hover:bg-primary/90 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
