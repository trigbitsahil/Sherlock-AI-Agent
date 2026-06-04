"use client";

import React from "react";
import { NotificationCenter } from "./NotificationCenter";
import { useTheme } from "@/lib/ThemeContext";

export function Header() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="w-full bg-background border-b border-border sticky top-0 z-50 flex-shrink-0">
      <div className="w-full relative py-5 px-6 flex items-center justify-between">
        {/* Left: title/text */}
        <div className="flex items-center">
          <h1 className="text-3xl font-bold text-foreground">
            Sherlock <span className="text-primary">AI Agent</span>
          </h1>
        </div>

        {/* Center: logo */}
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="logo-wrapper p-2 rounded-lg flex items-center shadow-sm">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/0/0c/SHERLOCK-VECTOR-LOGO-TRANSPARENT.png"
              alt="Sherlock Communications Logo"
              className="h-15 w-50 object-contain logo-image"
            />
          </div>
        </div>

        {/* Right: notification + theme toggle */}
        <div className="flex items-center gap-2">
          <NotificationCenter />
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-lg bg-card border border-border/50 text-foreground hover:bg-card/80 transition-colors duration-200 text-sm font-medium"
            title="Toggle Theme"
          >
            {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>
    </header>
  );
}
