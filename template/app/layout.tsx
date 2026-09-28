import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { config } from "@/config/site";

// Uses the system font stack defined in globals.css rather than
// next/font/google (Geist), so this builds and runs offline or behind a
// proxy with no external font fetch at build time — a template gets forked
// into environments this project can't predict. Swap in next/font/google
// or next/font/local yourself in this file if you'd prefer a specific
// webfont; the visual system (colors, spacing, type scale) is unaffected
// either way.
export const metadata: Metadata = {
  title: config.metaTitle,
  description: config.metaDescription,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-ink-body">
        {children}
      </body>
    </html>
  );
}
