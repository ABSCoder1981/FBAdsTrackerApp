import { Wallet } from "lucide-react";
import { ComingSoon } from "@/components/ComingSoon";

export default function SpendPage() {
  return (
    <ComingSoon
      title="Spend"
      icon={Wallet}
      description="Budget pacing and account-level spend breakdowns are planned once ad-account grouping is added (PRD §12 Q6)."
    />
  );
}
