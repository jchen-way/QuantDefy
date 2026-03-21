import { createHash } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { computeTradeMetrics } from "@/lib/domain/analytics";
import { InsightReport, InsightTone, Trade, UserSettings } from "@/lib/domain/types";
import { formatDuration, formatShortDate, toCurrency } from "@/lib/domain/utils";
import { getStoreBackend } from "@/lib/server/store-core";
import { ensureNeonSchema, getNeonSql, queryRows } from "@/lib/server/store-neon";
import { getSemanticInsightCachePath } from "@/lib/server/runtime-paths";
import { readUpload } from "@/lib/server/uploads";

type SemanticTradeEvidence = {
  trade: Trade;
  metrics: ReturnType<typeof computeTradeMetrics>;
  text: string;
  excerpt: string;
  embedding: number[];
};

type SemanticRecurringTheme = {
  category: string;
  value: string;
  count: number;
};

type SemanticTradeCard = {
  tradeId: string;
  symbol: string;
  date: string;
  resultLabel: string;
  tone: InsightTone;
  headline: string;
  summary: string;
  bullets: string[];
};

type SemanticDigestCard = {
  scopeKey: string;
  title: string;
  summary: string;
  bullets: string[];
};

type SemanticPatternCard = {
  label: string;
  title: string;
  summary: string;
  countLabel: string;
};

type SemanticTraderProfile = {
  label: string;
  summary: string;
  nextSteps: string[];
};

export type SemanticInsightsPageData = {
  title: string;
  summary: string;
  bullets: string[];
  retrievedTrades: Array<{
    tradeId: string;
    symbol: string;
    date: string;
    resultLabel: string;
    headline: string;
    takeaway: string;
  }>;
  weeklyDigests: SemanticDigestCard[];
  monthlyDigests: SemanticDigestCard[];
  patternCards: SemanticPatternCard[];
  coachingCards: SemanticTradeCard[];
  traderProfile: SemanticTraderProfile;
};

export type SemanticInsightsSnapshot = {
  fingerprint: string;
  payload: SemanticInsightsPageData;
  updatedAt: string;
};

type SemanticInsightCacheRow = {
  user_id: string;
  fingerprint: string;
  payload: SemanticInsightsPageData;
  updated_at: string;
};

type SemanticAiPayload = {
  title?: string;
  summary?: string;
  bullets?: string[];
  retrievedTrades?: Array<{
    tradeId?: string;
    headline?: string;
    takeaway?: string;
  }>;
  weeklyDigests?: Array<{
    scopeKey?: string;
    title?: string;
    summary?: string;
    bullets?: string[];
  }>;
  monthlyDigests?: Array<{
    scopeKey?: string;
    title?: string;
    summary?: string;
    bullets?: string[];
  }>;
  patternCards?: Array<{
    label?: string;
    title?: string;
    summary?: string;
    countLabel?: string;
  }>;
  coachingCards?: Array<{
    tradeId?: string;
    headline?: string;
    summary?: string;
    bullets?: string[];
    tone?: InsightTone;
  }>;
  traderProfile?: {
    label?: string;
    summary?: string;
    nextSteps?: string[];
  };
};

function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] * left[index];
    rightNorm += right[index] * right[index];
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function averageVector(vectors: number[][]) {
  if (vectors.length === 0) {
    return [] as number[];
  }

  const width = vectors[0]?.length ?? 0;
  const result = Array.from({ length: width }, () => 0);
  for (const vector of vectors) {
    for (let index = 0; index < width; index += 1) {
      result[index] += vector[index] ?? 0;
    }
  }
  return result.map((value) => value / vectors.length);
}

function uniqueEvidence(items: SemanticTradeEvidence[]) {
  const seen = new Set<string>();
  const result: SemanticTradeEvidence[] = [];

  for (const item of items) {
    if (seen.has(item.trade.id)) {
      continue;
    }
    seen.add(item.trade.id);
    result.push(item);
  }

  return result;
}

