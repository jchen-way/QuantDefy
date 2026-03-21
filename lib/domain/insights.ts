import { InsightReport, Trade, TradeMetrics } from "@/lib/domain/types";
import {
  formatDuration,
  getMonthKeyInTimeZone,
  getWeekKeyInTimeZone,
  makeId,
  pluralize,
  round,
  toCurrency
} from "@/lib/domain/utils";

type TradeWithMetrics = Trade & { metrics: TradeMetrics };

type ThemeCluster = {
  label: string;
  keywords: string[];
  sample: string;
  count: number;
  tradeIds: Set<string>;
  noteCount: number;
  imageCount: number;
  categories: Set<string>;
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "before",
  "break",
  "broke",
  "by",
  "did",
  "for",
  "from",
  "had",
  "if",
  "in",
  "into",
  "is",
  "it",
  "just",
  "level",
  "levels",
  "market",
  "my",
  "not",
  "of",
  "on",
  "or",
  "out",
  "over",
  "plan",
  "setup",
  "that",
  "the",
  "this",
  "to",
  "trade",
  "was",
  "were",
  "with"
]);

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string) {
  return normalizeText(value)
    .split(" ")
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function uniqueValues(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function buildKeywordLabel(keywords: string[]) {
  const top = keywords.slice(0, 3);

  if (top.length === 0) {
    return "execution drift";
  }

  if (top.length === 1) {
    return top[0];
  }

  return top.join(", ");
}

function sentenceCase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function stripTagPrefix(value: string) {
  return value.replace(/^(mistake|lesson|emotion|setup)\s*:\s*/i, "").trim();
}

function shortenEvidence(value: string) {
  const cleaned = stripTagPrefix(value)
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "your notes";
  }

  if (cleaned.length <= 88) {
    return sentenceCase(cleaned);
  }

  return `${sentenceCase(cleaned.slice(0, 85).trimEnd())}...`;
}

function firstMeaningfulTradeText(trade: Trade, categories: Array<"lesson" | "mistake" | "emotion"> = []) {
  const tagged = trade.tags
    .filter((tag) => categories.length === 0 || categories.includes(tag.category as "lesson" | "mistake" | "emotion"))
    .map((tag) => stripTagPrefix(tag.value))
    .find(Boolean);

  if (tagged) {
    return sentenceCase(tagged);
  }

  const reviewText = [trade.postTradeReview, trade.notes, trade.reasonForEntry, trade.reasonForExit, trade.thesis]
    .map((value) => value.trim())
    .find(Boolean);

  return reviewText ? shortenEvidence(reviewText) : "The written review is still thin.";
}

function similarity(left: string[], right: string[]) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const overlap = left.filter((token) => rightSet.has(token)).length;
  return overlap / Math.max(1, Math.min(leftSet.size, rightSet.size));
}

