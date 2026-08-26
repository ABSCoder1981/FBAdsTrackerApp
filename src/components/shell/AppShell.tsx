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
        className={`hidden md:flex flex-col shrink-0 border-r border-border bg-surface transition-[width] duration-150 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        <SidebarContent collapsed={collapsed} activeHref={activeHref} />
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="flex items-center gap-2 px-4 py-3 text-xs text-foreground-muted hover:text-foreground border-t border-border"
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
          <aside className="absolute left-0 top-0 h-full w-64 bg-surface flex flex-col">
            <div className="flex items-center justify-between px-4 h-14 border-b border-border">
              <span className="font-semibold text-sm">FB Ads Tracker</span>
              <button onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <SidebarContent collapsed={false} activeHref={activeHref} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 shrink-0 border-b border-border bg-surface flex items-center justify-between px-4 md:px-6 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden -ml-1 p-1.5"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <span className="font-semibold text-sm truncate">
              {NAV_ITEMS.find((i) => i.href === activeHref)?.label ?? "FB Ads Tracker"}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-foreground-muted hover:bg-surface-muted"
              aria-label="Notifications"
            >
              <Bell size={17} strokeWidth={1.75} />
            </button>
            <button
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-foreground-muted hover:bg-surface-muted"
              aria-label="Help"
            >
              <HelpCircle size={17} strokeWidth={1.75} />
            </button>
            <Link
              href="/settings"
              className="hidden sm:flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-foreground-muted hover:bg-surface-muted"
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
                className="h-9 w-9 flex items-center justify-center rounded-[var(--radius-sm)] text-foreground-muted hover:bg-surface-muted"
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
      <div className="h-14 flex items-center px-4 border-b border-border shrink-0">
        {collapsed ? (
          <span className="font-semibold text-sm">FB</span>
        ) : (
          <span className="font-semibold text-sm truncate">FB Ads Tracker</span>
        )}
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
                  ? "bg-surface-muted text-foreground font-medium"
                  : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <Icon size={17} strokeWidth={1.75} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
