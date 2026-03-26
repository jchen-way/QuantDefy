import { AnalyticsWorkspace } from "@/components/analytics-workspace";
import { DataConnectionState } from "@/components/data-connection-state";
import { WorkspaceShell } from "@/components/workspace-shell";
import { buildAnalyticsSnapshot } from "@/lib/domain/analytics";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  getLatestSemanticInsightsSnapshot,
  isSemanticInsightsAvailable
} from "@/lib/server/semantic-insights";
import { getDatabaseConnectionErrorMessage } from "@/lib/server/store-neon";
import { getStoreSummary } from "@/lib/server/store";

export default async function AnalyticsPage() {
  const user = await requireCurrentUser();
  let store;

  try {
    store = await getStoreSummary(user.id);
  } catch (error) {
    return (
      <WorkspaceShell
        currentPath="/analytics"
        title="Analytics and distributions"
        description="The analytics workspace is temporarily unavailable because the data connection did not respond."
      >
        <DataConnectionState message={getDatabaseConnectionErrorMessage(error)} />
      </WorkspaceShell>
    );
  }

  const snapshot = buildAnalyticsSnapshot(store.trades, store.insightReports, store.settings.timezone);
  const semanticRequested = store.settings.aiInsightsEnabled && store.settings.insightMode === "semantic";
  const semanticAvailable = isSemanticInsightsAvailable();
  const semanticSnapshot =
    semanticRequested && semanticAvailable ? await getLatestSemanticInsightsSnapshot(user.id) : null;
  const semanticPageData = semanticSnapshot?.payload ?? null;
  const premiumReviewStatus = semanticPageData
    ? "active"
    : semanticRequested && semanticAvailable
      ? "selected"
      : semanticRequested
        ? "unavailable"
        : "standard";

  return (
    <WorkspaceShell
      currentPath="/analytics"
      title="Analytics and distributions"
      description="Study the P/L curve, sizing profile, duration profile, and recurring pressure points across your journal."
    >
      <AnalyticsWorkspace
        trades={snapshot.trades}
        semanticPageData={semanticPageData}
        premiumReviewStatus={premiumReviewStatus}
      />
    </WorkspaceShell>
  );
}