function buildClusters(
  trades: TradeWithMetrics[],
  categories: Array<"mistake" | "lesson" | "emotion">
): ThemeCluster[] {
  const clusters: Array<ThemeCluster & { tokenPool: Map<string, number> }> = [];

  for (const trade of trades) {
    const textSources = [
      ...trade.tags
        .filter((tag) => categories.includes(tag.category as "mistake" | "lesson" | "emotion"))
        .map((tag) => ({ value: tag.value, category: tag.category, source: "tag" as const })),
      ...[trade.thesis, trade.reasonForEntry, trade.reasonForExit, trade.preTradePlan, trade.postTradeReview, trade.notes]
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => ({ value, category: "note", source: "note" as const })),
      ...trade.attachments
        .map((attachment) => attachment.caption.trim())
        .filter(Boolean)
        .map((value) => ({ value, category: "image", source: "image" as const }))
    ];

    for (const item of textSources) {
      const tokens = tokenize(item.value);
      if (tokens.length === 0) {
        continue;
      }

      const existing = clusters.find((cluster) => similarity(tokens, Array.from(cluster.tokenPool.keys())) >= 0.5);
      const target =
        existing ??
        (() => {
          const created: ThemeCluster & { tokenPool: Map<string, number> } = {
            label: item.value,
            keywords: [],
            sample: item.value,
            count: 0,
            tradeIds: new Set<string>(),
            noteCount: 0,
            imageCount: 0,
            categories: new Set<string>(),
            tokenPool: new Map<string, number>()
          };
          clusters.push(created);
          return created;
        })();

      target.count += 1;
      target.tradeIds.add(trade.id);
      target.categories.add(item.category);
      if (item.source === "note") {
        target.noteCount += 1;
      }
      if (item.source === "image") {
        target.imageCount += 1;
      }
      for (const token of tokens) {
        target.tokenPool.set(token, (target.tokenPool.get(token) ?? 0) + 1);
      }
    }
  }

  return clusters
    .map((cluster) => {
      const keywords = Array.from(cluster.tokenPool.entries())
        .sort((left, right) => right[1] - left[1])
        .map(([token]) => token)
        .slice(0, 4);

      return {
        label: buildKeywordLabel(keywords),
        keywords,
        sample: cluster.sample,
        count: cluster.count,
        tradeIds: cluster.tradeIds,
        noteCount: cluster.noteCount,
        imageCount: cluster.imageCount,
        categories: cluster.categories
      };
    })
    .sort((left, right) => right.tradeIds.size - left.tradeIds.size || right.count - left.count);
}

function buildClusterSummary(prefix: string, cluster: ThemeCluster | undefined) {
  if (!cluster) {
    return `${prefix}: not enough repeated evidence yet.`;
  }

  const evidenceParts = [`${pluralize(cluster.tradeIds.size, "trade")}`];
  if (cluster.noteCount > 0) {
    evidenceParts.push(`${pluralize(cluster.noteCount, "note")}`);
  }
  if (cluster.imageCount > 0) {
    evidenceParts.push(`${pluralize(cluster.imageCount, "image caption")}`);
  }

  return `${prefix}: ${shortenEvidence(cluster.sample)} showed up across ${evidenceParts.join(" and ")}.`;
}

function summarizeTradePainPoint(trade: Trade, metrics: TradeMetrics) {
  const mistakeTags = uniqueValues(
    trade.tags.filter((tag) => tag.category === "mistake").map((tag) => tag.value.toLowerCase())
  );
  const mistakeCluster = buildClusters([{ ...trade, metrics }], ["mistake", "emotion"])[0];
  const lessonCluster = buildClusters([{ ...trade, metrics }], ["lesson"])[0];

  if (mistakeTags.includes("chased entry") || mistakeTags.includes("fomo")) {
    return {
      tone: "warning" as const,
      title: "Entry quality broke the edge",
      bullets: [
        "The setup may have been valid, but the entry timing widened the pain immediately.",
        "Wait for the same pattern to confirm before pressing size."
      ]
    };
  }

  if (metrics.result === "win" && lessonCluster) {
    return {
      tone: "reinforcement" as const,
      title: `${trade.setupType} worked because the process stayed clean`,
      bullets: [
        `What worked: ${firstMeaningfulTradeText(trade, ["lesson"])}`,
        trade.attachments.some((attachment) => attachment.caption.trim())
          ? "Your screenshots supported the same story as the trade notes."
          : "Add chart captions on strong trades so this pattern is easier to revisit."
      ]
    };
  }

  if (metrics.result === "loss" && mistakeCluster) {
    return {
      tone: "warning" as const,
      title: `${trade.setupType} broke down because execution slipped`,
      bullets: [
        `Main issue: ${firstMeaningfulTradeText(trade, ["mistake", "emotion"])}`,
        "Compare what the plan said before entry with the exact moment management changed."
      ]
    };
  }

  if (metrics.result === "scratch") {
    return {
      tone: "constructive" as const,
      title: "Capital stayed intact while conviction stayed mixed",
      bullets: [
        "The trade did not expand into a full loss, which means your risk controls still mattered.",
        lessonCluster ? `The cleaner part of the process was ${firstMeaningfulTradeText(trade, ["lesson"])}` : "The next improvement is cleaner entry selection, not more aggressive management."
      ]
    };
  }

  return {
    tone: "constructive" as const,
    title: "The trade record needs a clearer story",
    bullets: [
      buildClusterSummary("Most visible pattern", mistakeCluster ?? lessonCluster),
      "Use tags, review notes, and screenshot captions together so this trade has stronger evidence next time."
    ]
  };
}

