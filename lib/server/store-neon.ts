import { neon } from "@neondatabase/serverless";
import { buildInsightReportsForState } from "@/lib/server/store-insights";
import {
  buildTrades,
  mapInsightRow,
  mapPresetRow,
  mapSettingsRow
} from "@/lib/server/store-mappers";
import {
  AttachmentRow,
  FillRow,
  InsightRow,
  PresetRow,
  SettingsRow,
  TagRow,
  TradeRow
} from "@/lib/server/store-types";
import { AppStore } from "@/lib/domain/types";

const legacyStoreTableName = "app_store_state";
const legacyStoreRowId = "default";

export function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

export function getNeonSql() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return neon(databaseUrl);
}

export function isDatabaseConnectionError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const cause = error.cause instanceof Error ? error.cause : null;
  const causeMessage = cause?.message.toLowerCase() ?? "";
  const causeCode = typeof (cause as NodeJS.ErrnoException | null)?.code === "string"
    ? ((cause as NodeJS.ErrnoException).code ?? "").toLowerCase()
    : "";

  return (
    message.includes("fetch failed") ||
    message.includes("error connecting to database") ||
    causeMessage.includes("fetch failed") ||
    causeMessage.includes("enotfound") ||
    causeMessage.includes("eai_again") ||
    causeCode === "enotfound" ||
    causeCode === "eai_again"
  );
}

export function getDatabaseConnectionErrorMessage(error: unknown) {
  if (isDatabaseConnectionError(error)) {
    return "Database connection unavailable. Check the active DATABASE_URL and confirm the Neon host resolves from this runtime.";
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Unable to connect to the database.";
}

export async function queryRows<T>(
  sql: { query: (text: string, params?: unknown[]) => Promise<unknown> },
  text: string,
  params?: unknown[]
) {
  try {
    const rows = await sql.query(text, params ?? []);
    return rows as unknown as T[];
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      throw new Error(getDatabaseConnectionErrorMessage(error), {
        cause: error
      });
    }

    throw error;
  }
}

