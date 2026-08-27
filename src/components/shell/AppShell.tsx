"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  HelpCircle,
  Menu,
  Settings,
  X,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
} from "lucide-react";
import { NAV_ITEMS } from "./navItems";
import { HeaderSearch } from "./HeaderSearch";
import { ThemeToggle } from "./ThemeToggle";
import { signOut } from "@/app/login/actions";

export function AppShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string | null;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  const activeHref =
    NAV_ITEMS.find((item) => item.href !== "/" && pathname.startsWith(item.href))?.href ??
    (pathname === "/" ? "/" : undefined);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col shrink-0 border-r border-chrome-border bg-chrome-bg transition-[width] duration-150 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <SidebarContent collapsed={collapsed} activeHref={activeHref} />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 px-4 py-3 text-xs text-chrome-fg hover:text-chrome-fg-hover border-t border-chrome-border"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
          {!collapsed && "Collapse"}
        </button>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-64 bg-chrome-bg flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-chrome-border">
              <span className="font-semibold text-sm text-chrome-fg-hover">FB Ads Tracker</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu" className="text-chrome-fg">
                <X size={18} />
              </button>
            </div>
            <SidebarContent collapsed={false} activeHref={activeHref} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 shrink-0 border-b border-chrome-border bg-chrome-bg flex items-center justify-between px-4 md:px-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden -ml-1 p-1.5 text-chrome-fg-hover"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <span className="font-semibold text-sm truncate text-chrome-fg-hover">
              {NAV_ITEMS.find((i) => i.href === activeHref)?.label ?? "FB Ads Tracker"}
            </span>
          </div>

          <HeaderSearch />

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <button
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-chrome-fg hover:text-chrome-fg-hover hover:bg-chrome-bg-active"
              aria-label="Notifications"
            >
              <Bell size={17} strokeWidth={1.75} />
            </button>
            <button
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-chrome-fg hover:text-chrome-fg-hover hover:bg-chrome-bg-active"
              aria-label="Help"
            >
              <HelpCircle size={17} strokeWidth={1.75} />
            </button>
            <Link
              href="/settings"
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-chrome-fg hover:text-chrome-fg-hover hover:bg-chrome-bg-active"
              aria-label="Settings"
            >
              <Settings size={17} strokeWidth={1.75} />
            </Link>
            <div
              className="h-8 w-8 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center ml-1"
              title={userEmail ?? undefined}
            >
              {userEmail ? userEmail[0].toUpperCase() : "?"}
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="h-9 w-9 flex items-center justify-center rounded-[var(--radius-sm)] text-chrome-fg hover:text-chrome-fg-hover hover:bg-chrome-bg-active"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut size={17} strokeWidth={1.75} />
              </button>
            </form>
          </div>
        </header>

        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({
  collapsed,
  activeHref,
  onNavigate,
}: {
  collapsed: boolean;
  activeHref?: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="h-14 flex items-center gap-2.5 px-4 border-b border-chrome-border shrink-0">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-primary text-primary-foreground font-bold text-sm">
          F
        </span>
        {!collapsed && <span className="font-semibold text-sm truncate text-chrome-fg-hover">FB Ads Tracker</span>}
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === activeHref;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-3 rounded-[var(--radius-sm)] px-2.5 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-chrome-bg-active text-chrome-fg-active font-medium"
                  : "text-chrome-fg hover:bg-chrome-bg-active hover:text-chrome-fg-hover"
              }`}
            >
              <Icon size={17} strokeWidth={2} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
