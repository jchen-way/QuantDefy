import { DataConnectionState } from "@/components/data-connection-state";
import { SettingsForm } from "@/components/settings-form";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requireCurrentUser } from "@/lib/server/auth";
import { getDatabaseConnectionErrorMessage } from "@/lib/server/store-neon";
import { getSettings } from "@/lib/server/store";

export default async function SettingsPage() {
  const user = await requireCurrentUser();
  let settings;

  try {
    settings = await getSettings(user.id);
  } catch (error) {
    return (
      <WorkspaceShell
        currentPath="/settings"
        title="Settings"
        description="The settings page is temporarily unavailable because the data connection did not respond."
      >
        <DataConnectionState message={getDatabaseConnectionErrorMessage(error)} />
      </WorkspaceShell>
    );
  }

  const semanticInsightsAvailable = Boolean(process.env.OPENAI_API_KEY);

  return (
    <WorkspaceShell
      currentPath="/settings"
      title="Settings"
      description="Personalize journal defaults, timezone behavior, and the taxonomy used to normalize your weekly review language."
    >
      <SettingsForm settings={settings} semanticInsightsAvailable={semanticInsightsAvailable} />
    </WorkspaceShell>
  );
}
