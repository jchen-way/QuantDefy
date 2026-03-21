import { TradeFilterPreset, UserSettings } from "@/lib/domain/types";
import { getStoreBackend, readStore, writeStore } from "@/lib/server/store-core";
import { refreshInsights, withStoreWriteLock } from "@/lib/server/store-file";
import { buildInsightReportsForState, buildInsightReportQueries } from "@/lib/server/store-insights";
import {
  mapInsightRow,
  mapPresetRow,
  mapSettingsRow
} from "@/lib/server/store-mappers";
import {
  ensureNeonSchema,
  getNeonSql,
  isUniqueViolation,
  queryRows,
  queryTradeRowsForUser
} from "@/lib/server/store-neon";
import {
  InsightRow,
  PresetRow,
  SettingsRow
} from "@/lib/server/store-types";

export async function getInsightReports(userId: string) {
  if (getStoreBackend() === "neon") {
    await ensureNeonSchema();
    const sql = getNeonSql();
    const rows = await queryRows<InsightRow>(
      sql,
      `SELECT id, user_id, scope, scope_key, created_at, title, tone, summary,
              supporting_trade_ids, bullets
       FROM insight_reports
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map(mapInsightRow);
  }

  const store = await readStore();
  return store.insightReports.filter((report) => report.userId === userId);
}

export async function getSettings(userId: string): Promise<UserSettings> {
  if (getStoreBackend() === "neon") {
    await ensureNeonSchema();
    const sql = getNeonSql();
    const rows = await queryRows<SettingsRow>(
      sql,
      `SELECT user_id, display_name, email, timezone, default_risk, default_capital,
              ai_insights_enabled, insight_mode, privacy_mode, strategy_taxonomy, custom_trade_types, custom_setup_types
       FROM user_settings
       WHERE user_id = $1
       LIMIT 1`,
      [userId]
    );
    const row = rows[0];

    if (!row) {
      throw new Error("User settings not found.");
    }

    return mapSettingsRow(row);
  }

  const store = await readStore();
  const settings = store.settings.find((item) => item.userId === userId);

  if (!settings) {
    throw new Error("User settings not found.");
  }

  return settings;
}

export async function saveSettings(settings: UserSettings) {
  return withStoreWriteLock(async () => {
    if (getStoreBackend() === "neon") {
      await ensureNeonSchema();
      const sql = getNeonSql();
      const trades = await queryTradeRowsForUser(settings.userId);
      const insightReports = buildInsightReportsForState(trades, settings);
      try {
        await sql.transaction((txn) => [
          txn.query(
            `UPDATE users
             SET email = $2, display_name = $3
             WHERE id = $1`,
            [settings.userId, settings.email.trim().toLowerCase(), settings.displayName.trim()]
          ),
          txn.query(
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
              settings.displayName.trim(),
              settings.email.trim().toLowerCase(),
              settings.timezone.trim(),
              settings.defaultRisk,
              settings.defaultCapital,
              settings.aiInsightsEnabled,
              settings.insightMode,
              settings.privacyMode,
              settings.strategyTaxonomy,
              settings.customTradeTypes,
              settings.customSetupTypes
            ]
          ),
          ...buildInsightReportQueries(txn, settings.userId, insightReports)
        ]);
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new Error("An account with this email already exists.");
        }
        throw error;
      }
      return settings;
    }

    const store = await readStore();
    const nextStore = refreshInsights({
      ...store,
      users: store.users.map((user) =>
        user.id === settings.userId
          ? {
              ...user,
              email: settings.email,
              displayName: settings.displayName
            }
          : user
      ),
      settings: store.settings.some((item) => item.userId === settings.userId)
        ? store.settings.map((item) => (item.userId === settings.userId ? settings : item))
        : [...store.settings, settings]
    });
    await writeStore(nextStore);
    return settings;
  });
}

export async function getStoreSummary(userId: string) {
  if (getStoreBackend() === "neon") {
    const [settings, trades, insightReports, presetRows] = await Promise.all([
      getSettings(userId),
      queryTradeRowsForUser(userId),
      getInsightReports(userId),
      (async () => {
        await ensureNeonSchema();
        const sql = getNeonSql();
        const rows = await queryRows<PresetRow>(
          sql,
        `SELECT id, user_id, name, symbol, setup_type, direction, result, duration_bucket
           FROM trade_filter_presets
           WHERE user_id = $1
           ORDER BY name ASC`,
          [userId]
        );
        return rows.map(mapPresetRow);
      })()
    ]);

    return {
      trades,
      insightReports,
      filterPresets: presetRows,
      settings
    };
  }

  const store = await readStore();
  const settings = store.settings.find((item) => item.userId === userId);

  if (!settings) {
    throw new Error("User settings not found.");
  }

  return {
    trades: store.trades.filter((trade) => trade.userId === userId),
    insightReports: store.insightReports.filter((report) => report.userId === userId),
    filterPresets: store.filterPresets.filter((preset) => preset.userId === userId),
    settings
  };
}

export async function saveFilterPresets(userId: string, presets: TradeFilterPreset[]) {
  return withStoreWriteLock(async () => {
    if (getStoreBackend() === "neon") {
      await ensureNeonSchema();
      const sql = getNeonSql();
      await sql.transaction((txn) => [
        txn.query("DELETE FROM trade_filter_presets WHERE user_id = $1", [userId]),
        ...presets.map((preset) =>
          txn.query(
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
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              preset.id,
              userId,
              preset.name,
              preset.symbol ?? null,
              preset.setupType ?? null,
              preset.direction ?? null,
              preset.result ?? null,
              preset.durationBucket ?? null
            ]
          )
        )
      ]);

      return presets;
    }

    const store = await readStore();
    const nextStore = {
      ...store,
      filterPresets: [
        ...store.filterPresets.filter((preset) => preset.userId !== userId),
        ...presets.map((preset) => ({ ...preset, userId }))
      ]
    };
    await writeStore(nextStore);
    return presets;
  });
}
