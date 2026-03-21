import { redirect } from "next/navigation";
import { AuthEntryForm } from "@/components/auth-entry-form";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/server/auth";
import { isGoogleOauthConfigured } from "@/lib/server/google-oauth";

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ authError?: string }>;
}) {
  const user = await getCurrentUser();
  if (user) {
    redirect("/app");
  }
  const params = await searchParams;

  return (
    <AuthShell
      mode="login"
      title="Sign in"
      description="Access your journal, daily review calendar, uploads, and analytics with a real account session."
    >
      <AuthEntryForm
        mode="login"
        googleEnabled={isGoogleOauthConfigured()}
        authError={params.authError ?? null}
      />
    </AuthShell>
  );
}