export function buildRecurringThemes(trades: Trade[]) {
  return Array.from(
    trades
      .flatMap((trade) => trade.tags.filter((tag) => tag.category === "mistake" || tag.category === "lesson"))
      .reduce((map, tag) => {
        map.set(`${tag.category}:${tag.value}`, (map.get(`${tag.category}:${tag.value}`) ?? 0) + 1);
        return map;
      }, new Map<string, number>())
      .entries()
  )
    .map(([key, count]) => {
      const [category, value] = key.split(":");
      return {
        category,
        value,
        count
      };
    })
    .sort((left, right) => right.count - left.count)
    .slice(0, 6);
}

function collectEvidenceText(trade: Trade) {
  const parts = [
    trade.symbol,
    trade.tradeType,
    trade.setupType,
    trade.thesis,
    trade.reasonForEntry,
    trade.reasonForExit,
    trade.preTradePlan,
    trade.postTradeReview,
    trade.notes,
    ...trade.tags.map((tag) => `${tag.category} ${tag.value}`),
    ...trade.attachments.map((attachment) => `${attachment.kind} ${attachment.caption}`)
  ]
    .map((value) => value.trim())
    .filter(Boolean);

  return parts.join("\n");
}

function chooseExcerpt(trade: Trade) {
  return [trade.postTradeReview, trade.notes, trade.reasonForEntry, trade.reasonForExit, trade.thesis]
    .map((value) => value.trim())
    .find(Boolean) ?? "No written review context.";
}

function sanitizeText(value: string | undefined, fallback: string) {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.replace(/\s+/g, " ");
}

function titleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function guessMimeType(fileName: string) {
  const extension = extname(fileName).toLowerCase();
  if (extension === ".png") {
    return "image/png";
  }
  if (extension === ".jpg" || extension === ".jpeg") {
    return "image/jpeg";
  }
  if (extension === ".webp") {
    return "image/webp";
  }
  if (extension === ".gif") {
    return "image/gif";
  }
  return null;
}

async function fetchEmbeddings(inputs: string[]) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || inputs.length === 0) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: inputs
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { data?: Array<{ embedding?: number[] }> };
  const vectors = payload.data?.map((item) => item.embedding ?? []) ?? [];
  return vectors.length === inputs.length ? vectors : null;
}

function toSemanticTradeEvidence(trades: Trade[], settings: UserSettings, vectors: number[][]) {
  return trades.map((trade, index) => ({
    trade,
    metrics: computeTradeMetrics(trade, settings.timezone),
    text: collectEvidenceText(trade),
    excerpt: chooseExcerpt(trade),
    embedding: vectors[index] ?? []
  }));
}

function formatResultLabel(metrics: ReturnType<typeof computeTradeMetrics>) {
  if (metrics.status === "open") {
    return "Open";
  }
  return metrics.result === "win"
    ? `+${toCurrency(Math.abs(metrics.realizedPl))}`
    : metrics.result === "loss"
      ? `-${toCurrency(Math.abs(metrics.realizedPl))}`
      : "Scratch";
}

async function buildImageInputs(evidence: SemanticTradeEvidence[]) {
  const selectedAttachments = evidence
    .flatMap((item) =>
      item.trade.attachments
        .filter((attachment) => attachment.fileName)
        .slice(0, 1)
        .map((attachment) => ({
          tradeId: item.trade.id,
          symbol: item.trade.symbol,
          attachment
        }))
    )
    .slice(0, 3);

  const imageInputs: Array<{
    type: "image_url";
    image_url: { url: string };
  }> = [];

  for (const item of selectedAttachments) {
    if (!item.attachment.fileName) {
      continue;
    }

    const mimeType = guessMimeType(item.attachment.fileName);
    if (!mimeType) {
      continue;
    }

    try {
      const buffer = await readUpload(item.attachment.fileName);
      imageInputs.push({
        type: "image_url",
        image_url: {
          url: `data:${mimeType};base64,${buffer.toString("base64")}`
        }
      });
    } catch {
      // Skip unreadable images instead of failing the whole semantic pass.
    }
  }

  return imageInputs;
}

