"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { signIn } from "./actions";

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [error, formAction, isPending] = useActionState(signIn, null);

  return (
    <form action={formAction} className="space-y-4 bg-surface border border-border rounded-[var(--radius-lg)] p-6">
      <input type="hidden" name="redirect" value={redirectTo} />

      <div className="space-y-1.5">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full h-9 px-3 rounded-[var(--radius-sm)] border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full h-9 px-3 rounded-[var(--radius-sm)] border border-border bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {error && <p className="text-sm text-danger-fg">{error}</p>}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