async function insertSeedDataNeon(store: AppStore) {
  const sql = getNeonSql();
  const nextStore = {
    ...store,
    insightReports: []
  };
  const hydratedInsightReports = nextStore.settings.flatMap((settings) =>
    buildInsightReportsForState(
      nextStore.trades.filter((trade) => trade.userId === settings.userId),
      settings
    )
  );

  for (const user of nextStore.users) {
    await sql.query(
      `INSERT INTO users (id, email, display_name, password_hash, created_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id)
       DO UPDATE SET
         email = EXCLUDED.email,
         display_name = EXCLUDED.display_name,
         password_hash = EXCLUDED.password_hash,
         created_at = EXCLUDED.created_at`,
      [user.id, user.email, user.displayName, user.passwordHash, user.createdAt]
    );
  }

  for (const session of nextStore.sessions) {
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
  }

  for (const settings of nextStore.settings) {
    await sql.query(
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text[], $11::text[], $12::text[])
      ON CONFLICT (user_id)
      DO UPDATE SET
        display_name = EXCLUDED.display_name,
        email = EXCLUDED.email,
        timezone = EXCLUDED.timezone,
        default_risk = EXCLUDED.default_risk,
        default_capital = EXCLUDED.default_capital,
        ai_insights_enabled = EXCLUDED.ai_insights_enabled,
        insight_mode = EXCLUDED.insight_mode,
        privacy_mode = EXCLUDED.privacy_mode,
        strategy_taxonomy = EXCLUDED.strategy_taxonomy,
        custom_trade_types = EXCLUDED.custom_trade_types,
        custom_setup_types = EXCLUDED.custom_setup_types`,
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
    );
  }

  for (const preset of nextStore.filterPresets) {
    await sql.query(
      `INSERT INTO trade_filter_presets (
        id,
        user_id,
        name,
        symbol,
        setup_type,
        direction,
        result,
        duration_bucket
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        name = EXCLUDED.name,
        symbol = EXCLUDED.symbol,
        setup_type = EXCLUDED.setup_type,
        direction = EXCLUDED.direction,
        result = EXCLUDED.result,
        duration_bucket = EXCLUDED.duration_bucket`,
      [
        preset.id,
        preset.userId,
        preset.name,
        preset.symbol ?? null,
        preset.setupType ?? null,
        preset.direction ?? null,
        preset.result ?? null,
        preset.durationBucket ?? null
      ]
    );
  }

  for (const trade of nextStore.trades) {
    await sql.query(
      `INSERT INTO trades (
        id, user_id, symbol, asset_class, instrument_label, direction, trade_type, setup_type,
        status, opened_at, closed_at, thesis, reason_for_entry, reason_for_exit, pre_trade_plan,
        post_trade_review, capital_allocated, planned_risk, fees, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      ON CONFLICT (id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        symbol = EXCLUDED.symbol,
        asset_class = EXCLUDED.asset_class,
        instrument_label = EXCLUDED.instrument_label,
        direction = EXCLUDED.direction,
        trade_type = EXCLUDED.trade_type,
        setup_type = EXCLUDED.setup_type,
        status = EXCLUDED.status,
        opened_at = EXCLUDED.opened_at,
        closed_at = EXCLUDED.closed_at,
        thesis = EXCLUDED.thesis,
        reason_for_entry = EXCLUDED.reason_for_entry,
        reason_for_exit = EXCLUDED.reason_for_exit,
        pre_trade_plan = EXCLUDED.pre_trade_plan,
        post_trade_review = EXCLUDED.post_trade_review,
        capital_allocated = EXCLUDED.capital_allocated,
        planned_risk = EXCLUDED.planned_risk,
        fees = EXCLUDED.fees,
        notes = EXCLUDED.notes`,
      [
        trade.id,
        trade.userId,
        trade.symbol,
        trade.assetClass,
        trade.instrumentLabel,
        trade.direction,
        trade.tradeType,
        trade.setupType,
        trade.status,
        trade.openedAt,
        trade.closedAt,
        trade.thesis,
        trade.reasonForEntry,
        trade.reasonForExit,
        trade.preTradePlan,
        trade.postTradeReview,
        trade.capitalAllocated,
        trade.plannedRisk,
        trade.fees,
        trade.notes
      ]
    );

    for (const fill of trade.fills) {
      await sql.query(
        `INSERT INTO trade_fills (id, trade_id, side, filled_at, quantity, price)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id)
         DO UPDATE SET
           trade_id = EXCLUDED.trade_id,
           side = EXCLUDED.side,
           filled_at = EXCLUDED.filled_at,
           quantity = EXCLUDED.quantity,
           price = EXCLUDED.price`,
        [fill.id, trade.id, fill.side, fill.filledAt, fill.quantity, fill.price]
      );
    }

    for (const attachment of trade.attachments) {
      await sql.query(
        `INSERT INTO trade_attachments (id, trade_id, kind, storage_path, caption, uploaded_at, file_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id)
         DO UPDATE SET
           trade_id = EXCLUDED.trade_id,
           kind = EXCLUDED.kind,
           storage_path = EXCLUDED.storage_path,
           caption = EXCLUDED.caption,
           uploaded_at = EXCLUDED.uploaded_at,
           file_name = EXCLUDED.file_name`,
        [
          attachment.id,
          trade.id,
          attachment.kind,
          attachment.storagePath,
          attachment.caption,
          attachment.uploadedAt,
          attachment.fileName ?? null
        ]
      );
    }

    for (const tag of trade.tags) {
      await sql.query(
        `INSERT INTO trade_tags (id, trade_id, category, value)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id)
         DO UPDATE SET
           trade_id = EXCLUDED.trade_id,
           category = EXCLUDED.category,
           value = EXCLUDED.value`,
        [tag.id, trade.id, tag.category, tag.value]
      );
    }
  }

  for (const insight of hydratedInsightReports) {
    await sql.query(
      `INSERT INTO insight_reports (
        id, user_id, scope, scope_key, created_at, title, tone, summary, supporting_trade_ids, bullets
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::text[])
      ON CONFLICT (id)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        scope = EXCLUDED.scope,
        scope_key = EXCLUDED.scope_key,
        created_at = EXCLUDED.created_at,
        title = EXCLUDED.title,
        tone = EXCLUDED.tone,
        summary = EXCLUDED.summary,
        supporting_trade_ids = EXCLUDED.supporting_trade_ids,
        bullets = EXCLUDED.bullets`,
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
    );
  }
}

async function migrateLegacyBlobStoreIfPresent() {
  const sql = getNeonSql();
  const legacyResult = await queryRows<{ table_name: string | null }>(
    sql,
    "SELECT to_regclass($1) AS table_name",
    [`public.${legacyStoreTableName}`]
  );

  if (!legacyResult[0]?.table_name) {
    return;
  }

  const rows = await queryRows<{ payload: AppStore | string }>(
    sql,
    `SELECT payload FROM ${legacyStoreTableName} WHERE id = $1`,
    [legacyStoreRowId]
  );

  if (rows.length === 0) {
    return;
  }

  const payload = rows[0].payload;
  const store = typeof payload === "string" ? (JSON.parse(payload) as AppStore) : payload;
  await insertSeedDataNeon(store);
}

let neonBootstrapPromise: Promise<void> | null = null;

export async function ensureNeonSchema() {
  if (neonBootstrapPromise) {
    return neonBootstrapPromise;
  }

  neonBootstrapPromise = (async () => {
    const sql = getNeonSql();

    await sql.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      )
    `);
    await sql.query("CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users ((lower(email)))");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL
      )
    `);
    await sql.query("CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id)");
    await sql.query("CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions (expires_at)");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        display_name TEXT NOT NULL,
        email TEXT NOT NULL,
        timezone TEXT NOT NULL,
        default_risk DOUBLE PRECISION NOT NULL,
        default_capital DOUBLE PRECISION NOT NULL,
        ai_insights_enabled BOOLEAN NOT NULL,
        insight_mode TEXT NOT NULL DEFAULT 'local',
        privacy_mode TEXT NOT NULL,
        strategy_taxonomy TEXT[] NOT NULL DEFAULT '{}',
        custom_trade_types TEXT[] NOT NULL DEFAULT '{}',
        custom_setup_types TEXT[] NOT NULL DEFAULT '{}'
      )
    `);
    await sql.query("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS insight_mode TEXT NOT NULL DEFAULT 'local'");
    await sql.query("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS custom_trade_types TEXT[] NOT NULL DEFAULT '{}'");
    await sql.query("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS custom_setup_types TEXT[] NOT NULL DEFAULT '{}'");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS trades (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        symbol TEXT NOT NULL,
        asset_class TEXT NOT NULL,
        instrument_label TEXT NOT NULL,
        direction TEXT NOT NULL,
        trade_type TEXT NOT NULL,
        setup_type TEXT NOT NULL,
        status TEXT NOT NULL,
        opened_at TIMESTAMPTZ NOT NULL,
        closed_at TIMESTAMPTZ,
        thesis TEXT NOT NULL,
        reason_for_entry TEXT NOT NULL,
        reason_for_exit TEXT NOT NULL,
        pre_trade_plan TEXT NOT NULL,
        post_trade_review TEXT NOT NULL,
        capital_allocated DOUBLE PRECISION NOT NULL,
        planned_risk DOUBLE PRECISION NOT NULL,
        fees DOUBLE PRECISION NOT NULL,
        notes TEXT NOT NULL
      )
    `);
    await sql.query("CREATE INDEX IF NOT EXISTS trades_user_id_opened_at_idx ON trades (user_id, opened_at DESC)");
    await sql.query("CREATE INDEX IF NOT EXISTS trades_user_id_closed_at_idx ON trades (user_id, closed_at DESC)");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS trade_fills (
        id TEXT PRIMARY KEY,
        trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
        side TEXT NOT NULL,
        filled_at TIMESTAMPTZ NOT NULL,
        quantity DOUBLE PRECISION NOT NULL,
        price DOUBLE PRECISION NOT NULL
      )
    `);
    await sql.query("CREATE INDEX IF NOT EXISTS trade_fills_trade_id_idx ON trade_fills (trade_id, filled_at ASC)");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS trade_attachments (
        id TEXT PRIMARY KEY,
        trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        caption TEXT NOT NULL,
        uploaded_at TIMESTAMPTZ NOT NULL,
        file_name TEXT
      )
    `);
    await sql.query("CREATE INDEX IF NOT EXISTS trade_attachments_trade_id_idx ON trade_attachments (trade_id)");
    await sql.query("CREATE INDEX IF NOT EXISTS trade_attachments_file_name_idx ON trade_attachments (file_name)");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS trade_tags (
        id TEXT PRIMARY KEY,
        trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        value TEXT NOT NULL
      )
    `);
    await sql.query("CREATE INDEX IF NOT EXISTS trade_tags_trade_id_idx ON trade_tags (trade_id)");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS trade_filter_presets (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        symbol TEXT,
        setup_type TEXT,
        direction TEXT,
        result TEXT,
        duration_bucket TEXT
      )
    `);
    await sql.query("CREATE INDEX IF NOT EXISTS trade_filter_presets_user_id_idx ON trade_filter_presets (user_id)");
    await sql.query(`
      CREATE TABLE IF NOT EXISTS semantic_insight_cache (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        fingerprint TEXT NOT NULL,
        payload JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
    await sql.query(`
      CREATE TABLE IF NOT EXISTS insight_reports (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scope TEXT NOT NULL,
        scope_key TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        title TEXT NOT NULL,
        tone TEXT NOT NULL,
        summary TEXT NOT NULL,
        supporting_trade_ids TEXT[] NOT NULL DEFAULT '{}',
        bullets TEXT[] NOT NULL DEFAULT '{}'
      )
    `);
    await sql.query(
      "CREATE INDEX IF NOT EXISTS insight_reports_user_id_scope_idx ON insight_reports (user_id, scope, created_at DESC)"
    );

    const countRows = await queryRows<{ count: number }>(sql, "SELECT COUNT(*)::int AS count FROM users");
    if (Number(countRows[0]?.count ?? 0) === 0) {
      await migrateLegacyBlobStoreIfPresent();
    }
  })().catch((error) => {
    neonBootstrapPromise = null;
    throw error;
  });

  return neonBootstrapPromise;
}

