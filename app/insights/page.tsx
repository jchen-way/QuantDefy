import { DataConnectionState } from "@/components/data-connection-state";
import Link from "next/link";
import { InsightRefreshButton } from "@/components/insight-refresh-button";
import { SectionCard } from "@/components/section-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { computeTradeMetrics } from "@/lib/domain/analytics";
import { buildTradeInsight } from "@/lib/domain/insights";
import { requireCurrentUser } from "@/lib/server/auth";
import { getStoreSummary } from "@/lib/server/store";
import {
  buildRecurringThemes,
  getLatestSemanticInsightsSnapshot,
  isSemanticInsightsAvailable
} from "@/lib/server/semantic-insights";
import { getDatabaseConnectionErrorMessage } from "@/lib/server/store-neon";
import { cn, formatShortDate } from "@/lib/domain/utils";

function RuntimeBadge({
  tone,
  label
}: {
  tone: "semantic" | "local";
  label: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-2 text-xs font-medium tracking-[0.01em]",
        tone === "semantic"
          ? "border-emerald-400/14 bg-emerald-400/8 text-emerald-200"
          : "border-white/10 bg-white/5 text-white/58"
      )}
    >
      {label}
    </div>
  );
}

function formatToneLabel(tone: string) {
  if (tone === "warning") {
    return "Advisory";
  }
  if (tone === "reinforcement") {
    return "Reinforcement";
  }
  if (tone === "constructive") {
    return "Constructive";
  }
  return tone.charAt(0).toUpperCase() + tone.slice(1);
}