function buildFallbackPageData(
  retrievedEvidence: SemanticTradeEvidence[],
  weeklyReports: InsightReport[],
  monthlyReports: InsightReport[],
  recurringThemes: SemanticRecurringTheme[]
): SemanticInsightsPageData {
  const averageHoldMinutes =
    Math.round(
      retrievedEvidence.reduce((total, item) => total + (item.metrics.holdingMinutes ?? 0), 0) /
        Math.max(1, retrievedEvidence.length)
    ) || 0;

  return {
    title: "Semantic review",
    summary: "Retrieved journal evidence is being compared across notes, tags, and chart screenshots to surface repeatable behavior.",
    bullets: [
      `Retrieved ${retrievedEvidence.length} anchor trades for the current review pass.`,
      `Average hold time in the retrieved evidence set was ${formatDuration(averageHoldMinutes)}.`,
      "Switch back to local mode anytime if you want purely deterministic summaries."
    ],
    retrievedTrades: retrievedEvidence.slice(0, 4).map((item) => ({
      tradeId: item.trade.id,
      symbol: item.trade.symbol,
      date: item.trade.closedAt ? formatShortDate(item.trade.closedAt) : formatShortDate(item.trade.openedAt),
      resultLabel: formatResultLabel(item.metrics),
      headline: `${titleCase(item.trade.setupType)} review`,
      takeaway: sanitizeText(item.excerpt, "No written review context.")
    })),
    weeklyDigests: weeklyReports.slice(0, 4).map((report) => ({
      scopeKey: report.scopeKey,
      title: report.title,
      summary: report.summary,
      bullets: report.bullets
    })),
    monthlyDigests: monthlyReports.slice(0, 4).map((report) => ({
      scopeKey: report.scopeKey,
      title: report.title,
      summary: report.summary,
      bullets: report.bullets
    })),
    patternCards: recurringThemes.slice(0, 4).map((theme) => ({
      label: theme.category === "mistake" ? "Friction" : "Reinforcement",
      title: theme.value,
      summary: `${theme.value} appeared ${theme.count} times across the current journal.`,
      countLabel: `${theme.count}x`
    })),
    coachingCards: retrievedEvidence.slice(0, 4).map((item) => ({
      tradeId: item.trade.id,
      symbol: item.trade.symbol,
      date: item.trade.closedAt ? formatShortDate(item.trade.closedAt) : formatShortDate(item.trade.openedAt),
      resultLabel: formatResultLabel(item.metrics),
      tone: item.metrics.result === "loss" ? "warning" : "reinforcement",
      headline:
        item.metrics.result === "loss"
          ? `${titleCase(item.trade.setupType)} needs tighter execution`
          : `${titleCase(item.trade.setupType)} worked when the plan stayed intact`,
      summary: sanitizeText(item.excerpt, "No written review context."),
      bullets: [
        item.trade.reasonForEntry ? `Entry context: ${sanitizeText(item.trade.reasonForEntry, "")}` : "Entry context was not recorded.",
        item.trade.reasonForExit ? `Exit context: ${sanitizeText(item.trade.reasonForExit, "")}` : "Exit context was not recorded."
      ]
    })),
    traderProfile: {
      label: "Pattern-first discretionary trader",
      summary: "You log setups and reviews consistently enough that recurring behavior is visible, but the journal still benefits most when the post-trade note is explicit about the decision mistake or advantage.",
      nextSteps: [
        "Write one sentence after each trade naming the exact rule that held or broke.",
        "Keep screenshot captions specific so image-based retrieval has something useful to anchor on.",
        "Review the same setup family together at the end of the week instead of scanning every trade in isolation."
      ]
    }
  };
}

