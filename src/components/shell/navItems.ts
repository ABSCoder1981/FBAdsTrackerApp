import {
  LayoutDashboard,
  Megaphone,
  Building2,
  ChartNoAxesCombined,
  Wallet,
  FileText,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

// No "Agents" entry: the campaigns.agent_name column is unreliable free text
// (see PRD §4.1/§12 Q7) — it isn't a real identity to build a directory on.
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
  { label: "Spend", href: "/spend", icon: Wallet },
  { label: "Reports", href: "/reports", icon: FileText },
];
