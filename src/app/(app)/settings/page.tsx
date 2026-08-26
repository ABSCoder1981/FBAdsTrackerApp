import { Settings } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export default function SettingsPage() {
  return (
    <ComingSoon
      title="Settings"
      icon={Settings}
      description="User management, role assignment and org-wide default thresholds are planned for Phase 2 (PRD §7.6)."
    />
  );
}
