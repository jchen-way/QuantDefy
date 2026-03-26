"use client";

import { useState } from "react";
import Link from "next/link";
import { DistributionCard } from "@/components/distribution-card";
import { LineChartCard } from "@/components/line-chart-card";
import { StatCard } from "@/components/stat-card";
import { buildTradeInsight } from "@/lib/domain/insights";
import { InsightReport, Trade, TradeMetrics } from "@/lib/domain/types";
import type { SemanticInsightsPageData } from "@/lib/server/semantic-insights";
import {
  durationBucketLabel,
  formatCapitalBucket,
  formatShortDate,
  toCurrency,
  toDecimal,
  toPercent
} from "@/lib/domain/utils";
import { selectFieldClass } from "@/lib/ui/form-styles";

type TradeWithComputed = Trade & { metrics: TradeMetrics; insight?: InsightReport };

type AnalyticsWorkspaceProps = {
  trades: TradeWithComputed[];
  semanticPageData?: SemanticInsightsPageData | null;
  premiumReviewStatus?: "active" | "selected" | "unavailable" | "standard";
};

function aggregateLabels(items: TradeWithComputed[], getLabel: (trade: TradeWithComputed) => string) {
  const map = new Map<string, { count: number; realizedPl: number }>();

  for (const trade of items) {
    const label = getLabel(trade);
    const current = map.get(label) ?? { count: 0, realizedPl: 0 };
    current.count += 1;
    current.realizedPl += trade.metrics.realizedPl;
    map.set(label, current);
  }

  return Array.from(map.entries())
    .map(([label, value]) => ({
      label,
      value: value.count,
      realizedPl: value.realizedPl
    }))
    .sort((left, right) => right.value - left.value);
}

function buildCurve(items: TradeWithComputed[]) {
  const closed = items
    .filter((trade) => trade.metrics.closedDate)
    .sort((left, right) => new Date(left.closedAt ?? left.openedAt).getTime() - new Date(right.closedAt ?? right.openedAt).getTime());

  let running = 0;
  return closed.map((trade) => {
    running += trade.metrics.realizedPl;
    return {
      date: trade.metrics.closedDate!,
      value: running
    };
  });
}

function buildNotableTradeCopy(
  trade: TradeWithComputed,
  semanticLookups: {
    coachingByTradeId: Map<string, SemanticInsightsPageData["coachingCards"][number]>;
    retrievedByTradeId: Map<string, SemanticInsightsPageData["retrievedTrades"][number]>;
  }
) {
  const coachingCard = semanticLookups.coachingByTradeId.get(trade.id);
  if (coachingCard?.summary) {
    return coachingCard.summary;
  }

  const retrievedTrade = semanticLookups.retrievedByTradeId.get(trade.id);
  if (retrievedTrade?.takeaway) {
    return retrievedTrade.takeaway;
  }

  const reviewSource =
    trade.postTradeReview.trim() ||
    trade.notes.trim() ||
    trade.reasonForExit.trim() ||
    trade.reasonForEntry.trim() ||
    trade.thesis.trim();

  if (reviewSource) {
    return reviewSource;
  }

  const liveInsight = buildTradeInsight(trade, trade.metrics);
  return liveInsight.bullets[0] ?? liveInsight.summary;
}

