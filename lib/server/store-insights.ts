import type {
  NeonQueryFunctionInTransaction,
  NeonQueryInTransaction
} from "@neondatabase/serverless";
import { buildAnalyticsSnapshot, computeTradeMetrics } from "@/lib/domain/analytics";
import { buildMonthlyInsight, buildTradeInsight, buildWeeklyInsight } from "@/lib/domain/insights";
import { InsightReport, Trade, UserSettings } from "@/lib/domain/types";
import { getMonthKeyInTimeZone, getWeekKeyInTimeZone } from "@/lib/domain/utils";

export function buildInsightReportsForState(trades: Trade[], settings: UserSettings) {
  if (!settings.aiInsightsEnabled) {
    return [] as InsightReport[];
  }

  const tradeInsights = trades
    .filter((trade) => trade.status === "closed")
    .map((trade) => buildTradeInsight(trade, computeTradeMetrics(trade, settings.timezone)));
  const analytics = buildAnalyticsSnapshot(trades, tradeInsights, settings.timezone);
  const closedTrades = analytics.trades.filter((trade) => trade.closedAt);
  const tradesByWeek = new Map<string, typeof closedTrades>();
  const tradesByMonth = new Map<string, typeof closedTrades>();

  for (const trade of closedTrades) {
    const weekKey = getWeekKeyInTimeZone(trade.closedAt!, settings.timezone);
    const monthKey = getMonthKeyInTimeZone(trade.closedAt!, settings.timezone);
    tradesByWeek.set(weekKey, [...(tradesByWeek.get(weekKey) ?? []), trade]);
    tradesByMonth.set(monthKey, [...(tradesByMonth.get(monthKey) ?? []), trade]);
  }

  const weeklyInsights = Array.from(tradesByWeek.entries())
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([weekKey, periodTrades]) =>
      buildWeeklyInsight(periodTrades, settings.userId, settings.timezone, weekKey)
    )
    .filter((report): report is InsightReport => Boolean(report));

  const monthlyInsights = Array.from(tradesByMonth.entries())
    .sort((left, right) => right[0].localeCompare(left[0]))
    .map(([monthKey, periodTrades]) =>
      buildMonthlyInsight(periodTrades, settings.userId, settings.timezone, monthKey)
    )
    .filter((report): report is InsightReport => Boolean(report));

  return [
    ...tradeInsights,
    ...weeklyInsights,
    ...monthlyInsights
  ];
}

export function buildInsightReportQueries(
  sql: NeonQueryFunctionInTransaction<false, false>,
  userId: string,
  insightReports: InsightReport[]
): NeonQueryInTransaction[] {
  return [
    sql.query("DELETE FROM insight_reports WHERE user_id = $1", [userId]),
    ...insightReports.map((insight) =>
      sql.query(
        `INSERT INTO insight_reports (
          id,
          user_id,
          scope,
          scope_key,
          created_at,
          title,
          tone,
          summary,
          supporting_trade_ids,
          bullets
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::text[])`,
        [
          insight.id,
          insight.userId,
          insight.scope,
          insight.scopeKey,
          insight.createdAt,
          insight.title,
          insight.tone,
          insight.summary,
          insight.supportingTradeIds,
          insight.bullets
        ]
      )
    )
  ];
}
