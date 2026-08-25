import {
  LayoutDashboard,
  Megaphone,
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

// No "Agents" or "Clients" entries: campaigns.agent_name is unreliable free
// text (PRD §4.1/§12 Q7), and the clients table it joins against turned out
// to be the same problem — mostly agent names/localities, not real builders
// (PRD §4.1 update, §12 Q9). Neither is a real identity to build a page on.
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
  { label: "Spend", href: "/spend", icon: Wallet },
  { label: "Reports", href: "/reports", icon: FileText },
];
