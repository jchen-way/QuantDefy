import Link from "next/link";
import { DataConnectionState } from "@/components/data-connection-state";
import { TradesWorkspace } from "@/components/trades-workspace";
import { WorkspaceShell } from "@/components/workspace-shell";
import { buildAnalyticsSnapshot } from "@/lib/domain/analytics";
import { requireCurrentUser } from "@/lib/server/auth";
import { getDatabaseConnectionErrorMessage } from "@/lib/server/store-neon";
import { getStoreSummary } from "@/lib/server/store";

export default async function TradesPage() {
  const user = await requireCurrentUser();
  let store;

  try {
    store = await getStoreSummary(user.id);
  } catch (error) {
    return (
      <WorkspaceShell
        currentPath="/trades"
        title="Trade journal"
        description="The trade journal is temporarily unavailable because the data connection did not respond."
        actions={
          <Link
            href="/trades/new"
            className="rounded-full bg-[linear-gradient(135deg,#f5bc75,#e27847)] px-5 py-3 text-sm font-semibold text-[#091019] shadow-[0_14px_34px_rgba(241,124,71,0.24)] transition hover:translate-y-[-1px]"
          >
            New trade
          </Link>
        }
      >
        <DataConnectionState message={getDatabaseConnectionErrorMessage(error)} />
      </WorkspaceShell>
    );
  }

  const snapshot = buildAnalyticsSnapshot(store.trades, store.insightReports, store.settings.timezone);

  return (
    <WorkspaceShell
      currentPath="/trades"
      title="Trade journal"
      description="Search, filter, and review every trade with thesis notes, structured tags, and linked screenshots."
      actions={
        <Link
          href="/trades/new"
          className="rounded-full bg-[linear-gradient(135deg,#f5bc75,#e27847)] px-5 py-3 text-sm font-semibold text-[#091019] shadow-[0_14px_34px_rgba(241,124,71,0.24)] transition hover:translate-y-[-1px]"
        >
          New trade
        </Link>
      }
    >
      <TradesWorkspace trades={snapshot.trades} presets={store.filterPresets} />
    </WorkspaceShell>
  );
}
