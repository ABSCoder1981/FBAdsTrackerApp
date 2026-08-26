import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Anon-key + cookie-based client for reading/mutating the auth session in
// server components and actions. Distinct from lib/supabase/server.ts, which
// uses the service-role key to read app data (bypasses RLS by design — see
// PRD §7 Non-Functional Requirements, no per-row access control yet).
export async function createServerAuthClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component without a mutable cookie jar —
            // middleware already refreshes the session, so this is safe to ignore.
          }
        },
      },
    },
  );
}