function buildPrompt(args: {
  journalEvidence: SemanticTradeEvidence[];
  retrievedEvidence: SemanticTradeEvidence[];
  weeklyReports: InsightReport[];
  monthlyReports: InsightReport[];
  recurringThemes: SemanticRecurringTheme[];
}) {
  const { journalEvidence, retrievedEvidence, weeklyReports, monthlyReports, recurringThemes } = args;

  return [
    "You are an elite trading-journal reviewer writing a concise, plain-English introspection report for one trader.",
    "Use the full supplied trade journal as the knowledge base.",
    "The retrieved evidence list is only the focus set. You should still reason across the broader journal context, including open trades, closed trades, notes, tags, and chart captions.",
    "Do not mention embeddings, retrieval, clustering, tokens, RAG, or AI.",
    "Avoid filler like 'evidence clustered around' or 'process stayed clean' unless the actual notes support it.",
    "Write like a sharp trading coach, concrete and specific.",
    "Return strict JSON with keys:",
    "title, summary, bullets, weeklyDigests, monthlyDigests, patternCards, coachingCards, traderProfile, retrievedTrades.",
    "bullets must be exactly 3 strings.",
    "weeklyDigests and monthlyDigests: up to 4 items each with scopeKey, title, summary, bullets.",
    "patternCards: exactly 4 items with label, title, summary, countLabel.",
    "coachingCards: exactly 4 items with tradeId, headline, summary, bullets, tone.",
    "retrievedTrades: exactly 4 items with tradeId, headline, takeaway.",
    "traderProfile: label, summary, nextSteps (exactly 3).",
    "Make the traderProfile feel like a real archetype of the trader's current behavior, with next steps for improvement.",
    "",
    `Full journal context:\n${JSON.stringify(
      journalEvidence.map((item) => ({
        tradeId: item.trade.id,
        symbol: item.trade.symbol,
        status: item.trade.status,
        setupType: item.trade.setupType,
        tradeType: item.trade.tradeType,
        direction: item.trade.direction,
        result: item.metrics.status === "open" ? "open" : item.metrics.result,
        realizedPl: item.metrics.realizedPl,
        duration: item.metrics.holdingMinutes ? formatDuration(item.metrics.holdingMinutes) : "Open",
        thesis: item.trade.thesis,
        reasonForEntry: item.trade.reasonForEntry,
        reasonForExit: item.trade.reasonForExit,
        postTradeReview: item.trade.postTradeReview,
        notes: item.trade.notes,
        tags: item.trade.tags.map((tag) => `${tag.category}: ${tag.value}`),
        attachmentCaptions: item.trade.attachments.map((attachment) => `${attachment.kind}: ${attachment.caption}`)
      }))
    )}`,
    "",
    `Retrieved evidence:\n${JSON.stringify(
      retrievedEvidence.slice(0, 6).map((item) => ({
        tradeId: item.trade.id,
        symbol: item.trade.symbol,
        status: item.trade.status,
        setupType: item.trade.setupType,
        tradeType: item.trade.tradeType,
        direction: item.trade.direction,
        result: item.metrics.status === "open" ? "open" : item.metrics.result,
        realizedPl: item.metrics.realizedPl,
        duration: item.metrics.holdingMinutes ? formatDuration(item.metrics.holdingMinutes) : "Open",
        excerpt: item.excerpt,
        thesis: item.trade.thesis,
        reasonForEntry: item.trade.reasonForEntry,
        reasonForExit: item.trade.reasonForExit,
        postTradeReview: item.trade.postTradeReview,
        notes: item.trade.notes,
        tags: item.trade.tags.map((tag) => `${tag.category}: ${tag.value}`),
        attachmentCaptions: item.trade.attachments.map((attachment) => `${attachment.kind}: ${attachment.caption}`)
      }))
    )}`,
    "",
    `Weekly digests:\n${JSON.stringify(
      weeklyReports.slice(0, 4).map((report) => ({
        scopeKey: report.scopeKey,
        title: report.title,
        summary: report.summary,
        bullets: report.bullets
      }))
    )}`,
    "",
    `Monthly digests:\n${JSON.stringify(
      monthlyReports.slice(0, 4).map((report) => ({
        scopeKey: report.scopeKey,
        title: report.title,
        summary: report.summary,
        bullets: report.bullets
      }))
    )}`,
    "",
    `Recurring themes:\n${JSON.stringify(recurringThemes.slice(0, 6))}`
  ].join("\n");
}

