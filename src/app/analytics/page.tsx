import { ChartNoAxesCombined } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export default function AnalyticsPage() {
  return (
    <ComingSoon
      title="Analytics"
      icon={ChartNoAxesCombined}
      description="Placement, demographic and device breakdowns land in Phase 2 once ad set/ad-level sync is built (PRD §11)."
    />
  );
}
