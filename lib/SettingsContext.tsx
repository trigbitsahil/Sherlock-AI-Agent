"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface SettingsContextType {
  apiKey: string;
  setApiKey: (key: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (isOpen: boolean) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKeyState] = useState("");
  const [selectedModel, setSelectedModelState] = useState("minimax/minimax-m3");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    // Load initial from API (which reads from Redis KV)
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data.apiKey) setApiKeyState(data.apiKey);
        if (data.selectedModel) setSelectedModelState(data.selectedModel);
      })
      .catch(err => console.error("Failed to load settings:", err));
  }, []);

  const saveSettings = async (key: string, model: string) => {
    try {
      await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key, selectedModel: model })
      });
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  const setApiKey = (key: string) => {
    setApiKeyState(key);
    saveSettings(key, selectedModel);
  };

  const setSelectedModel = (model: string) => {
    setSelectedModelState(model);
    saveSettings(apiKey, model);
  };

  return (
    <SettingsContext.Provider
      value={{
        apiKey,
        setApiKey,
        selectedModel,
        setSelectedModel,
        isSettingsOpen,
        setIsSettingsOpen,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