export default async function InsightsPage() {
  const user = await requireCurrentUser();
  let store;

  try {
    store = await getStoreSummary(user.id);
  } catch (error) {
    return (
      <WorkspaceShell
        currentPath="/insights"
        title="Coaching insights"
        description="The insight workspace is temporarily unavailable because the data connection did not respond."
        actions={<InsightRefreshButton />}
      >
        <DataConnectionState
          title="Unable to load insights right now"
          description="This usually means the data connection failed or timed out. Your account data is not changed; the page just could not load it."
          message={getDatabaseConnectionErrorMessage(error)}
        />
      </WorkspaceShell>
    );
  }

  const tradeLookup = new Map(store.trades.map((trade) => [trade.id, trade]));
  const settings = store.settings;
  const semanticRequested = settings.aiInsightsEnabled && settings.insightMode === "semantic";
  const semanticAvailable = isSemanticInsightsAvailable();
  const weeklyReports = store.insightReports.filter((report) => report.scope === "week");
  const monthlyReports = store.insightReports.filter((report) => report.scope === "month");
  const tradeReports = store.insightReports
    .filter((report) => report.scope === "trade")
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  const recurringThemes = buildRecurringThemes(store.trades);
  const semanticSnapshot =
    semanticRequested && semanticAvailable ? await getLatestSemanticInsightsSnapshot(user.id) : null;
  const semanticPageData = semanticSnapshot?.payload ?? null;
  const runtimeTone = semanticPageData ? "semantic" : "local";
  const runtimeLabel = semanticPageData ? "Semantic mode active" : "Local mode";
  const weeklyCards =
    semanticPageData?.weeklyDigests ??
    weeklyReports.slice(0, 4).map((report) => ({
      scopeKey: report.scopeKey,
      title: report.title,
      summary: report.summary,
      bullets: report.bullets
    }));
  const monthlyCards =
    semanticPageData?.monthlyDigests ??
    monthlyReports.slice(0, 4).map((report) => ({
      scopeKey: report.scopeKey,
      title: report.title,
      summary: report.summary,
      bullets: report.bullets
    }));
  const patternCards =
    semanticPageData?.patternCards ??
    recurringThemes.map((theme) => ({
      label: theme.category === "mistake" ? "friction" : "reinforcement",
      title: theme.value,
      summary: theme.value,
      countLabel: `${theme.count}x`
    }));
  const coachingCards =
    semanticPageData?.coachingCards ??
    tradeReports.slice(0, 4).map((report) => {
      const trade = tradeLookup.get(report.scopeKey);
      const derivedReport = trade ? buildTradeInsight(trade, computeTradeMetrics(trade, settings.timezone)) : report;
      return {
        tradeId: trade?.id ?? report.scopeKey,
        symbol: trade?.symbol ?? "Trade",
        date: trade?.closedAt ? formatShortDate(String(trade.closedAt)) : trade?.openedAt ? formatShortDate(String(trade.openedAt)) : "",
        resultLabel:
          trade && trade.status === "closed"
            ? `${computeTradeMetrics(trade, settings.timezone).result === "loss" ? "-" : computeTradeMetrics(trade, settings.timezone).result === "win" ? "+" : ""}${Math.abs(computeTradeMetrics(trade, settings.timezone).realizedPl)}`
            : "Trade",
        tone: derivedReport.tone,
        headline: derivedReport.title,
        summary: derivedReport.summary,
        bullets: derivedReport.bullets
      };
    });

  return (
    <WorkspaceShell
      currentPath="/insights"
      title="Coaching insights"
      description={
        semanticPageData
          ? semanticPageData.summary
          : "A local pattern engine groups similar tags, review notes, and screenshot captions so your coaching layer reflects repeated evidence instead of exact phrase matches."
      }
      actions={
        <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-1 items-center">
            <RuntimeBadge tone={runtimeTone} label={runtimeLabel} />
          </div>
          <InsightRefreshButton />
        </div>
      }
    >
      {!settings.aiInsightsEnabled ? (
        <SectionCard
          title="Insights are currently disabled"
          eyebrow="Preferences"
          description="Turn the hybrid insight layer back on in settings if you want refreshed coaching summaries and recurring theme detection."
        >
          <div className="flex flex-wrap gap-3">
            <Link
              href="/settings"
              className="rounded-full bg-[linear-gradient(135deg,#f5bc75,#e27847)] px-5 py-3 text-sm font-semibold text-[#091019] shadow-[0_14px_34px_rgba(241,124,71,0.24)] transition hover:translate-y-[-1px]"
            >
              Open settings
            </Link>
          </div>
        </SectionCard>
      ) : null}

      {settings.aiInsightsEnabled && store.trades.length === 0 ? (
        <SectionCard
          title="No insight data yet"
          eyebrow="First journal week"
          description="Insights will start to appear after you log trades with fills and mistake or lesson tags."
        >
          <div className="grid gap-3 lg:grid-cols-2">
            {[
              "Tag mistakes like chased entry, oversized, hesitation, or boredom.",
              "Tag lessons so the monthly review can surface what is actually working.",
              "Upload setup and postmortem charts so the review loop stays visual.",
              "Refresh insights whenever you want a new pass over the current data."
            ].map((item) => (
              <div
                key={item}
                className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-ink"
              >
                {item}
              </div>
            ))}
          </div>
        </SectionCard>
      ) : null}

      {semanticPageData ? (
        <SectionCard
          title={semanticPageData.title}
          eyebrow="Premium mode"
          description="OpenAI-backed review is reading notes, tags, and chart screenshots together to write the current coaching page."
        >
          <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="space-y-3">
              {semanticPageData.bullets.map((bullet) => (
                <div key={bullet} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-ink">
                  {bullet}
                </div>
              ))}
              {semanticPageData.traderProfile.nextSteps.map((step) => (
                <div key={step} className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-ink">
                  {step}
                </div>
              ))}
            </div>
            <div className="grid gap-3">
              {semanticPageData.retrievedTrades.map((trade, index) => (
                <Link
                  key={`${trade.tradeId}-${index}`}
                  href={`/trades/${trade.tradeId}`}
                  className="rounded-[1.3rem] border border-white/10 bg-white/5 p-4 transition hover:translate-y-[-1px]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{trade.symbol}</div>
                      <div className="mt-1 text-sm text-muted">{trade.date}</div>
                    </div>
                    <div className="text-sm font-semibold text-ink">{trade.resultLabel}</div>
                  </div>
                  <div className="mt-3 text-base font-medium tracking-[-0.02em] text-ink">
                    {trade.headline ?? "Retrieved review evidence"}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{trade.takeaway}</p>
                </Link>
              ))}
            </div>
          </div>
        </SectionCard>
      ) : null}

      {semanticPageData ? (
        <SectionCard
          title={semanticPageData.traderProfile.label}
          eyebrow="Trader profile"
          description={semanticPageData.traderProfile.summary}
        >
          <div className="rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-ink">
            {semanticPageData.traderProfile.summary}
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <SectionCard
          title="Weekly digests"
          eyebrow="Weekly digest"
          description={
            weeklyCards[0]?.summary ??
            weeklyReports[0]?.summary ??
            "Weekly insight summaries appear after enough closed trades accumulate."
          }
        >
          <div className="space-y-3">
            {weeklyCards.length === 0 ? (
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-muted">
                No weekly digests yet. Weekly summaries will appear once enough closed trades accumulate in the same week.
              </div>
            ) : null}
            {weeklyCards.map((report, index) => (
              <details
                key={`${report.scopeKey}-${index}`}
                open={index === 0}
                className="group rounded-[1.35rem] border border-white/10 bg-white/5 p-4"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{report.scopeKey}</div>
                      <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-ink">{report.title}</div>
                      <p className="mt-2 pr-4 text-sm leading-6 text-muted">{report.summary}</p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/62 transition group-open:rotate-180">
                      ↓
                    </div>
                  </div>
                </summary>
                <div className="mt-4 space-y-2">
                  {report.bullets.map((bullet) => (
                    <div key={bullet} className="rounded-[1rem] border border-white/10 bg-white/6 px-3 py-2 text-sm leading-6 text-ink">
                      {bullet}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Monthly digests"
          eyebrow="Monthly digest"
          description={
            monthlyCards[0]?.summary ??
            monthlyReports[0]?.summary ??
            "Monthly pattern reviews appear once enough closed trades accumulate in the same month."
          }
        >
          <div className="space-y-3">
            {monthlyCards.length === 0 ? (
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-muted">
                No monthly digests yet. Monthly reviews will appear once enough closed trades accumulate in the same month.
              </div>
            ) : null}
            {monthlyCards.map((report, index) => (
              <details
                key={`${report.scopeKey}-${index}`}
                open={index === 0}
                className="group rounded-[1.35rem] border border-white/10 bg-white/5 p-4"
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{report.scopeKey}</div>
                      <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-ink">{report.title}</div>
                      <p className="mt-2 pr-4 text-sm leading-6 text-muted">{report.summary}</p>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/62 transition group-open:rotate-180">
                      ↓
                    </div>
                  </div>
                </summary>
                <div className="mt-4 space-y-2">
                  {report.bullets.map((bullet) => (
                    <div key={bullet} className="rounded-[1rem] border border-white/10 bg-white/6 px-3 py-2 text-sm leading-6 text-ink">
                      {bullet}
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <SectionCard
          title="Recurring themes"
          eyebrow="Patterns"
          description={
            semanticPageData
              ? "AI is naming the most repeatable behaviors and telling you why they matter."
              : "The most repeated evidence threads across the current journal, even when the wording is slightly different."
          }
        >
          <div className="grid gap-3">
            {!semanticPageData && recurringThemes.length === 0 ? (
              <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-muted">
                No recurring tags yet. Start tagging mistakes and lessons to make this section useful.
              </div>
            ) : null}
            {patternCards.map((theme) => (
                <div
                  key={`${theme.label}-${theme.title}`}
                  className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{theme.label}</div>
                      <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-ink">{theme.title}</div>
                      {theme.summary !== theme.title ? <p className="mt-3 text-sm leading-6 text-muted">{theme.summary}</p> : null}
                    </div>
                    <div className="shrink-0 self-start rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/68">
                      {theme.countLabel}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Trade-level coaching"
          eyebrow="Per trade"
          description={
            semanticPageData
              ? "A compact set of premium trade reviews. Open the trade itself for the full journal record."
              : "A short list of the most recent trade reviews. Open the trade itself for the full journal record."
          }
        >
          <div className="grid gap-3">
            {coachingCards.map((report, index) => {
              return (
                <details
                  key={`${report.tradeId}-${index}`}
                  open={index === 0}
                  className="group rounded-[1.4rem] border border-white/10 bg-white/5 p-4"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{report.symbol}</div>
                        <div className="mt-2 text-lg font-semibold tracking-[-0.03em] text-ink">{report.headline}</div>
                        <div className="mt-2 text-sm text-muted">{report.date}</div>
                        <p className="mt-3 pr-4 text-sm leading-6 text-muted">{report.summary}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/68">
                          {formatToneLabel(report.tone)}
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/6 px-3 py-1 text-xs text-white/62 transition group-open:rotate-180">
                          ↓
                        </div>
                      </div>
                    </div>
                  </summary>
                  <div className="mt-4 space-y-2">
                    {report.bullets.map((bullet) => (
                      <div key={bullet} className="rounded-[1rem] border border-white/10 bg-white/6 px-3 py-2 text-sm leading-6 text-ink">
                        {bullet}
                      </div>
                    ))}
                    <Link
                      href={`/trades/${report.tradeId}`}
                      className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/78 transition hover:bg-white/10"
                    >
                      Open trade record
                    </Link>
                  </div>
                </details>
              );
            })}
            {!semanticPageData && tradeReports.length === 0 ? (
              <div className="rounded-[1.4rem] border border-white/10 bg-white/5 px-4 py-8 text-sm leading-6 text-muted">
                No trade-level coaching summaries yet. Closed trades with filled-out tags and review notes will populate this list.
              </div>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </WorkspaceShell>
  );
}