export async function readNeonStore(): Promise<AppStore> {
  await ensureNeonSchema();
  const sql = getNeonSql();
  const [users, sessions, settingsRows, tradeRows, fillRows, attachmentRows, tagRows, presetRows, insightRows] =
    await Promise.all([
      queryRows<{ id: string; email: string; display_name: string; password_hash: string; created_at: string }>(
        sql,
        "SELECT id, email, display_name, password_hash, created_at FROM users ORDER BY created_at ASC"
      ),
      queryRows<{ id: string; user_id: string; created_at: string; expires_at: string }>(
        sql,
        "SELECT id, user_id, created_at, expires_at FROM sessions ORDER BY created_at ASC"
      ),
      queryRows<SettingsRow>(
        sql,
        `SELECT user_id, display_name, email, timezone, default_risk, default_capital,
                ai_insights_enabled, insight_mode, privacy_mode, strategy_taxonomy, custom_trade_types, custom_setup_types
         FROM user_settings
         ORDER BY user_id ASC`
      ),
      queryRows<TradeRow>(
        sql,
        `SELECT id, user_id, symbol, asset_class, instrument_label, direction, trade_type, setup_type,
                status, opened_at, closed_at, thesis, reason_for_entry, reason_for_exit,
                pre_trade_plan, post_trade_review, capital_allocated, planned_risk, fees, notes
         FROM trades
         ORDER BY opened_at DESC`
      ),
      queryRows<FillRow>(sql, "SELECT id, trade_id, side, filled_at, quantity, price FROM trade_fills ORDER BY filled_at ASC"),
      queryRows<AttachmentRow>(
        sql,
        "SELECT id, trade_id, kind, storage_path, caption, uploaded_at, file_name FROM trade_attachments ORDER BY uploaded_at DESC"
      ),
      queryRows<TagRow>(sql, "SELECT id, trade_id, category, value FROM trade_tags ORDER BY id ASC"),
      queryRows<PresetRow>(
        sql,
        `SELECT id, user_id, name, symbol, setup_type, direction, result, duration_bucket
         FROM trade_filter_presets
         ORDER BY name ASC`
      ),
      queryRows<InsightRow>(
        sql,
        `SELECT id, user_id, scope, scope_key, created_at, title, tone, summary,
                supporting_trade_ids, bullets
         FROM insight_reports
         ORDER BY created_at DESC`
      )
    ]);

  return {
    users: users.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      passwordHash: row.password_hash,
      createdAt: row.created_at
    })),
    sessions: sessions.map((row) => ({
      id: row.id,
      userId: row.user_id,
      createdAt: row.created_at,
      expiresAt: row.expires_at
    })),
    settings: settingsRows.map(mapSettingsRow),
    trades: buildTrades(tradeRows, fillRows, attachmentRows, tagRows),
    filterPresets: presetRows.map(mapPresetRow),
    insightReports: insightRows.map(mapInsightRow)
  };
}