async function fetchSemanticPageNarrative(args: {
  journalEvidence: SemanticTradeEvidence[];
  retrievedEvidence: SemanticTradeEvidence[];
  weeklyReports: InsightReport[];
  monthlyReports: InsightReport[];
  recurringThemes: SemanticRecurringTheme[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || args.journalEvidence.length === 0) {
    return null;
  }

  const imageInputs = await buildImageInputs(args.retrievedEvidence);
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "You turn a trader's journal evidence into plain-English coaching and introspection."
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: buildPrompt(args)
            },
            ...imageInputs
          ]
        }
      ]
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const rawContent = payload.choices?.[0]?.message?.content;
  if (!rawContent) {
    return null;
  }

  try {
    return JSON.parse(rawContent) as SemanticAiPayload;
  } catch {
    return null;
  }
}

export function isSemanticInsightsAvailable() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function buildSemanticFingerprint(args: {
  trades: Trade[];
  settings: UserSettings;
  weeklyReports: InsightReport[];
  monthlyReports: InsightReport[];
  recurringThemes: SemanticRecurringTheme[];
}) {
  const payload = JSON.stringify({
    tradeIds: [...args.trades]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((trade) => [
        trade.id,
        trade.status,
        trade.closedAt,
        trade.openedAt,
        trade.postTradeReview,
        trade.notes,
        trade.reasonForEntry,
        trade.reasonForExit,
        [...trade.tags]
          .sort((left, right) =>
            `${left.category}:${left.value}:${left.id}`.localeCompare(`${right.category}:${right.value}:${right.id}`)
          )
          .map((tag) => [tag.category, tag.value]),
        [...trade.attachments]
          .sort((left, right) => `${left.id}:${left.fileName}`.localeCompare(`${right.id}:${right.fileName}`))
          .map((attachment) => [attachment.id, attachment.caption, attachment.fileName])
      ]),
    insightMode: args.settings.insightMode,
    aiInsightsEnabled: args.settings.aiInsightsEnabled,
    weeklyKeys: [...args.weeklyReports]
      .sort((left, right) => left.scopeKey.localeCompare(right.scopeKey))
      .map((report) => [report.scopeKey, report.summary]),
    monthlyKeys: [...args.monthlyReports]
      .sort((left, right) => left.scopeKey.localeCompare(right.scopeKey))
      .map((report) => [report.scopeKey, report.summary]),
    recurringThemes: [...args.recurringThemes].sort((left, right) =>
      `${left.category}:${left.value}:${left.count}`.localeCompare(`${right.category}:${right.value}:${right.count}`)
    )
  });

  return createHash("sha256").update(payload).digest("hex");
}

async function ensureSemanticCacheFile() {
  const cachePath = getSemanticInsightCachePath();
  await mkdir(dirname(cachePath), { recursive: true });

  try {
    await stat(cachePath);
  } catch {
    await writeFile(cachePath, "{}", "utf8");
  }
}

async function readSemanticCacheFile() {
  await ensureSemanticCacheFile();
  const file = await readFile(getSemanticInsightCachePath(), "utf8");
  return JSON.parse(file) as Record<string, { fingerprint: string; payload: SemanticInsightsPageData; updatedAt: string }>;
}

async function writeSemanticCacheFile(
  cache: Record<string, { fingerprint: string; payload: SemanticInsightsPageData; updatedAt: string }>
) {
  await ensureSemanticCacheFile();
  await writeFile(getSemanticInsightCachePath(), JSON.stringify(cache, null, 2), "utf8");
}

