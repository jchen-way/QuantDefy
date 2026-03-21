import {
  AnalyticsSnapshot,
  CalendarDay,
  DashboardData,
  DashboardKpis,
  DistributionDatum,
  EquityPoint,
  InsightReport,
  Trade,
  TradeMetrics
} from "@/lib/domain/types";
import {
  deriveCapitalAllocatedFromFills,
  getTradeContractMultiplier,
  formatCapitalBucket,
  durationBucketLabel,
  formatMonthLabelInTimeZone,
  formatWeekdayInTimeZone,
  getDateKeyInTimeZone,
  getMonthKeyInTimeZone,
  getWeekKeyInTimeZone,
  isMonthKey,
  formatMonthKeyLabel,
  shiftMonthKey,
  round,
  sortTradesByOpenDate,
  toDurationBucket
} from "@/lib/domain/utils";
import { buildWeeklyInsight } from "@/lib/domain/insights";

type TradeWithComputed = Trade & { metrics: TradeMetrics; insight?: InsightReport };

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function average(values: number[]) {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function parseIso(iso: string) {
  return new Date(iso).getTime();
}

function getContractMultiplier(trade: Trade) {
  return getTradeContractMultiplier(trade.assetClass);
}

function aggregateDistribution(
  items: TradeWithComputed[],
  labelFor: (trade: TradeWithComputed) => string
): DistributionDatum[] {
  const distribution = new Map<string, { count: number; realizedPl: number }>();

  for (const trade of items) {
    const label = labelFor(trade);
    const current = distribution.get(label) ?? { count: 0, realizedPl: 0 };
    current.count += 1;
    current.realizedPl += trade.metrics.realizedPl;
    distribution.set(label, current);
  }

  return Array.from(distribution.entries())
    .map(([label, value]) => ({
      label,
      value: value.count,
      realizedPl: round(value.realizedPl, 2)
    }))
    .sort((left, right) => right.value - left.value);
}

export function computeTradeMetrics(trade: Trade, timeZone = "America/New_York"): TradeMetrics {
  const multiplier = getContractMultiplier(trade);
  const entryFills = trade.fills.filter((fill) => fill.side === "entry");
  const exitFills = trade.fills.filter((fill) => fill.side === "exit");
  const orderedFills = [...trade.fills].sort((left, right) => parseIso(left.filledAt) - parseIso(right.filledAt));
  const entryQuantity = sum(entryFills.map((fill) => fill.quantity));
  const exitQuantity = sum(exitFills.map((fill) => fill.quantity));
  const entryNotional = sum(entryFills.map((fill) => fill.quantity * fill.price * multiplier));
  const exitNotional = sum(exitFills.map((fill) => fill.quantity * fill.price * multiplier));
  const avgEntryPrice = entryQuantity > 0 ? entryNotional / entryQuantity : 0;
  const avgExitPrice = exitQuantity > 0 ? exitNotional / exitQuantity : 0;

  const maxCapitalUsed = deriveCapitalAllocatedFromFills(orderedFills, trade.assetClass);

  const isShortExposure = trade.assetClass === "stock" && trade.direction === "short";
  const grossPl = isShortExposure ? entryNotional - exitNotional : exitNotional - entryNotional;

  const realizedPl = trade.status === "closed" ? grossPl : 0;

  const holdingMinutes =
    trade.status === "closed" && exitFills.length > 0 && entryFills.length > 0
      ? Math.round((parseIso(exitFills.at(-1)!.filledAt) - parseIso(entryFills[0].filledAt)) / 60000)
      : null;

  const result =
    trade.status === "open"
      ? "open"
      : realizedPl > 10
        ? "win"
        : realizedPl < -10
          ? "loss"
          : "scratch";

  return {
    tradeId: trade.id,
    status: trade.status,
    result,
    grossPl: round(grossPl, 2),
    realizedPl: round(realizedPl, 2),
    avgEntryPrice: round(avgEntryPrice / multiplier, 3),
    avgExitPrice: round(avgExitPrice / multiplier, 3),
    totalEntryQuantity: entryQuantity,
    totalExitQuantity: exitQuantity,
    holdingMinutes,
    durationBucket: toDurationBucket(holdingMinutes),
    rMultiple: trade.status === "closed" && trade.plannedRisk > 0 ? round(realizedPl / trade.plannedRisk, 2) : null,
    returnOnCapitalPct:
      trade.status === "closed" && maxCapitalUsed > 0 ? round((realizedPl / maxCapitalUsed) * 100, 2) : null,
    maxCapitalUsed: round(maxCapitalUsed, 2),
    closedDate: trade.closedAt ? getDateKeyInTimeZone(trade.closedAt, timeZone) : null,
    weekday: trade.closedAt ? formatWeekdayInTimeZone(trade.closedAt, timeZone) : null
  };
}

export function buildKpis(items: TradeWithComputed[], now: Date, timeZone = "America/New_York"): DashboardKpis {
  const closedTrades = items.filter((trade) => trade.metrics.status === "closed");
  const wins = closedTrades.filter((trade) => trade.metrics.result === "win");
  const losses = closedTrades.filter((trade) => trade.metrics.result === "loss");
  const currentMonth = getMonthKeyInTimeZone(now.toISOString(), timeZone);
  const monday = getWeekKeyInTimeZone(now.toISOString(), timeZone);

  const realizedMonthToDate = sum(
    closedTrades
      .filter((trade) => trade.metrics.closedDate?.startsWith(currentMonth))
      .map((trade) => trade.metrics.realizedPl)
  );
  const realizedWeekToDate = sum(
    closedTrades
      .filter((trade) => trade.closedAt && getWeekKeyInTimeZone(trade.closedAt, timeZone) === monday)
      .map((trade) => trade.metrics.realizedPl)
  );

  return {
    realizedMonthToDate: round(realizedMonthToDate, 2),
    realizedWeekToDate: round(realizedWeekToDate, 2),
    winRate: closedTrades.length === 0 ? 0 : round((wins.length / closedTrades.length) * 100, 1),
    expectancy:
      closedTrades.length === 0 ? 0 : round(sum(closedTrades.map((trade) => trade.metrics.realizedPl)) / closedTrades.length, 2),
    avgWinner: wins.length === 0 ? 0 : round(average(wins.map((trade) => trade.metrics.realizedPl)), 2),
    avgLoser: losses.length === 0 ? 0 : round(average(losses.map((trade) => trade.metrics.realizedPl)), 2),
    openRisk: round(
      sum(items.filter((trade) => trade.status === "open").map((trade) => trade.plannedRisk)),
      2
    )
  };
}

function buildEquityCurve(items: TradeWithComputed[], timeZone = "America/New_York", groupByWeek = false): EquityPoint[] {
  const closed = items
    .filter((trade) => trade.metrics.closedDate)
    .sort((left, right) => parseIso(left.closedAt ?? left.openedAt) - parseIso(right.closedAt ?? right.openedAt));

  const buckets = new Map<string, number>();

  for (const trade of closed) {
    const key = groupByWeek ? getWeekKeyInTimeZone(trade.closedAt!, timeZone) : trade.metrics.closedDate!;
    buckets.set(key, (buckets.get(key) ?? 0) + trade.metrics.realizedPl);
  }

  let running = 0;
  return Array.from(buckets.entries()).map(([date, value]) => {
    running += value;
    return {
      date,
      value: round(running, 2)
    };
  });
}

function parseDateKey(dateKey: string) {
  return new Date(`${dateKey}T12:00:00Z`);
}

function buildCalendarDays(
  items: TradeWithComputed[],
  now: Date,
  timeZone = "America/New_York",
  monthKeyOverride?: string
): CalendarDay[] {
  const monthKey =
    monthKeyOverride && isMonthKey(monthKeyOverride)
      ? monthKeyOverride
      : getMonthKeyInTimeZone(now.toISOString(), timeZone);
  const [year, month] = monthKey.split("-").map(Number);
  const monthStart = parseDateKey(`${monthKey}-01`);
  const monthEnd = new Date(Date.UTC(year, month, 0, 12, 0, 0));

  const start = new Date(monthStart);
  const end = new Date(monthEnd);
  start.setUTCDate(monthStart.getUTCDate() - monthStart.getUTCDay());
  end.setUTCDate(monthEnd.getUTCDate() + (6 - monthEnd.getUTCDay()));

  const realizedByDay = new Map<string, { total: number; trades: string[] }>();
  for (const trade of items.filter((item) => item.metrics.closedDate)) {
    const key = trade.metrics.closedDate!;
    const current = realizedByDay.get(key) ?? { total: 0, trades: [] };
    current.total += trade.metrics.realizedPl;
    current.trades.push(trade.id);
    realizedByDay.set(key, current);
  }

  const days: CalendarDay[] = [];
  let cursor = new Date(start);
  let running = 0;

  while (cursor <= end) {
    const isoDate = cursor.toISOString().slice(0, 10);
    const current = realizedByDay.get(isoDate);
    running += current?.total ?? 0;
    days.push({
      isoDate,
      label: cursor.getUTCDate(),
      inMonth: isoDate.startsWith(monthKey),
      realizedPl: round(current?.total ?? 0, 2),
      cumulativePl: round(running, 2),
      tradeIds: current?.trades ?? []
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

export function buildAnalyticsSnapshot(
  trades: Trade[],
  insights: InsightReport[],
  timeZone = "America/New_York",
  now = new Date()
): AnalyticsSnapshot {
  const computed: TradeWithComputed[] = sortTradesByOpenDate(trades).map((trade) => ({
    ...trade,
    metrics: computeTradeMetrics(trade, timeZone),
    insight: insights.find((report) => report.scope === "trade" && report.scopeKey === trade.id)
  }));

  const kpis = buildKpis(computed, now, timeZone);

  return {
    trades: computed,
    equityCurve: buildEquityCurve(computed, timeZone),
    distributions: {
      tradeType: aggregateDistribution(computed.filter((trade) => trade.metrics.status === "closed"), (trade) => trade.tradeType),
      capital: aggregateDistribution(computed, (trade) => {
        return formatCapitalBucket(trade.metrics.maxCapitalUsed);
      }),
      duration: aggregateDistribution(computed, (trade) => durationBucketLabel(trade.metrics.durationBucket)),
      weekday: aggregateDistribution(computed.filter((trade) => trade.metrics.status === "closed"), (trade) => trade.metrics.weekday ?? "Open"),
      setup: aggregateDistribution(computed, (trade) => trade.setupType),
      mistakes: aggregateDistribution(
        computed.flatMap((trade) =>
          trade.tags
            .filter((tag) => tag.category === "mistake")
            .map((tag) => ({
              ...trade,
              tradeType: tag.value as Trade["tradeType"]
            }))
        ),
        (trade) => trade.tradeType
      )
    },
    kpis
  };
}

export function buildDashboardData(
  trades: Trade[],
  insights: InsightReport[],
  timeZone = "America/New_York",
  selectedDay?: string,
  monthKey?: string,
  now = new Date()
): DashboardData {
  const snapshot = buildAnalyticsSnapshot(trades, insights, timeZone, now);
  const resolvedMonthKey =
    monthKey && isMonthKey(monthKey) ? monthKey : getMonthKeyInTimeZone(now.toISOString(), timeZone);
  const calendarDays = buildCalendarDays(snapshot.trades, now, timeZone, resolvedMonthKey);
  const selected =
    selectedDay ?? calendarDays.find((day) => day.inMonth && day.realizedPl !== 0)?.isoDate ?? null;
  const selectedTrades = selected
    ? snapshot.trades.filter((trade) => trade.metrics.closedDate === selected)
    : [];
  const openTrades = snapshot.trades.filter((trade) => trade.status === "open");
  const persistedWeeklyInsight = [...insights]
    .filter((report) => report.scope === "week")
    .sort((left, right) => right.scopeKey.localeCompare(left.scopeKey))[0];
  const closedTrades = snapshot.trades
    .filter((trade) => trade.metrics.status === "closed" && trade.closedAt)
    .sort((left, right) => new Date(right.closedAt!).getTime() - new Date(left.closedAt!).getTime());
  const latestWeekKey = closedTrades[0]?.closedAt ? getWeekKeyInTimeZone(closedTrades[0].closedAt, timeZone) : null;
  const weeklyInsight =
    persistedWeeklyInsight ??
    (latestWeekKey
      ? buildWeeklyInsight(
          closedTrades.filter(
            (trade) => trade.closedAt && getWeekKeyInTimeZone(trade.closedAt, timeZone) === latestWeekKey
          ),
          closedTrades[0].userId,
          timeZone
        )
      : null);

  return {
    monthKey: resolvedMonthKey,
    monthLabel: formatMonthKeyLabel(resolvedMonthKey),
    previousMonthKey: shiftMonthKey(resolvedMonthKey, -1),
    nextMonthKey: shiftMonthKey(resolvedMonthKey, 1),
    kpis: snapshot.kpis,
    calendarDays,
    selectedDay: selected,
    selectedTrades,
    openTrades,
    equityCurve: snapshot.equityCurve,
    weeklyCurve: buildEquityCurve(snapshot.trades, timeZone, true),
    tradeTypeDistribution: snapshot.distributions.tradeType,
    durationDistribution: snapshot.distributions.duration,
    capitalDistribution: snapshot.distributions.capital,
    topMistakes: snapshot.distributions.mistakes,
    weeklyInsight
  };
}
