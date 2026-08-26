"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function HeaderSearch() {
  const router = useRouter();
  const [value, setValue] = useState("");

  function submit() {
    const q = value.trim();
    router.push(q ? `/campaigns?q=${encodeURIComponent(q)}` : "/campaigns");
  }

  return (
    <div className="relative hidden md:block w-72">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder="Search campaigns…"
        className="w-full h-9 pl-9 pr-3 rounded-[var(--radius-sm)] border border-border bg-surface-muted text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/20 focus:bg-surface"
        aria-label="Search campaigns"
      />
    </div>
  );
}