export function buildTradeInsight(trade: Trade, metrics: TradeMetrics): InsightReport {
  const painPoint = summarizeTradePainPoint(trade, metrics);
  const tradeContext = firstMeaningfulTradeText(
    trade,
    metrics.result === "win" ? ["lesson"] : metrics.result === "loss" ? ["mistake", "emotion"] : []
  );

  return {
    id: makeId("insight_trade"),
    userId: trade.userId,
    scope: "trade",
    scopeKey: trade.id,
    createdAt: new Date().toISOString(),
    title: painPoint.title,
    tone: painPoint.tone,
    summary:
      metrics.result === "win"
        ? `${trade.symbol} closed green on a ${trade.setupType.toLowerCase()} setup. Best note: ${tradeContext}`
        : metrics.result === "loss"
          ? `${trade.symbol} closed ${toCurrency(Math.abs(metrics.realizedPl))} down on a ${trade.setupType.toLowerCase()} setup. Main issue: ${tradeContext}`
          : `${trade.symbol} finished near flat. Most useful note: ${tradeContext}`,
    supportingTradeIds: [trade.id],
    bullets: painPoint.bullets
  };
}

export function buildWeeklyInsight(
  trades: Array<Trade & { metrics: TradeMetrics }>,
  userId: string,
  timeZone = "America/New_York",
  scopeKey?: string
): InsightReport | null {
  const closedTrades = trades.filter((trade) => trade.metrics.status === "closed" && trade.closedAt);
  if (closedTrades.length === 0) {
    return null;
  }

  const sortedTrades = [...closedTrades].sort(
    (left, right) => new Date(left.closedAt!).getTime() - new Date(right.closedAt!).getTime()
  );
  const weekKey = scopeKey ?? getWeekKeyInTimeZone(sortedTrades[0].closedAt!, timeZone);
  const weekPl = round(closedTrades.reduce((total, trade) => total + trade.metrics.realizedPl, 0), 2);
  const averageDuration = round(
    closedTrades.reduce((total, trade) => total + (trade.metrics.holdingMinutes ?? 0), 0) / closedTrades.length,
    0
  );
  const painCluster = buildClusters(closedTrades, ["mistake", "emotion"])[0];
  const lessonCluster = buildClusters(closedTrades, ["lesson"])[0];
  const exactMistakeCounts = new Map<string, number>();
  const setupPerformance = new Map<string, { count: number; realizedPl: number }>();

  for (const trade of closedTrades) {
    for (const tag of trade.tags.filter((item) => item.category === "mistake")) {
      exactMistakeCounts.set(tag.value, (exactMistakeCounts.get(tag.value) ?? 0) + 1);
    }
    const setup = setupPerformance.get(trade.setupType) ?? { count: 0, realizedPl: 0 };
    setup.count += 1;
    setup.realizedPl += trade.metrics.realizedPl;
    setupPerformance.set(trade.setupType, setup);
  }

  const bestSetup = Array.from(setupPerformance.entries()).sort((left, right) => right[1].realizedPl - left[1].realizedPl)[0];
  const exactMistake = Array.from(exactMistakeCounts.entries()).sort((left, right) => right[1] - left[1])[0];

  return {
    id: makeId("insight_week"),
    userId,
    scope: "week",
    scopeKey: weekKey,
    createdAt: new Date().toISOString(),
    title:
      weekPl >= 0
        ? "Weekly review: the edge is visible when the evidence lines up"
        : "Weekly review: execution drift showed up before the edge could pay",
    tone: weekPl >= 0 ? "constructive" : "warning",
    summary:
      weekPl >= 0
        ? `The week closed ${toCurrency(weekPl)} across ${pluralize(closedTrades.length, "trade")}. The strongest patterns were specific, not broad.`
        : `The week closed ${toCurrency(weekPl)}. The recurring pain points came from journal evidence that kept echoing across trades, notes, and chart captions.`,
    supportingTradeIds: closedTrades.map((trade) => trade.id),
    bullets: [
      exactMistake
        ? `Recurring friction: ${exactMistake[0]} showed up in ${pluralize(exactMistake[1], "trade")}.`
        : buildClusterSummary("Recurring friction", painCluster),
      lessonCluster
        ? `Best reinforcement: ${shortenEvidence(lessonCluster.sample)} kept appearing on the cleaner trades.`
        : "No consistent reinforcement theme was strong enough yet. Add lessons and screenshot captions on good trades.",
      bestSetup
        ? `Best setup pocket: ${bestSetup[0]} produced ${toCurrency(bestSetup[1].realizedPl)} across ${pluralize(bestSetup[1].count, "trade")}.`
        : "No setup pocket stood out yet.",
      `Average hold time across closed trades was ${formatDuration(averageDuration)}.`
    ]
  };
}

