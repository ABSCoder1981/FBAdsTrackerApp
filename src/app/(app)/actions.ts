"use server";

import { revalidatePath } from "next/cache";
import { runSync } from "@/lib/sync";

export async function triggerSync() {
  const result = await runSync();
  revalidatePath("/");
  revalidatePath("/campaigns");
  revalidatePath("/alerts");
  return result;
}
