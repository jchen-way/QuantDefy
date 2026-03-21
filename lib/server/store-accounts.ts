import {
  AppStore,
  UserAccount,
  UserSession,
  UserSettings
} from "@/lib/domain/types";
import { getStoreBackend, readStore, writeStore } from "@/lib/server/store-core";
import { refreshInsights, withStoreWriteLock } from "@/lib/server/store-file";
import { ensureNeonSchema, getNeonSql, isUniqueViolation, queryRows } from "@/lib/server/store-neon";

function appendUserToFileStore(store: AppStore, user: UserAccount, settings: UserSettings) {
  return refreshInsights({
    ...store,
    users: [...store.users, user],
    settings: [...store.settings, settings]
  });
}

export async function getUserById(userId: string) {
  if (getStoreBackend() === "neon") {
    await ensureNeonSchema();
    const sql = getNeonSql();
    const rows = await queryRows<{
      id: string;
      email: string;
      display_name: string;
      password_hash: string;
      created_at: string;
    }>(
      sql,
      "SELECT id, email, display_name, password_hash, created_at FROM users WHERE id = $1 LIMIT 1",
      [userId]
    );
    const row = rows[0];

    return row
      ? {
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          passwordHash: row.password_hash,
          createdAt: row.created_at
        }
      : null;
  }

  const store = await readStore();
  return store.users.find((user) => user.id === userId) ?? null;
}

export async function getUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();

  if (getStoreBackend() === "neon") {
    await ensureNeonSchema();
    const sql = getNeonSql();
    const rows = await queryRows<{
      id: string;
      email: string;
      display_name: string;
      password_hash: string;
      created_at: string;
    }>(
      sql,
      `SELECT id, email, display_name, password_hash, created_at
       FROM users
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [normalizedEmail]
    );
    const row = rows[0];

    return row
      ? {
          id: row.id,
          email: row.email,
          displayName: row.display_name,
          passwordHash: row.password_hash,
          createdAt: row.created_at
        }
      : null;
  }

  const store = await readStore();
  return store.users.find((user) => user.email.toLowerCase() === normalizedEmail) ?? null;
}

export async function createUser(user: UserAccount, settings: UserSettings) {
  return withStoreWriteLock(async () => {
    if (getStoreBackend() === "neon") {
      await ensureNeonSchema();
      const sql = getNeonSql();
      try {
        await sql.transaction([
          sql.query(
            `INSERT INTO users (id, email, display_name, password_hash, created_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [user.id, user.email, user.displayName, user.passwordHash, user.createdAt]
          ),
          sql.query(
            `INSERT INTO user_settings (
              user_id,
              display_name,
              email,
              timezone,
              default_risk,
              default_capital,
              ai_insights_enabled,
              insight_mode,
              privacy_mode,
              strategy_taxonomy,
              custom_trade_types,
              custom_setup_types
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11::text[], $12::text[])`,
            [
              settings.userId,
              settings.displayName,
              settings.email,
              settings.timezone,
              settings.defaultRisk,
              settings.defaultCapital,
              settings.aiInsightsEnabled,
              settings.insightMode,
              settings.privacyMode,
              settings.strategyTaxonomy,
              settings.customTradeTypes,
              settings.customSetupTypes
            ]
          )
        ]);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new Error("An account with this email already exists.");
        }
        throw error;
      }
      return user;
    }

    const store = await readStore();
    const nextStore = appendUserToFileStore(store, user, settings);
    await writeStore(nextStore);
    return user;
  });
}

export async function createSession(session: UserSession) {
  return withStoreWriteLock(async () => {
    if (getStoreBackend() === "neon") {
      await ensureNeonSchema();
      const sql = getNeonSql();
      await sql.query(
        `INSERT INTO sessions (id, user_id, created_at, expires_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id)
         DO UPDATE SET
           user_id = EXCLUDED.user_id,
           created_at = EXCLUDED.created_at,
           expires_at = EXCLUDED.expires_at`,
        [session.id, session.userId, session.createdAt, session.expiresAt]
      );
      return session;
    }

    const store = await readStore();
    const nextStore = {
      ...store,
      sessions: [...store.sessions.filter((item) => item.id !== session.id), session]
    };
    await writeStore(nextStore);
    return session;
  });
}

export async function getSession(sessionId: string) {
  if (getStoreBackend() === "neon") {
    await ensureNeonSchema();
    const sql = getNeonSql();
    const rows = await queryRows<{ id: string; user_id: string; created_at: string; expires_at: string }>(
      sql,
      "SELECT id, user_id, created_at, expires_at FROM sessions WHERE id = $1 LIMIT 1",
      [sessionId]
    );
    const row = rows[0];

    return row
      ? {
          id: row.id,
          userId: row.user_id,
          createdAt: row.created_at,
          expiresAt: row.expires_at
        }
      : null;
  }

  const store = await readStore();
  return store.sessions.find((session) => session.id === sessionId) ?? null;
}

export async function deleteSession(sessionId: string) {
  await withStoreWriteLock(async () => {
    if (getStoreBackend() === "neon") {
      await ensureNeonSchema();
      const sql = getNeonSql();
      await sql.query("DELETE FROM sessions WHERE id = $1", [sessionId]);
      return;
    }

    const store = await readStore();
    const nextStore = {
      ...store,
      sessions: store.sessions.filter((session) => session.id !== sessionId)
    };
    await writeStore(nextStore);
  });
}
