import Link from "next/link";
import { CalendarDashboard } from "@/components/calendar-dashboard";
import { DataConnectionState } from "@/components/data-connection-state";
import { DistributionCard } from "@/components/distribution-card";
import { LineChartCard } from "@/components/line-chart-card";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { buildAnalyticsSnapshot, buildDashboardData } from "@/lib/domain/analytics";
import { formatDateTime, formatMonthLabelInTimeZone, toCurrency, toPercent } from "@/lib/domain/utils";
import { requireCurrentUser } from "@/lib/server/auth";
import {
  getLatestSemanticInsightsSnapshot,
  isSemanticInsightsAvailable
} from "@/lib/server/semantic-insights";
import { getDatabaseConnectionErrorMessage } from "@/lib/server/store-neon";
import { getStoreSummary } from "@/lib/server/store";

type AppDashboardPageProps = {
  searchParams?: Promise<{ month?: string; day?: string }>;
};

export default async function AppDashboardPage({ searchParams }: AppDashboardPageProps) {
  const user = await requireCurrentUser();
  let store;

  try {
    store = await getStoreSummary(user.id);
  } catch (error) {
    return (
      <WorkspaceShell
        currentPath="/app"
        title="Performance calendar"
        description="The overview is temporarily unavailable because the data connection did not respond."
      >
        <DataConnectionState message={getDatabaseConnectionErrorMessage(error)} />
      </WorkspaceShell>
    );
  }

  const semanticRequested = store.settings.aiInsightsEnabled && store.settings.insightMode === "semantic";
  const semanticAvailable = isSemanticInsightsAvailable();
  const params = (await searchParams) ?? {};
  const currentMonthLabel = formatMonthLabelInTimeZone(new Date().toISOString(), store.settings.timezone);
  const snapshot = buildAnalyticsSnapshot(store.trades, store.insightReports, store.settings.timezone);
  const dashboard = buildDashboardData(
    store.trades,
    store.insightReports,
    store.settings.timezone,
    params.day,
    params.month
  );
  const semanticSnapshot =
    semanticRequested && semanticAvailable ? await getLatestSemanticInsightsSnapshot(user.id) : null;
  const semanticPageData = semanticSnapshot?.payload ?? null;

  return (
    <WorkspaceShell
      currentPath="/app"
      title="Performance calendar"
      description="Track every realized trading day visually, then drill into the trades, screenshots, and process notes that created it."
      actions={
        <>
          <Link
            href="/trades/new"
            className="rounded-full bg-[linear-gradient(135deg,#f5bc75,#e27847)] px-5 py-3 text-sm font-semibold text-[#091019] shadow-[0_14px_34px_rgba(241,124,71,0.24)] transition hover:translate-y-[-1px]"
          >
            Log trade
          </Link>
          <Link href="/analytics" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white">
            Open analytics
          </Link>
        </>
      }
    >
      {store.trades.length === 0 ? (
        <SectionCard
          title="Your review calendar is ready"
          eyebrow="First week setup"
          description="Log your first trade to start building the calendar, distributions, and coaching history."
        >
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4">
              <p className="max-w-2xl text-sm leading-7 text-muted">
                Once trades are in, this becomes your daily review layer: calendar context, trade
                analytics, screenshot-backed journal entries, and recurring coaching summaries.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/trades/new"
                  className="rounded-full bg-[linear-gradient(135deg,#f5bc75,#e27847)] px-5 py-3 text-sm font-semibold text-[#091019] shadow-[0_14px_34px_rgba(241,124,71,0.24)] transition hover:translate-y-[-1px]"
                >
                  Log first trade
                </Link>
                <Link href="/settings" className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white">
                  Review settings
                </Link>
              </div>
            </div>
            <div className="grid gap-3">
              {[
                "Capture fills so P/L and duration metrics stay deterministic.",
                "Attach setup and postmortem screenshots to make review visual.",
                "Use mistake and lesson tags so common pain points can be surfaced.",
                "Close at least a few trades to populate weekly and monthly insight summaries."
              ].map((item) => (
                <div key={item} className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-ink">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Month to date"
          value={toCurrency(dashboard.kpis.realizedMonthToDate)}
          detail={`${currentMonthLabel} realized P/L`}
          accent={dashboard.kpis.realizedMonthToDate >= 0 ? "green" : "red"}
        />
        <StatCard
          label="Week to date"
          value={toCurrency(dashboard.kpis.realizedWeekToDate)}
          detail="Current weekly rollup"
          accent={dashboard.kpis.realizedWeekToDate >= 0 ? "green" : "red"}
        />
        <StatCard label="Win rate" value={toPercent(dashboard.kpis.winRate)} detail="Closed trades only" accent="green" />
        <StatCard label="Open risk" value={toCurrency(dashboard.kpis.openRisk)} detail="Planned risk still live" accent="gold" />
      </div>

      <SectionCard
        title={dashboard.monthLabel}
        eyebrow="Calendar"
        description="Each day rolls up realized P/L from closed trades. Open any day to inspect the journal entries and review notes behind it."
      >
        <CalendarDashboard
          calendarDays={dashboard.calendarDays}
          trades={snapshot.trades.filter((trade) => trade.metrics.status === "closed")}
          initialSelectedDay={dashboard.selectedDay}
          monthLabel={dashboard.monthLabel}
          previousMonthHref={`/app?month=${dashboard.previousMonthKey}`}
          nextMonthHref={`/app?month=${dashboard.nextMonthKey}`}
        />
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <LineChartCard
          title="Cumulative realized P/L"
          eyebrow="Equity curve"
          description="A compact view of how the month is compounding from closed trade outcomes."
          series={dashboard.equityCurve}
          accent={(dashboard.equityCurve.at(-1)?.value ?? 0) >= 0 ? "green" : "red"}
        />
        <SectionCard
          title="Open positions"
          eyebrow="Live risk"
          description="Open trades stay out of realized rollups, but the position risk is still visible here."
        >
          {dashboard.openTrades.length > 0 ? (
            <div className="space-y-3">
              {dashboard.openTrades.map((trade) => (
                <Link
                  key={trade.id}
                  href={`/trades/${trade.id}`}
                  className="block rounded-[1.4rem] border border-white/10 bg-white/5 p-4 transition hover:translate-y-[-1px]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-ink">{trade.symbol}</div>
                      <div className="text-sm text-muted">{trade.setupType}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gold">{toCurrency(trade.plannedRisk)}</div>
                      <div className="text-xs text-muted">planned risk</div>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted">{trade.thesis}</p>
                  <div className="mt-3 text-xs text-muted">Opened {formatDateTime(trade.openedAt)}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-[1.4rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-sm leading-6 text-muted">
              No open trades right now. New live positions will appear here until they are fully closed and rolled into realized analytics.
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <DistributionCard
          title="Trade type mix"
          eyebrow="Distribution"
          description="Which structures are carrying the month versus just consuming attention."
          items={dashboard.tradeTypeDistribution}
        />
        <DistributionCard
          title="Duration distribution"
          eyebrow="Time in trade"
          description="Measure whether your edge is strongest in scalps, intraday holds, or longer position structures."
          items={dashboard.durationDistribution}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <DistributionCard
          title="Capital allocation buckets"
          eyebrow="Sizing profile"
          description="Quick read on where exposure is clustering."
          items={dashboard.capitalDistribution}
        />
        <SectionCard
          title={semanticPageData?.title ?? dashboard.weeklyInsight?.title ?? "Weekly coaching summary"}
          eyebrow="Insights"
          description={
            semanticPageData?.summary ??
            dashboard.weeklyInsight?.summary ??
            "Hybrid insight summaries will appear here once enough trades are logged."
          }
        >
          <div className="space-y-3">
            {(semanticPageData?.bullets ?? dashboard.weeklyInsight?.bullets ?? []).map((bullet) => (
              <div key={bullet} className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-ink">
                {bullet}
              </div>
            ))}
            {semanticPageData?.traderProfile ? (
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-ink">
                <strong>{semanticPageData.traderProfile.label}:</strong> {semanticPageData.traderProfile.nextSteps[0]}
              </div>
            ) : null}
            {!semanticPageData && dashboard.topMistakes.length > 0 ? (
              <div className="rounded-[1.25rem] border border-rose-400/12 bg-rose-400/10 px-4 py-3 text-sm leading-6 text-ink">
                Highest-friction tag so far: <strong>{dashboard.topMistakes[0]?.label}</strong>
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </WorkspaceShell>
  );
}
