"use server";

import { redirect } from "next/navigation";
import { createServerAuthClient } from "@/lib/supabase/serverAuth";

export async function signIn(_prevState: string | null, formData: FormData): Promise<string | null> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/");

  const supabase = await createServerAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return "Incorrect email or password.";
  }

  redirect(redirectTo || "/");
}

export async function signOut() {
  const supabase = await createServerAuthClient();
  await supabase.auth.signOut();
  redirect("/login");
}
