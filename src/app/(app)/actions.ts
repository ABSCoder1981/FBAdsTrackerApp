"use server";

import { revalidatePath } from "next/cache";
import { runSync } from "@/lib/sync";

export async function triggerSync() {
  // Catch here rather than letting the error propagate: Next.js redacts
  // thrown Server Action errors to a generic message in production builds,
  // which is why the sync button used to show a bare "Sync failed" with no
  // way to diagnose it from the UI.
  try {
    const result = await runSync();
    revalidatePath("/");
    revalidatePath("/campaigns");
    revalidatePath("/alerts");
    return { ...result, error: null as string | null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { fetched: 0, upserted: 0, skipped: 0, error: message };
  }
}
