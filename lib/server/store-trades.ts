import { Trade } from "@/lib/domain/types";
import { buildRecurringThemes, deleteSemanticInsightsSnapshot } from "@/lib/server/semantic-insights";
import { deleteUpload } from "@/lib/server/uploads";
import { getStoreBackend, readStore, writeStore } from "@/lib/server/store-core";
import {
  getRemovedAttachmentFileNames,
  refreshInsights,
  withStoreWriteLock,
} from "@/lib/server/store-file";
import { buildInsightReportsForState, buildInsightReportQueries } from "@/lib/server/store-insights";
import { mapAttachmentRow } from "@/lib/server/store-mappers";
import { AttachmentRow } from "@/lib/server/store-types";
import {
  ensureNeonSchema,
  getNeonSql,
  queryRows,
  queryTradeRowsForUser,
} from "@/lib/server/store-neon";
import { getSettings } from "@/lib/server/store-settings";

export async function getTrade(tradeId: string, userId: string) {
  if (getStoreBackend() === "neon") {
    const trades = await queryTradeRowsForUser(userId);
    return trades.find((trade) => trade.id === tradeId) ?? null;
  }

  const store = await readStore();
  return store.trades.find((trade) => trade.id === tradeId && trade.userId === userId) ?? null;
}

export async function saveTrade(trade: Trade) {
  return withStoreWriteLock(async () => {
    if (getStoreBackend() === "neon") {
      await ensureNeonSchema();
      const sql = getNeonSql();
      const settings = await getSettings(trade.userId);
      const existingTrades = await queryTradeRowsForUser(trade.userId);
      const previousTrade = existingTrades.find((item) => item.id === trade.id) ?? null;
      const nextTrades = existingTrades.some((item) => item.id === trade.id)
        ? existingTrades.map((item) => (item.id === trade.id ? trade : item))
        : [trade, ...existingTrades];
      const insightReports = buildInsightReportsForState(nextTrades, settings);

      await sql.transaction((txn) => [
        txn.query(
          `INSERT INTO trades (
            id,
            user_id,
            symbol,
            asset_class,
            instrument_label,
            direction,
            trade_type,
            setup_type,
            status,
            opened_at,
            closed_at,
            thesis,
            reason_for_entry,
            reason_for_exit,
            pre_trade_plan,
            post_trade_review,
            capital_allocated,
            planned_risk,
            fees,
            notes
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
        ),
        txn.query("DELETE FROM trade_fills WHERE trade_id = $1", [trade.id]),
        txn.query("DELETE FROM trade_attachments WHERE trade_id = $1", [trade.id]),
        txn.query("DELETE FROM trade_tags WHERE trade_id = $1", [trade.id]),
        ...trade.fills.map((fill) =>
          txn.query(
            `INSERT INTO trade_fills (id, trade_id, side, filled_at, quantity, price)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [fill.id, trade.id, fill.side, fill.filledAt, fill.quantity, fill.price]
          )
        ),
        ...trade.attachments.map((attachment) =>
          txn.query(
            `INSERT INTO trade_attachments (
              id,
              trade_id,
              kind,
              storage_path,
              caption,
              uploaded_at,
              file_name
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              attachment.id,
              trade.id,
              attachment.kind,
              attachment.storagePath,
              attachment.caption,
              attachment.uploadedAt,
              attachment.fileName ?? null
            ]
          )
        ),
        ...trade.tags.map((tag) =>
          txn.query(
            "INSERT INTO trade_tags (id, trade_id, category, value) VALUES ($1, $2, $3, $4)",
            [tag.id, trade.id, tag.category, tag.value]
          )
        ),
        ...buildInsightReportQueries(txn, trade.userId, insightReports)
      ]);
      await Promise.all(
        getRemovedAttachmentFileNames(previousTrade?.attachments ?? [], trade.attachments).map((fileName) =>
          deleteUpload(fileName)
        )
      );
      await deleteSemanticInsightsSnapshot(trade.userId);
      return trade;
    }

    const store = await readStore();
    const previousTrade = store.trades.find((item) => item.id === trade.id && item.userId === trade.userId) ?? null;
    const nextTrades = store.trades.some((item) => item.id === trade.id)
      ? store.trades.map((item) => (item.id === trade.id ? trade : item))
      : [trade, ...store.trades];
    const nextStore = refreshInsights({
      ...store,
      trades: nextTrades
    });
    await writeStore(nextStore);
    await Promise.all(
      getRemovedAttachmentFileNames(previousTrade?.attachments ?? [], trade.attachments).map((fileName) =>
        deleteUpload(fileName)
      )
    );
    await deleteSemanticInsightsSnapshot(trade.userId);
    return trade;
  });
}

export async function deleteTrade(tradeId: string, userId: string) {
  return withStoreWriteLock(async () => {
    if (getStoreBackend() === "neon") {
      await ensureNeonSchema();
      const sql = getNeonSql();
      const existingTrades = await queryTradeRowsForUser(userId);
      const tradeToDelete = existingTrades.find((trade) => trade.id === tradeId) ?? null;
      const settings = await getSettings(userId);
      const nextTrades = existingTrades.filter((trade) => trade.id !== tradeId);
      const insightReports = buildInsightReportsForState(nextTrades, settings);
      await sql.transaction((txn) => [
        txn.query("DELETE FROM trades WHERE id = $1 AND user_id = $2", [tradeId, userId]),
        ...buildInsightReportQueries(txn, userId, insightReports)
      ]);
      await Promise.all(
        (tradeToDelete?.attachments ?? [])
          .map((attachment) => attachment.fileName)
          .filter((fileName): fileName is string => Boolean(fileName))
          .map((fileName) => deleteUpload(fileName))
      );
      await deleteSemanticInsightsSnapshot(userId);
      return;
    }

    const store = await readStore();
    const tradeToDelete = store.trades.find((trade) => trade.id === tradeId && trade.userId === userId) ?? null;
    const nextStore = refreshInsights({
      ...store,
      trades: store.trades.filter((trade) => !(trade.id === tradeId && trade.userId === userId))
    });
    await writeStore(nextStore);
    await Promise.all(
      (tradeToDelete?.attachments ?? [])
        .map((attachment) => attachment.fileName)
        .filter((fileName): fileName is string => Boolean(fileName))
        .map((fileName) => deleteUpload(fileName))
    );
    await deleteSemanticInsightsSnapshot(userId);
  });
}

export async function deleteAttachment(tradeId: string, attachmentId: string, userId: string) {
  await withStoreWriteLock(async () => {
    if (getStoreBackend() === "neon") {
      await ensureNeonSchema();
      const sql = getNeonSql();
      const settings = await getSettings(userId);
      const existingTrades = await queryTradeRowsForUser(userId);
      const rows = await queryRows<AttachmentRow>(
        sql,
        `SELECT a.id, a.trade_id, a.kind, a.storage_path, a.caption, a.uploaded_at, a.file_name
         FROM trade_attachments a
         INNER JOIN trades t ON t.id = a.trade_id
         WHERE a.id = $1
           AND a.trade_id = $2
           AND t.user_id = $3
         LIMIT 1`,
        [attachmentId, tradeId, userId]
      );
      const attachment = rows[0] ? mapAttachmentRow(rows[0]) : null;
      const nextTrades = existingTrades.map((trade) =>
        trade.id === tradeId
          ? {
              ...trade,
              attachments: trade.attachments.filter((currentAttachment) => currentAttachment.id !== attachmentId)
            }
          : trade
      );
      const insightReports = buildInsightReportsForState(nextTrades, settings);
      await sql.transaction((txn) => [
        txn.query(
          `DELETE FROM trade_attachments
           WHERE id = $1
             AND trade_id = $2
             AND EXISTS (
               SELECT 1
               FROM trades
               WHERE trades.id = $2
                 AND trades.user_id = $3
             )`,
          [attachmentId, tradeId, userId]
        ),
        ...buildInsightReportQueries(txn, userId, insightReports)
      ]);
      if (attachment?.fileName) {
        await deleteUpload(attachment.fileName);
      }
      await deleteSemanticInsightsSnapshot(userId);
      return;
    }

    const store = await readStore();
    const trade = store.trades.find((item) => item.id === tradeId && item.userId === userId);
    if (!trade) {
      return;
    }

    const attachment = trade.attachments.find((item) => item.id === attachmentId);
    trade.attachments = trade.attachments.filter((currentAttachment) => currentAttachment.id !== attachmentId);
    await writeStore(refreshInsights(store));
    if (attachment?.fileName) {
      await deleteUpload(attachment.fileName);
    }
    await deleteSemanticInsightsSnapshot(userId);
  });
}

export async function getAttachmentForUser(fileName: string, userId: string) {
  if (getStoreBackend() === "neon") {
    await ensureNeonSchema();
    const sql = getNeonSql();
    const rows = await queryRows<AttachmentRow>(
      sql,
      `SELECT a.id, a.trade_id, a.kind, a.storage_path, a.caption, a.uploaded_at, a.file_name
       FROM trade_attachments a
       INNER JOIN trades t ON t.id = a.trade_id
       WHERE a.file_name = $1
         AND t.user_id = $2
       LIMIT 1`,
      [fileName, userId]
    );

    return rows[0] ? mapAttachmentRow(rows[0]) : null;
  }

  const store = await readStore();

  for (const trade of store.trades) {
    if (trade.userId !== userId) {
      continue;
    }

    const attachment = trade.attachments.find((item) => item.fileName === fileName);
    if (attachment) {
      return attachment;
    }
  }

  return null;
}
