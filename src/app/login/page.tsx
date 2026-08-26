import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <h1 className="text-lg font-semibold">FB Ads Tracker</h1>
          <p className="text-sm text-foreground-muted mt-1">Sign in to continue</p>
        </div>
        <LoginForm redirectTo={redirect ?? "/"} />
      </div>
    </div>
  );
}
