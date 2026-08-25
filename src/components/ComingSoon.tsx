import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

export function ComingSoon({
  title,
  icon,
  description,
}: {
  title: string;
  icon: LucideIcon;
  description: string;
}) {
  return (
    <main className="p-4 md:p-6 max-w-[1400px] mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-4">{title}</h1>
      <div className="border border-border rounded-[var(--radius-lg)] bg-surface">
        <EmptyState icon={icon} title="Coming soon" description={description} />
      </div>
    </main>
  );
}
