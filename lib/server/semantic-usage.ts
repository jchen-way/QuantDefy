import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { SemanticRefreshUsageEntry } from "@/lib/domain/types";
import { getRuntimeDataDir } from "@/lib/server/runtime-paths";
import { getStoreBackend, readStore } from "@/lib/server/store-core";
import { ensureNeonSchema, getNeonSql, queryRows } from "@/lib/server/store-neon";

type SemanticRefreshUsageRow = {
  user_id: string;
  refreshed_at: string;
};

export type SemanticRefreshUsageSummary = {
  userId: string;
  email: string;
  displayName: string;
  refreshCount: number;
  lastRefreshedAt: string | null;
  isAdmin: boolean;
};

type SemanticRefreshPolicy = {
  cooldownMs: number;
  windowMs: number;
  maxRefreshesPerWindow: number;
};

const defaultCooldownMs = 15 * 60 * 1000;
const defaultWindowMs = 24 * 60 * 60 * 1000;
const defaultMaxRefreshesPerWindow = 6;

function getUsageFilePath() {
  return path.join(getRuntimeDataDir(), "semantic-usage.json");
}

function parsePositiveIntEnv(name: string, fallback: number) {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function getSemanticRefreshPolicy(): SemanticRefreshPolicy {
  return {
    cooldownMs: parsePositiveIntEnv("SEMANTIC_REFRESH_COOLDOWN_MS", defaultCooldownMs),
    windowMs: parsePositiveIntEnv("SEMANTIC_REFRESH_WINDOW_MS", defaultWindowMs),
    maxRefreshesPerWindow: parsePositiveIntEnv(
      "SEMANTIC_REFRESH_MAX_PER_WINDOW",
      defaultMaxRefreshesPerWindow
    )
  };
}

function formatDuration(ms: number) {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60000));
  if (totalMinutes < 60) {
    return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `${hours} hour${hours === 1 ? "" : "s"} ${minutes} minute${minutes === 1 ? "" : "s"}`;
}

async function ensureUsageFile() {
  const runtimeDir = getRuntimeDataDir();
  const usageFilePath = getUsageFilePath();
  await mkdir(runtimeDir, { recursive: true });

  try {
    await stat(usageFilePath);
  } catch {
    await writeFile(usageFilePath, "[]", "utf8");
  }
}

async function readFileUsageEntries(): Promise<SemanticRefreshUsageEntry[]> {
  await ensureUsageFile();
  const file = await readFile(getUsageFilePath(), "utf8");
  const parsed = JSON.parse(file) as SemanticRefreshUsageEntry[];
  return Array.isArray(parsed) ? parsed : [];
}

async function writeFileUsageEntries(entries: SemanticRefreshUsageEntry[]) {
  await ensureUsageFile();
  await writeFile(getUsageFilePath(), JSON.stringify(entries, null, 2), "utf8");
}

function pruneEntries(entries: SemanticRefreshUsageEntry[], now = Date.now()) {
  const policy = getSemanticRefreshPolicy();
  return entries.filter((entry) => now - new Date(entry.refreshedAt).getTime() <= policy.windowMs);
}

async function ensureNeonUsageSchema() {
  await ensureNeonSchema();
  const sql = getNeonSql();
  await sql.query(`
    CREATE TABLE IF NOT EXISTS semantic_refresh_usage (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      refreshed_at TIMESTAMPTZ NOT NULL
    )
  `);
  await sql.query(
    "CREATE INDEX IF NOT EXISTS semantic_refresh_usage_user_id_refreshed_at_idx ON semantic_refresh_usage (user_id, refreshed_at DESC)"
  );
}

export async function listSemanticRefreshUsage(userId: string): Promise<SemanticRefreshUsageEntry[]> {
  const now = Date.now();

  if (getStoreBackend() === "neon") {
    await ensureNeonUsageSchema();
    const sql = getNeonSql();
    const policy = getSemanticRefreshPolicy();
    const cutoff = new Date(now - policy.windowMs).toISOString();
    await sql.query("DELETE FROM semantic_refresh_usage WHERE refreshed_at < $1", [cutoff]);
    const rows = await queryRows<SemanticRefreshUsageRow>(
      sql,
      `SELECT user_id, refreshed_at
       FROM semantic_refresh_usage
       WHERE user_id = $1
       ORDER BY refreshed_at DESC`,
      [userId]
    );
    return rows.map((row) => ({
      userId: row.user_id,
      refreshedAt: row.refreshed_at
    }));
  }

  const entries = pruneEntries(await readFileUsageEntries(), now);
  await writeFileUsageEntries(entries);
  return entries.filter((entry) => entry.userId === userId).sort((left, right) => right.refreshedAt.localeCompare(left.refreshedAt));
}

