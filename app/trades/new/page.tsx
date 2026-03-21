import { TradeForm } from "@/components/trade-form";
import { WorkspaceShell } from "@/components/workspace-shell";
import { requireCurrentUser } from "@/lib/server/auth";
import { getSettings } from "@/lib/server/store";

export default async function NewTradePage() {
  const user = await requireCurrentUser();
  const settings = await getSettings(user.id);

  return (
    <WorkspaceShell
      currentPath="/trades"
      title="Log a trade"
      description="Capture thesis, execution, media, and lessons while the trade details are still precise."
    >
      <TradeForm
        defaultRisk={settings.defaultRisk}
        timezone={settings.timezone}
        customTradeTypes={settings.customTradeTypes}
        customSetupTypes={settings.customSetupTypes}
      />
    </WorkspaceShell>
  );
}