export async function queryTradeRowsForUser(userId: string) {
  await ensureNeonSchema();
  const sql = getNeonSql();
  const [tradeRows, fillRows, attachmentRows, tagRows] = await Promise.all([
    queryRows<TradeRow>(
      sql,
      `SELECT id, user_id, symbol, asset_class, instrument_label, direction, trade_type, setup_type,
              status, opened_at, closed_at, thesis, reason_for_entry, reason_for_exit,
              pre_trade_plan, post_trade_review, capital_allocated, planned_risk, fees, notes
       FROM trades
       WHERE user_id = $1
       ORDER BY opened_at DESC`,
      [userId]
    ),
    queryRows<FillRow>(
      sql,
      `SELECT f.id, f.trade_id, f.side, f.filled_at, f.quantity, f.price
       FROM trade_fills f
       INNER JOIN trades t ON t.id = f.trade_id
       WHERE t.user_id = $1
       ORDER BY f.filled_at ASC`,
      [userId]
    ),
    queryRows<AttachmentRow>(
      sql,
      `SELECT a.id, a.trade_id, a.kind, a.storage_path, a.caption, a.uploaded_at, a.file_name
       FROM trade_attachments a
       INNER JOIN trades t ON t.id = a.trade_id
       WHERE t.user_id = $1
       ORDER BY a.uploaded_at DESC`,
      [userId]
    ),
    queryRows<TagRow>(
      sql,
      `SELECT g.id, g.trade_id, g.category, g.value
       FROM trade_tags g
       INNER JOIN trades t ON t.id = g.trade_id
       WHERE t.user_id = $1
       ORDER BY g.id ASC`,
      [userId]
    )
  ]);

  return buildTrades(tradeRows, fillRows, attachmentRows, tagRows);
}
