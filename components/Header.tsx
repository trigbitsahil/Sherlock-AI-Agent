"use client";

import React, { useState } from "react";
import { NotificationCenter } from "./NotificationCenter";
import { useTheme } from "@/lib/ThemeContext";
import { useRouter, usePathname } from "next/navigation";
import { useSettings } from "@/lib/SettingsContext";
import { SettingsModal } from "./SettingsModal";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const { setIsSettingsOpen } = useSettings();
  const [loggingOut, setLoggingOut] = useState(false);
  const isLoginPage = pathname === "/login";

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (e) {
      console.error(e);
      setLoggingOut(false);
    }
  };

  return (
    <header className="w-full bg-background border-b border-border sticky top-0 z-50 flex-shrink-0">
      <div className="w-full py-3 md:py-5 px-4 md:px-6 flex items-center justify-between relative">
        {/* Left: title */}
        <div className="flex items-center flex-shrink-0">
          <h1 className="text-lg md:text-3xl font-bold text-foreground whitespace-nowrap">
            Sherlock <span className="text-primary  sm:inline">AI Agent</span>
          </h1>
        </div>

        {/* Center: logo — only visible on md+ so it never overlaps mobile buttons */}
        <div className="hidden md:block absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none">
          <div className="logo-wrapper p-2 rounded-lg flex items-center shadow-sm pointer-events-auto">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/0/0c/SHERLOCK-VECTOR-LOGO-TRANSPARENT.png"
              alt="Sherlock Communications Logo"
              className="h-10 lg:h-12 w-auto object-contain logo-image"
            />
          </div>
        </div>

        {/* Right: buttons — always visible, never hidden */}
        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
          {!isLoginPage && <NotificationCenter />}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-card border border-border/50 text-foreground hover:bg-card/80 transition-colors duration-200 text-sm"
            title="Toggle Theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          {!isLoginPage && (
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 rounded-lg bg-card border border-border/50 text-foreground hover:bg-card/80 transition-colors duration-200 flex items-center justify-center"
              title="Settings"
            >
              <svg className="w-5 h-5 text-muted-foreground hover:text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
          {!isLoginPage && (
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-2.5 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition-colors duration-200 text-xs md:text-sm font-medium"
              title="Logout"
            >
              Logout
            </button>
          )}
        </div>
      </div>
      {!isLoginPage && <SettingsModal />}
    </header>
  );
}
