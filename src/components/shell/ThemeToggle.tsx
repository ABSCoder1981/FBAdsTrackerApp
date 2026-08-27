"use client";

import { useEffect, useState } from "react";
import { Palette } from "lucide-react";

type Theme = "default" | "finance";

export function ThemeToggle() {
  // Starts "default" to match SSR output exactly (the inline script in
  // layout.tsx already applied the real theme to the DOM before this
  // mounts) — this just syncs the toggle's own visual state to what's
  // already on <html> without causing a hydration mismatch.
  const [theme, setTheme] = useState<Theme>("default");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    // Syncing from the DOM attribute the blocking inline script already set
    // (layout.tsx) — not state derived from React, the lint rule's general
    // case doesn't apply here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(current === "finance" ? "finance" : "default");
  }, []);

  function toggle() {
    const next: Theme = theme === "finance" ? "default" : "finance";
    setTheme(next);
    if (next === "finance") {
      document.documentElement.setAttribute("data-theme", "finance");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private browsing / storage disabled — the toggle still works for
      // this page view, it just won't persist across a reload.
    }
  }

  return (
    <button
      onClick={toggle}
      className="hidden sm:flex h-9 items-center gap-1.5 px-2.5 rounded-[var(--radius-sm)] text-chrome-fg hover:text-chrome-fg-hover hover:bg-chrome-bg-active text-xs font-medium transition-colors"
      aria-label={`Switch to ${theme === "finance" ? "Default" : "Finance"} theme`}
      title={`Switch to ${theme === "finance" ? "Default" : "Finance"} theme`}
    >
      <Palette size={16} strokeWidth={1.75} />
      {theme === "finance" ? "Finance" : "Default"}
    </button>
  );
}
