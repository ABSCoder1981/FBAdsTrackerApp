import { AppShell } from "@/components/shell/AppShell";
import { createServerAuthClient } from "@/lib/supabase/serverAuth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await createServerAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <AppShell userEmail={user?.email ?? null}>{children}</AppShell>;
}