export function AnalyticsWorkspace({
  trades,
  semanticPageData = null,
  premiumReviewStatus = "standard"
}: AnalyticsWorkspaceProps) {
  const [direction, setDirection] = useState("all");
  const [result, setResult] = useState("all");
  const [setup, setSetup] = useState("all");
  const setupOptions = Array.from(new Set(trades.map((trade) => trade.setupType))).sort((left, right) =>
    left.localeCompare(right)
  );

  const filtered = trades.filter((trade) => {
    return (
      (direction === "all" || trade.direction === direction) &&
      (result === "all" || trade.metrics.result === result) &&
      (setup === "all" || trade.setupType === setup)
    );
  });

  const closed = filtered.filter((trade) => trade.metrics.status === "closed");
  const wins = closed.filter((trade) => trade.metrics.result === "win");
  const losses = closed.filter((trade) => trade.metrics.result === "loss");
  const curve = buildCurve(filtered);
  const expectancy =
    closed.length === 0 ? 0 : closed.reduce((sum, trade) => sum + trade.metrics.realizedPl, 0) / closed.length;
  const winRate = closed.length === 0 ? 0 : (wins.length / closed.length) * 100;
  const leaders = [...closed].sort((left, right) => right.metrics.realizedPl - left.metrics.realizedPl).slice(0, 4);
  const leaderIds = new Set(leaders.map((trade) => trade.id));
  const laggardsSource = closed.filter((trade) => !leaderIds.has(trade.id));
  const laggards = (laggardsSource.length > 0 ? laggardsSource : closed)
    .sort((left, right) => left.metrics.realizedPl - right.metrics.realizedPl)
    .slice(0, 4);
  const coachingByTradeId = new Map(
    (semanticPageData?.coachingCards ?? [])
      .filter((card) => card.tradeId)
      .map((card) => [card.tradeId, card] as const)
  );
  const retrievedByTradeId = new Map(
    (semanticPageData?.retrievedTrades ?? [])
      .filter((trade) => trade.tradeId)
      .map((trade) => [trade.tradeId, trade] as const)
  );

  if (trades.length === 0) {
    return (
      <div className="glass-panel rounded-[1.8rem] p-6 sm:p-7">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Analytics bootstrapping</div>
        <h2 className="mt-3 text-[1.8rem] font-semibold tracking-[-0.05em] text-ink">
          No trades yet, so the analytics layer is still blank.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
          Once you log trades with fills and exits, this page will start calculating expectancy, equity
          curves, capital buckets, duration distributions, and recurring pain points.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/trades/new"
            className="rounded-full bg-[linear-gradient(135deg,#f5bc75,#e27847)] px-5 py-3 text-sm font-semibold text-[#091019] shadow-[0_14px_34px_rgba(241,124,71,0.24)] transition hover:translate-y-[-1px]"
          >
            Log first trade
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-[1.6rem] p-5 sm:p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <select value={direction} onChange={(event) => setDirection(event.target.value)} className={selectFieldClass}>
            <option value="all">All directions</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <select value={result} onChange={(event) => setResult(event.target.value)} className={selectFieldClass}>
            <option value="all">All results</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
            <option value="scratch">Scratch</option>
          </select>
          <select value={setup} onChange={(event) => setSetup(event.target.value)} className={selectFieldClass}>
            <option value="all">All setups</option>
            {setupOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      {closed.length === 0 ? (
        <div className="glass-panel rounded-[1.7rem] px-6 py-10 text-sm leading-7 text-muted">
          The current filters do not include any closed trades yet, so realized analytics are temporarily empty. Change the filters or close more trades to populate this view.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Win rate" value={toPercent(winRate)} detail={`${wins.length} winners in filtered set`} accent="green" />
        <StatCard label="Expectancy" value={toCurrency(expectancy)} detail="Average realized result per trade" accent={expectancy >= 0 ? "green" : "red"} />
        <StatCard label="Average winner" value={toCurrency(wins.reduce((sum, trade) => sum + trade.metrics.realizedPl, 0) / Math.max(wins.length, 1))} detail="Only profitable closes" accent="green" />
        <StatCard label="Average loser" value={toCurrency(losses.reduce((sum, trade) => sum + trade.metrics.realizedPl, 0) / Math.max(losses.length, 1))} detail="Only losing closes" accent="red" />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <LineChartCard
          title="Filtered equity curve"
          eyebrow="P/L"
          description="Cumulative realized P/L using the active analytics filters."
          series={curve}
          accent={(curve.at(-1)?.value ?? 0) >= 0 ? "green" : "red"}
        />
        <div className="grid gap-4">
          <DistributionCard title="Trade type distribution" eyebrow="Mix" items={aggregateLabels(filtered, (trade) => trade.tradeType)} />
          <DistributionCard
          title="Capital buckets"
          eyebrow="Sizing"
          items={aggregateLabels(filtered, (trade) => formatCapitalBucket(trade.metrics.maxCapitalUsed))}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DistributionCard
          title="Duration distribution"
          eyebrow="Time in trade"
          items={aggregateLabels(filtered, (trade) => durationBucketLabel(trade.metrics.durationBucket))}
        />
        <DistributionCard
          title="Weekday distribution"
          eyebrow="Calendar behavior"
          items={aggregateLabels(closed, (trade) => trade.metrics.weekday ?? "Open")}
        />
        <DistributionCard
          title="Mistake tag distribution"
          eyebrow="Pain points"
          items={aggregateLabels(
            filtered.flatMap((trade) =>
              trade.tags
                .filter((tag) => tag.category === "mistake")
                .map((tag) => ({
                  ...trade,
                  tradeType: tag.value as Trade["tradeType"]
                }))
            ),
            (trade) => trade.tradeType
          )}
        />
      </div>

      <div className="glass-panel rounded-[1.6rem] p-5 sm:p-6">
        <div className="mb-4">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Notable trades</div>
          <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-ink">
            {semanticPageData ? "Sharper trade takeaways in view" : "Best and worst outcomes in view"}
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-muted">
            {semanticPageData
              ? "Premium review brings more context into the standout trades here, so the takeaways feel sharper and more specific."
              : premiumReviewStatus === "selected"
                ? "Premium review is selected here. Refresh insights whenever you want a fresh pass on the standout trades in this view."
                : premiumReviewStatus === "unavailable"
                  ? "Premium review is unavailable right now, so this section is using the standard trade takeaways."
                  : "The strongest winners and hardest losses stay visible here so you can review what deserves reinforcement versus correction."}
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {leaders.map((trade) => (
            <div key={`leader-${trade.id}`} className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-ink">{trade.symbol}</div>
                  <div className="text-sm text-muted">{formatShortDate(trade.closedAt!)}</div>
                </div>
                <div className={trade.metrics.realizedPl >= 0 ? "metric-positive text-lg font-semibold" : "metric-negative text-lg font-semibold"}>
                  {toCurrency(trade.metrics.realizedPl)}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                {buildNotableTradeCopy(trade, { coachingByTradeId, retrievedByTradeId })}
              </p>
            </div>
          ))}
          {laggards.map((trade) => (
            <div key={`laggard-${trade.id}`} className="rounded-[1.4rem] border border-white/10 bg-white/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-semibold text-ink">{trade.symbol}</div>
                  <div className="text-sm text-muted">{formatShortDate(trade.closedAt!)}</div>
                </div>
                  <div className="metric-negative text-lg font-semibold">{toCurrency(trade.metrics.realizedPl)}</div>
                </div>
              <p className="mt-3 text-sm leading-6 text-muted">
                {buildNotableTradeCopy(trade, { coachingByTradeId, retrievedByTradeId })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
