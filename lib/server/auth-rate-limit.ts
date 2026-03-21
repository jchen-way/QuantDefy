import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { neon } from "@neondatabase/serverless";
import { getRuntimeDataDir } from "@/lib/server/runtime-paths";

type AuthRateLimitScope = "login" | "register";

type AuthRateLimitRow = {
  scope: AuthRateLimitScope;
  identifier: string;
  attempts: number;
  first_failed_at: string;
  blocked_until: string | null;
  updated_at: string;
};

type AuthRateLimitState = Record<string, AuthRateLimitEntry>;

type AuthRateLimitEntry = {
  scope: AuthRateLimitScope;
  identifier: string;
  attempts: number;
  firstFailedAt: string;
  blockedUntil: string | null;
  updatedAt: string;
};

let fileRateLimitWriteQueue: Promise<void> = Promise.resolve();

const rateLimitPolicy: Record<
  AuthRateLimitScope,
  {
    maxAttempts: number;
    windowMs: number;
    lockoutMs: number;
    errorMessage: string;
  }
> = {
  login: {
    maxAttempts: 5,
    windowMs: 15 * 60 * 1000,
    lockoutMs: 30 * 60 * 1000,
    errorMessage: "Too many sign-in attempts. Try again in 30 minutes."
  },
  register: {
    maxAttempts: 4,
    windowMs: 15 * 60 * 1000,
    lockoutMs: 30 * 60 * 1000,
    errorMessage: "Too many registration attempts. Try again in 30 minutes."
  }
};

let neonBootstrapPromise: Promise<void> | null = null;

function getRuntimeMode() {
  return process.env.DATABASE_URL ? "neon" : "file";
}

function getKey(scope: AuthRateLimitScope, identifier: string) {
  return `${scope}:${identifier.trim().toLowerCase()}`;
}

function getPolicy(scope: AuthRateLimitScope) {
  return rateLimitPolicy[scope];
}

function getNeonSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return neon(databaseUrl);
}

async function ensureNeonSchema() {
  if (neonBootstrapPromise) {
    return neonBootstrapPromise;
  }

  neonBootstrapPromise = (async () => {
    const sql = getNeonSql();
    await sql.query(`
      CREATE TABLE IF NOT EXISTS auth_rate_limits (
        scope TEXT NOT NULL,
        identifier TEXT NOT NULL,
        attempts INTEGER NOT NULL,
        first_failed_at TIMESTAMPTZ NOT NULL,
        blocked_until TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (scope, identifier)
      )
    `);
    await sql.query(
      "CREATE INDEX IF NOT EXISTS auth_rate_limits_blocked_until_idx ON auth_rate_limits (blocked_until)"
    );
  })().catch((error) => {
    neonBootstrapPromise = null;
    throw error;
  });

  return neonBootstrapPromise;
}

async function ensureFileState() {
  const runtimeDir = getRuntimeDataDir();
  const rateLimitStatePath = path.join(runtimeDir, "auth-rate-limits.json");
  await mkdir(runtimeDir, { recursive: true });

  try {
    await stat(rateLimitStatePath);
  } catch {
    await writeFile(rateLimitStatePath, JSON.stringify({}, null, 2), "utf8");
  }
}

async function readFileState(): Promise<AuthRateLimitState> {
  await ensureFileState();
  const rateLimitStatePath = path.join(getRuntimeDataDir(), "auth-rate-limits.json");
  const content = await readFile(rateLimitStatePath, "utf8");
  return JSON.parse(content) as AuthRateLimitState;
}

async function writeFileState(state: AuthRateLimitState) {
  await ensureFileState();
  const rateLimitStatePath = path.join(getRuntimeDataDir(), "auth-rate-limits.json");
  await writeFile(rateLimitStatePath, JSON.stringify(state, null, 2), "utf8");
}

