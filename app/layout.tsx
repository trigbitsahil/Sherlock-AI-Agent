import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Sherlock AI Agent",
  description: "AI Agent for Sherlock Communications",
};

import { ThemeProvider } from "@/lib/ThemeContext";
import { SettingsProvider } from "@/lib/SettingsContext";
import { Header } from "@/components/Header";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col h-screen">
        <SettingsProvider>
          <ThemeProvider>
            <Header />
            <main className="flex-1 overflow-hidden">
              {children}
            </main>
          </ThemeProvider>
        </SettingsProvider>
      </body>
    </html>
  );
}