export async function deleteSemanticInsightsSnapshot(userId: string) {
  if (getStoreBackend() === "neon") {
    await ensureNeonSchema();
    const sql = getNeonSql();
    await sql.query("DELETE FROM semantic_insight_cache WHERE user_id = $1", [userId]);
    return;
  }

  const cache = await readSemanticCacheFile();
  delete cache[userId];
  await writeSemanticCacheFile(cache);
}

export async function getSemanticInsightsSnapshot(userId: string, expectedFingerprint?: string) {
  const snapshot = await getLatestSemanticInsightsSnapshot(userId);
  if (!snapshot) {
    return null;
  }
  if (expectedFingerprint && snapshot.fingerprint !== expectedFingerprint) {
    return null;
  }
  return snapshot.payload ?? null;
}

export async function getLatestSemanticInsightsSnapshot(userId: string): Promise<SemanticInsightsSnapshot | null> {
  if (getStoreBackend() === "neon") {
    await ensureNeonSchema();
    const sql = getNeonSql();
    const rows = await queryRows<SemanticInsightCacheRow>(
      sql,
      `SELECT user_id, fingerprint, payload, updated_at
       FROM semantic_insight_cache
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );
    const row = rows[0];
    if (!row) {
      return null;
    }
    return {
      fingerprint: row.fingerprint,
      payload: row.payload ?? null,
      updatedAt: row.updated_at
    };
  }

  const cache = await readSemanticCacheFile();
  const entry = cache[userId];
  if (!entry) {
    return null;
  }
  return {
    fingerprint: entry.fingerprint,
    payload: entry.payload ?? null,
    updatedAt: entry.updatedAt
  };
}

async function saveSemanticInsightsSnapshot(userId: string, fingerprint: string, payload: SemanticInsightsPageData) {
  if (getStoreBackend() === "neon") {
    await ensureNeonSchema();
    const sql = getNeonSql();
    await sql.query(
      `INSERT INTO semantic_insight_cache (user_id, fingerprint, payload, updated_at)
       VALUES ($1, $2, $3::jsonb, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET
         fingerprint = EXCLUDED.fingerprint,
         payload = EXCLUDED.payload,
         updated_at = EXCLUDED.updated_at`,
      [userId, fingerprint, JSON.stringify(payload), new Date().toISOString()]
    );
    return;
  }

  const cache = await readSemanticCacheFile();
  cache[userId] = {
    fingerprint,
    payload,
    updatedAt: new Date().toISOString()
  };
  await writeSemanticCacheFile(cache);
}

export async function buildSemanticInsightsPageData(args: {
  trades: Trade[];
  settings: UserSettings;
  weeklyReports: InsightReport[];
  monthlyReports: InsightReport[];
  recurringThemes: SemanticRecurringTheme[];
}): Promise<SemanticInsightsPageData | null> {
  const { trades, settings, weeklyReports, monthlyReports, recurringThemes } = args;

  if (!settings.aiInsightsEnabled || settings.insightMode !== "semantic") {
    return null;
  }

  if (trades.length === 0) {
    return null;
  }

  const vectors = await fetchEmbeddings(trades.map(collectEvidenceText));
  if (!vectors) {
    return null;
  }

  const evidence = toSemanticTradeEvidence(trades, settings, vectors);
  const closedEvidence = evidence.filter((item) => item.trade.status === "closed");
  const losingEvidence = closedEvidence.filter((item) => item.metrics.result === "loss" || item.metrics.result === "scratch");
  const winningEvidence = closedEvidence.filter((item) => item.metrics.result === "win");

  const frictionCentroid = averageVector(losingEvidence.map((item) => item.embedding));
  const reinforcementCentroid = averageVector(winningEvidence.map((item) => item.embedding));
  const recentEvidence = [...evidence].sort((left, right) => {
    const leftDate = new Date(left.trade.closedAt ?? left.trade.openedAt).getTime();
    const rightDate = new Date(right.trade.closedAt ?? right.trade.openedAt).getTime();
    return rightDate - leftDate;
  });

  const rankedFriction = [...evidence]
    .filter((item) => item.metrics.result !== "win")
    .sort((left, right) => cosineSimilarity(right.embedding, frictionCentroid) - cosineSimilarity(left.embedding, frictionCentroid));
  const rankedReinforcement = [...evidence]
    .filter((item) => item.metrics.result === "win")
    .sort((left, right) => cosineSimilarity(right.embedding, reinforcementCentroid) - cosineSimilarity(left.embedding, reinforcementCentroid));

  const retrievedEvidence = uniqueEvidence([
    ...recentEvidence.slice(0, 4),
    ...rankedFriction.slice(0, 2),
    ...rankedReinforcement.slice(0, 3)
  ]).slice(0, 6);
  const fallback = buildFallbackPageData(retrievedEvidence, weeklyReports, monthlyReports, recurringThemes);
  const aiPayload = await fetchSemanticPageNarrative({
    journalEvidence: evidence,
    retrievedEvidence,
    weeklyReports,
    monthlyReports,
    recurringThemes
  });

  if (!aiPayload) {
    return fallback;
  }

  const evidenceLookup = new Map(retrievedEvidence.map((item) => [item.trade.id, item]));

  return {
    title: sanitizeText(aiPayload.title, fallback.title),
    summary: sanitizeText(aiPayload.summary, fallback.summary),
    bullets:
      Array.isArray(aiPayload.bullets) && aiPayload.bullets.length > 0
        ? aiPayload.bullets.slice(0, 3).map((item) => sanitizeText(item, "")).filter(Boolean)
        : fallback.bullets,
    retrievedTrades:
      Array.isArray(aiPayload.retrievedTrades) && aiPayload.retrievedTrades.length > 0
        ? aiPayload.retrievedTrades.slice(0, 4).map((item) => {
            const evidenceItem = evidenceLookup.get(item.tradeId?.trim() ?? "");
            return {
              tradeId: evidenceItem?.trade.id ?? item.tradeId?.trim() ?? "",
              symbol: evidenceItem?.trade.symbol ?? "Trade",
              date: evidenceItem?.trade.closedAt
                ? formatShortDate(evidenceItem.trade.closedAt)
                : evidenceItem?.trade.openedAt
                  ? formatShortDate(evidenceItem.trade.openedAt)
                  : "",
              resultLabel: evidenceItem ? formatResultLabel(evidenceItem.metrics) : "Trade",
              headline: sanitizeText(item.headline, evidenceItem ? `${titleCase(evidenceItem.trade.setupType)} review` : "Trade review"),
              takeaway: sanitizeText(item.takeaway, evidenceItem?.excerpt ?? "No written review context.")
            };
          })
        : fallback.retrievedTrades,
    weeklyDigests:
      Array.isArray(aiPayload.weeklyDigests) && aiPayload.weeklyDigests.length > 0
        ? aiPayload.weeklyDigests.slice(0, 4).map((item, index) => ({
            scopeKey: sanitizeText(item.scopeKey, weeklyReports[index]?.scopeKey ?? `week-${index + 1}`),
            title: sanitizeText(item.title, weeklyReports[index]?.title ?? "Weekly review"),
            summary: sanitizeText(item.summary, weeklyReports[index]?.summary ?? ""),
            bullets:
              Array.isArray(item.bullets) && item.bullets.length > 0
                ? item.bullets.slice(0, 3).map((bullet) => sanitizeText(bullet, "")).filter(Boolean)
                : weeklyReports[index]?.bullets ?? []
          }))
        : fallback.weeklyDigests,
    monthlyDigests:
      Array.isArray(aiPayload.monthlyDigests) && aiPayload.monthlyDigests.length > 0
        ? aiPayload.monthlyDigests.slice(0, 4).map((item, index) => ({
            scopeKey: sanitizeText(item.scopeKey, monthlyReports[index]?.scopeKey ?? `month-${index + 1}`),
            title: sanitizeText(item.title, monthlyReports[index]?.title ?? "Monthly review"),
            summary: sanitizeText(item.summary, monthlyReports[index]?.summary ?? ""),
            bullets:
              Array.isArray(item.bullets) && item.bullets.length > 0
                ? item.bullets.slice(0, 3).map((bullet) => sanitizeText(bullet, "")).filter(Boolean)
                : monthlyReports[index]?.bullets ?? []
          }))
        : fallback.monthlyDigests,
    patternCards:
      Array.isArray(aiPayload.patternCards) && aiPayload.patternCards.length > 0
        ? aiPayload.patternCards.slice(0, 4).map((item, index) => ({
            label: sanitizeText(item.label, fallback.patternCards[index]?.label ?? "Pattern"),
            title: sanitizeText(item.title, fallback.patternCards[index]?.title ?? "Repeated behavior"),
            summary: sanitizeText(item.summary, fallback.patternCards[index]?.summary ?? ""),
            countLabel: sanitizeText(item.countLabel, fallback.patternCards[index]?.countLabel ?? "")
          }))
        : fallback.patternCards,
    coachingCards:
      Array.isArray(aiPayload.coachingCards) && aiPayload.coachingCards.length > 0
        ? aiPayload.coachingCards.slice(0, 4).map((item, index) => {
            const evidenceItem = evidenceLookup.get(item.tradeId?.trim() ?? "") ?? retrievedEvidence[index];
            return {
              tradeId: evidenceItem?.trade.id ?? item.tradeId?.trim() ?? "",
              symbol: evidenceItem?.trade.symbol ?? "Trade",
              date: evidenceItem?.trade.closedAt
                ? formatShortDate(evidenceItem.trade.closedAt)
                : evidenceItem?.trade.openedAt
                  ? formatShortDate(evidenceItem.trade.openedAt)
                  : "",
              resultLabel: evidenceItem ? formatResultLabel(evidenceItem.metrics) : "Trade",
              tone: item.tone ?? (evidenceItem?.metrics.result === "loss" ? "warning" : "reinforcement"),
              headline: sanitizeText(item.headline, fallback.coachingCards[index]?.headline ?? "Trade takeaway"),
              summary: sanitizeText(item.summary, fallback.coachingCards[index]?.summary ?? ""),
              bullets:
                Array.isArray(item.bullets) && item.bullets.length > 0
                  ? item.bullets.slice(0, 3).map((bullet) => sanitizeText(bullet, "")).filter(Boolean)
                  : fallback.coachingCards[index]?.bullets ?? []
            };
          })
        : fallback.coachingCards,
    traderProfile: {
      label: sanitizeText(aiPayload.traderProfile?.label, fallback.traderProfile.label),
      summary: sanitizeText(aiPayload.traderProfile?.summary, fallback.traderProfile.summary),
      nextSteps:
        Array.isArray(aiPayload.traderProfile?.nextSteps) && aiPayload.traderProfile.nextSteps.length > 0
          ? aiPayload.traderProfile.nextSteps.slice(0, 3).map((item) => sanitizeText(item, "")).filter(Boolean)
          : fallback.traderProfile.nextSteps
    }
  };
}

export async function regenerateSemanticInsightsSnapshot(args: {
  userId: string;
  trades: Trade[];
  settings: UserSettings;
  weeklyReports: InsightReport[];
  monthlyReports: InsightReport[];
  recurringThemes: SemanticRecurringTheme[];
}) {
  if (!args.settings.aiInsightsEnabled || args.settings.insightMode !== "semantic" || !isSemanticInsightsAvailable()) {
    return null;
  }

  const fingerprint = buildSemanticFingerprint(args);
  const payload = await buildSemanticInsightsPageData(args);

  if (!payload) {
    return null;
  }

  await saveSemanticInsightsSnapshot(args.userId, fingerprint, payload);
  return payload;
}