async function withFileRateLimitWriteLock<T>(operation: () => Promise<T>) {
  const next = fileRateLimitWriteQueue.then(operation, operation);
  fileRateLimitWriteQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function normalizeEntry(scope: AuthRateLimitScope, identifier: string, entry: AuthRateLimitEntry | null) {
  if (!entry) {
    return null;
  }

  const policy = getPolicy(scope);
  const firstFailure = new Date(entry.firstFailedAt).getTime();
  const blockedUntil = entry.blockedUntil ? new Date(entry.blockedUntil).getTime() : null;
  const now = Date.now();

  if (!Number.isFinite(firstFailure)) {
    return null;
  }

  if (blockedUntil && blockedUntil > now) {
    return entry;
  }

  if (now - firstFailure > policy.windowMs) {
    return null;
  }

  return {
    ...entry,
    identifier: identifier.trim().toLowerCase(),
    scope,
    blockedUntil: blockedUntil && blockedUntil > now ? entry.blockedUntil : null
  };
}

async function readRateLimit(scope: AuthRateLimitScope, identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  if (getRuntimeMode() === "neon") {
    await ensureNeonSchema();
    const sql = getNeonSql();
    const rows = (await sql.query(
      `SELECT scope, identifier, attempts, first_failed_at, blocked_until, updated_at
       FROM auth_rate_limits
       WHERE scope = $1 AND identifier = $2
       LIMIT 1`,
      [scope, normalizedIdentifier]
    )) as unknown as AuthRateLimitRow[];

    const row = rows[0];

    return normalizeEntry(
      scope,
      normalizedIdentifier,
      row
        ? {
            scope: row.scope,
            identifier: row.identifier,
            attempts: Number(row.attempts),
            firstFailedAt: row.first_failed_at,
            blockedUntil: row.blocked_until,
            updatedAt: row.updated_at
          }
        : null
    );
  }

  const state = await readFileState();
  return normalizeEntry(scope, normalizedIdentifier, state[getKey(scope, normalizedIdentifier)] ?? null);
}

async function persistRateLimit(entry: AuthRateLimitEntry) {
  const normalizedIdentifier = entry.identifier.trim().toLowerCase();

  if (getRuntimeMode() === "neon") {
    await ensureNeonSchema();
    const sql = getNeonSql();
    await sql.query(
      `INSERT INTO auth_rate_limits (
        scope,
        identifier,
        attempts,
        first_failed_at,
        blocked_until,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (scope, identifier)
      DO UPDATE SET
        attempts = EXCLUDED.attempts,
        first_failed_at = EXCLUDED.first_failed_at,
        blocked_until = EXCLUDED.blocked_until,
        updated_at = EXCLUDED.updated_at`,
      [
        entry.scope,
        normalizedIdentifier,
        entry.attempts,
        entry.firstFailedAt,
        entry.blockedUntil,
        entry.updatedAt
      ]
    );
    return;
  }

  await withFileRateLimitWriteLock(async () => {
    const state = await readFileState();
    state[getKey(entry.scope, normalizedIdentifier)] = {
      ...entry,
      identifier: normalizedIdentifier
    };
    await writeFileState(state);
  });
}

async function clearPersistedRateLimit(scope: AuthRateLimitScope, identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();

  if (getRuntimeMode() === "neon") {
    await ensureNeonSchema();
    const sql = getNeonSql();
    await sql.query("DELETE FROM auth_rate_limits WHERE scope = $1 AND identifier = $2", [
      scope,
      normalizedIdentifier
    ]);
    return;
  }

  await withFileRateLimitWriteLock(async () => {
    const state = await readFileState();
    delete state[getKey(scope, normalizedIdentifier)];
    await writeFileState(state);
  });
}

export async function assertNotRateLimited(scope: AuthRateLimitScope, identifier: string) {
  const entry = await readRateLimit(scope, identifier);

  if (!entry?.blockedUntil) {
    return;
  }

  if (new Date(entry.blockedUntil).getTime() > Date.now()) {
    throw new Error(getPolicy(scope).errorMessage);
  }

  await clearPersistedRateLimit(scope, identifier);
}

export async function recordAuthFailure(scope: AuthRateLimitScope, identifier: string) {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const now = new Date();
  const policy = getPolicy(scope);

  if (getRuntimeMode() === "file") {
    await withFileRateLimitWriteLock(async () => {
      const state = await readFileState();
      const existing = normalizeEntry(scope, normalizedIdentifier, state[getKey(scope, normalizedIdentifier)] ?? null);
      const attempts = existing ? existing.attempts + 1 : 1;
      const firstFailedAt =
        existing && now.getTime() - new Date(existing.firstFailedAt).getTime() <= policy.windowMs
          ? existing.firstFailedAt
          : now.toISOString();
      const blockedUntil =
        attempts >= policy.maxAttempts ? new Date(now.getTime() + policy.lockoutMs).toISOString() : null;

      state[getKey(scope, normalizedIdentifier)] = {
        scope,
        identifier: normalizedIdentifier,
        attempts,
        firstFailedAt,
        blockedUntil,
        updatedAt: now.toISOString()
      };
      await writeFileState(state);
    });
    return;
  }

  const existing = await readRateLimit(scope, normalizedIdentifier);
  const attempts = existing ? existing.attempts + 1 : 1;
  const firstFailedAt =
    existing && now.getTime() - new Date(existing.firstFailedAt).getTime() <= policy.windowMs
      ? existing.firstFailedAt
      : now.toISOString();
  const blockedUntil =
    attempts >= policy.maxAttempts ? new Date(now.getTime() + policy.lockoutMs).toISOString() : null;

  await persistRateLimit({
    scope,
    identifier: normalizedIdentifier,
    attempts,
    firstFailedAt,
    blockedUntil,
    updatedAt: now.toISOString()
  });
}

export async function clearAuthFailures(scope: AuthRateLimitScope, identifier: string) {
  await clearPersistedRateLimit(scope, identifier);
}
