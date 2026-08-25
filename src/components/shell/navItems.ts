import {
  LayoutDashboard,
  Megaphone,
  Building2,
  Users,
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

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Campaigns", href: "/campaigns", icon: Megaphone },
  { label: "Clients", href: "/clients", icon: Building2 },
  { label: "Agents", href: "/agents", icon: Users },
  { label: "Analytics", href: "/analytics", icon: ChartNoAxesCombined },
  { label: "Spend", href: "/spend", icon: Wallet },
  { label: "Reports", href: "/reports", icon: FileText },
];