export async function assertSemanticRefreshAllowed(userId: string) {
  const entries = await listSemanticRefreshUsage(userId);
  const policy = getSemanticRefreshPolicy();
  const now = Date.now();
  const lastRefresh = entries[0] ? new Date(entries[0].refreshedAt).getTime() : null;

  if (lastRefresh && now - lastRefresh < policy.cooldownMs) {
    const waitMs = policy.cooldownMs - (now - lastRefresh);
    throw new Error(`Premium insight refresh is cooling down. Try again in ${formatDuration(waitMs)}.`);
  }

  if (entries.length >= policy.maxRefreshesPerWindow) {
    const oldestTrackedRefresh = new Date(entries[entries.length - 1].refreshedAt).getTime();
    const resetMs = oldestTrackedRefresh + policy.windowMs - now;
    throw new Error(
      `Premium insight refresh limit reached. You can run ${policy.maxRefreshesPerWindow} premium refreshes every ${formatDuration(policy.windowMs)}. Try again in ${formatDuration(resetMs)}.`
    );
  }
}

export async function recordSemanticRefresh(userId: string, refreshedAt = new Date().toISOString()) {
  if (getStoreBackend() === "neon") {
    await ensureNeonUsageSchema();
    const sql = getNeonSql();
    await sql.query("INSERT INTO semantic_refresh_usage (user_id, refreshed_at) VALUES ($1, $2)", [
      userId,
      refreshedAt
    ]);
    return;
  }

  const now = Date.now();
  const entries = pruneEntries(await readFileUsageEntries(), now);
  entries.push({ userId, refreshedAt });
  await writeFileUsageEntries(entries);
}

export async function listSemanticRefreshUsageSummaries(
  isAdminEmail: (email: string) => boolean
): Promise<SemanticRefreshUsageSummary[]> {
  const store = await readStore();
  const now = Date.now();
  const usageCountsByUser = new Map<string, { refreshCount: number; lastRefreshedAt: string | null }>();

  if (getStoreBackend() === "neon") {
    await ensureNeonUsageSchema();
    const sql = getNeonSql();
    const policy = getSemanticRefreshPolicy();
    const cutoff = new Date(now - policy.windowMs).toISOString();
    await sql.query("DELETE FROM semantic_refresh_usage WHERE refreshed_at < $1", [cutoff]);
    const rows = await queryRows<{
      user_id: string;
      refresh_count: number;
      last_refreshed_at: string | null;
    }>(
      sql,
      `SELECT user_id, COUNT(*)::int AS refresh_count, MAX(refreshed_at) AS last_refreshed_at
       FROM semantic_refresh_usage
       GROUP BY user_id`
    );
    for (const row of rows) {
      usageCountsByUser.set(row.user_id, {
        refreshCount: Number(row.refresh_count),
        lastRefreshedAt: row.last_refreshed_at
      });
    }
  } else {
    const entries = pruneEntries(await readFileUsageEntries(), now);
    await writeFileUsageEntries(entries);
    for (const entry of entries) {
      const current = usageCountsByUser.get(entry.userId) ?? {
        refreshCount: 0,
        lastRefreshedAt: null
      };
      current.refreshCount += 1;
      if (!current.lastRefreshedAt || entry.refreshedAt > current.lastRefreshedAt) {
        current.lastRefreshedAt = entry.refreshedAt;
      }
      usageCountsByUser.set(entry.userId, current);
    }
  }

  return store.users
    .map((user) => {
      const usage = usageCountsByUser.get(user.id) ?? { refreshCount: 0, lastRefreshedAt: null };
      return {
        userId: user.id,
        email: user.email,
        displayName: user.displayName,
        refreshCount: usage.refreshCount,
        lastRefreshedAt: usage.lastRefreshedAt,
        isAdmin: isAdminEmail(user.email)
      };
    })
    .sort((left, right) => {
      if (right.refreshCount !== left.refreshCount) {
        return right.refreshCount - left.refreshCount;
      }
      return left.displayName.localeCompare(right.displayName);
    });
}
