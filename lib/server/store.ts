import { buildRecurringThemes, regenerateSemanticInsightsSnapshot } from "@/lib/server/semantic-insights";
import { getStoreBackend, readStore, writeStore } from "@/lib/server/store-core";
import { refreshInsights, withStoreWriteLock } from "@/lib/server/store-file";
import { buildInsightReportsForState, buildInsightReportQueries } from "@/lib/server/store-insights";
import { ensureNeonSchema, getNeonSql, queryTradeRowsForUser } from "@/lib/server/store-neon";
import { getInsightReports, getSettings, getStoreSummary, saveFilterPresets, saveSettings } from "@/lib/server/store-settings";

export { readStore } from "@/lib/server/store-core";
export {
  createSession,
  createUser,
  deleteSession,
  getSession,
  getUserByEmail,
  getUserById
} from "@/lib/server/store-accounts";
export { getAttachmentForUser, getTrade, saveTrade, deleteTrade, deleteAttachment } from "@/lib/server/store-trades";
export { getInsightReports, getSettings, getStoreSummary, saveFilterPresets, saveSettings } from "@/lib/server/store-settings";

async function refreshNeonInsightsForUser(userId: string) {
  await ensureNeonSchema();
  const sql = getNeonSql();
  const settings = await getSettings(userId);
  const trades = await queryTradeRowsForUser(userId);
  const insightReports = buildInsightReportsForState(trades, settings);
  await sql.transaction((txn) => buildInsightReportQueries(txn, userId, insightReports));
  await regenerateSemanticInsightsSnapshot({
    userId,
    trades,
    settings,
    weeklyReports: insightReports.filter((report) => report.scope === "week"),
    monthlyReports: insightReports.filter((report) => report.scope === "month"),
    recurringThemes: buildRecurringThemes(trades)
  });
}

export async function regenerateInsights(userId: string) {
  return withStoreWriteLock(async () => {
    if (getStoreBackend() === "neon") {
      await refreshNeonInsightsForUser(userId);
      return getInsightReports(userId);
    }

    const store = await readStore();
    const nextStore = refreshInsights(store);
    await writeStore(nextStore);
    const settings = nextStore.settings.find((item) => item.userId === userId);
    if (settings) {
      const trades = nextStore.trades.filter((trade) => trade.userId === userId);
      const insightReports = nextStore.insightReports.filter((report) => report.userId === userId);
      await regenerateSemanticInsightsSnapshot({
        userId,
        trades,
        settings,
        weeklyReports: insightReports.filter((report) => report.scope === "week"),
        monthlyReports: insightReports.filter((report) => report.scope === "month"),
        recurringThemes: buildRecurringThemes(trades)
      });
    }
    return nextStore.insightReports.filter((report) => report.userId === userId);
  });
}

export function getStoreRuntimeMode() {
  return getStoreBackend();
}