export function buildMonthlyInsight(
  trades: Array<Trade & { metrics: TradeMetrics }>,
  userId: string,
  timeZone = "America/New_York",
  scopeKey?: string
): InsightReport | null {
  const closedTrades = trades.filter((trade) => trade.metrics.status === "closed" && trade.closedAt);
  if (closedTrades.length === 0) {
    return null;
  }

  const sortedTrades = [...closedTrades].sort(
    (left, right) => new Date(left.closedAt!).getTime() - new Date(right.closedAt!).getTime()
  );
  const monthKey = scopeKey ?? getMonthKeyInTimeZone(sortedTrades[0].closedAt!, timeZone);
  const realizedPl = round(closedTrades.reduce((total, trade) => total + trade.metrics.realizedPl, 0), 2);
  const wins = closedTrades.filter((trade) => trade.metrics.result === "win").length;
  const losses = closedTrades.filter((trade) => trade.metrics.result === "loss").length;
  const scratches = closedTrades.filter((trade) => trade.metrics.result === "scratch").length;
  const capitalAverage = round(
    closedTrades.reduce((total, trade) => total + trade.capitalAllocated, 0) / closedTrades.length,
    0
  );
  const painCluster = buildClusters(closedTrades, ["mistake", "emotion"])[0];
  const lessonCluster = buildClusters(closedTrades, ["lesson"])[0];

  return {
    id: makeId("insight_month"),
    userId,
    scope: "month",
    scopeKey: monthKey,
    createdAt: new Date().toISOString(),
    title:
      realizedPl >= 0
        ? "Monthly review: keep leaning into the repeated good evidence"
        : "Monthly review: the journal is pointing at one main leak to clean up",
    tone: realizedPl >= 0 ? "constructive" : "warning",
    summary:
      realizedPl >= 0
        ? `The month is up ${toCurrency(realizedPl)} across ${pluralize(closedTrades.length, "closed trade")}. The strongest wins were supported by repeatable language in your notes and screenshots.`
        : `The month is down ${toCurrency(Math.abs(realizedPl))} across ${pluralize(closedTrades.length, "closed trade")}. The review priority is reducing the friction theme that appears most often in your journal evidence.`,
    supportingTradeIds: closedTrades.map((trade) => trade.id),
    bullets: [
      `Result mix: ${wins} wins, ${losses} losses, ${scratches} scratch trades.`,
      `Average deployed capital was ${toCurrency(capitalAverage)}.`,
      buildClusterSummary("Main friction cluster", painCluster),
      lessonCluster
        ? `Best repeated reinforcement: ${shortenEvidence(lessonCluster.sample)}.`
        : "No lesson cluster is repeating strongly yet. Add short lesson tags and chart captions on winning trades."
    ]
  };
}
