import { redirect } from "next/navigation";
import { AuthEntryForm } from "@/components/auth-entry-form";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/server/auth";
import { isGoogleOauthConfigured } from "@/lib/server/google-oauth";

export default async function RegisterPage({
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
      mode="register"
      title="Create account"
      description="Create a private trading journal account backed by a real session and per-user data store."
    >
      <AuthEntryForm
        mode="register"
        googleEnabled={isGoogleOauthConfigured()}
        authError={params.authError ?? null}
      />
    </AuthShell>
  );
}
