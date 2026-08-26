import { FileText } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export default function ReportsPage() {
  return (
    <ComingSoon
      title="Reports"
      icon={FileText}
      description="Scheduled email reports and shareable read-only links are planned for Phase 2 (PRD §7.5)."
    />
  );
}
