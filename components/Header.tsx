"use client";

import React, { useState } from "react";
import { NotificationCenter } from "./NotificationCenter";
import { useTheme } from "@/lib/ThemeContext";
import { useRouter, usePathname } from "next/navigation";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
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
    </header>
  );
}
