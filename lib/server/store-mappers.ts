import {
  InsightReport,
  Trade,
  TradeAttachment,
  TradeFill,
  TradeFilterPreset,
  TradeTag,
  UserSettings
} from "@/lib/domain/types";
import {
  AttachmentRow,
  FillRow,
  InsightRow,
  PresetRow,
  SettingsRow,
  TagRow,
  TradeRow
} from "@/lib/server/store-types";

export function mapTradeRow(row: TradeRow): Trade {
  return {
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    assetClass: row.asset_class,
    instrumentLabel: row.instrument_label,
    direction: row.direction,
    tradeType: row.trade_type,
    setupType: row.setup_type,
    status: row.status,
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    thesis: row.thesis,
    reasonForEntry: row.reason_for_entry,
    reasonForExit: row.reason_for_exit,
    preTradePlan: row.pre_trade_plan,
    postTradeReview: row.post_trade_review,
    capitalAllocated: Number(row.capital_allocated),
    plannedRisk: Number(row.planned_risk),
    fees: Number(row.fees),
    notes: row.notes,
    fills: [],
    attachments: [],
    tags: []
  };
}

export function mapFillRow(row: FillRow): TradeFill {
  return {
    id: row.id,
    tradeId: row.trade_id,
    side: row.side,
    filledAt: row.filled_at,
    quantity: Number(row.quantity),
    price: Number(row.price)
  };
}

export function mapAttachmentRow(row: AttachmentRow): TradeAttachment {
  return {
    id: row.id,
    tradeId: row.trade_id,
    kind: row.kind,
    storagePath: row.storage_path,
    caption: row.caption,
    uploadedAt: row.uploaded_at,
    fileName: row.file_name ?? undefined
  };
}

export function mapTagRow(row: TagRow): TradeTag {
  return {
    id: row.id,
    tradeId: row.trade_id,
    category: row.category,
    value: row.value
  };
}

export function mapSettingsRow(row: SettingsRow): UserSettings {
  return {
    userId: row.user_id,
    displayName: row.display_name,
    email: row.email,
    timezone: row.timezone,
    defaultRisk: Number(row.default_risk),
    defaultCapital: Number(row.default_capital),
    aiInsightsEnabled: row.ai_insights_enabled,
    insightMode: row.insight_mode ?? "local",
    privacyMode: row.privacy_mode,
    strategyTaxonomy: row.strategy_taxonomy ?? [],
    customTradeTypes: row.custom_trade_types ?? [],
    customSetupTypes: row.custom_setup_types ?? []
  };
}

export function mapPresetRow(row: PresetRow): TradeFilterPreset {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    symbol: row.symbol ?? undefined,
    setupType: row.setup_type ?? undefined,
    direction: row.direction ?? undefined,
    result: row.result ?? undefined,
    durationBucket: row.duration_bucket ?? undefined
  };
}

export function mapInsightRow(row: InsightRow): InsightReport {
  return {
    id: row.id,
    userId: row.user_id,
    scope: row.scope,
    scopeKey: row.scope_key,
    createdAt: row.created_at,
    title: row.title,
    tone: row.tone,
    summary: row.summary,
    supportingTradeIds: row.supporting_trade_ids ?? [],
    bullets: row.bullets ?? []
  };
}

export function buildTrades(
  tradeRows: TradeRow[],
  fillRows: FillRow[],
  attachmentRows: AttachmentRow[],
  tagRows: TagRow[]
) {
  const fillsByTrade = new Map<string, TradeFill[]>();
  const attachmentsByTrade = new Map<string, TradeAttachment[]>();
  const tagsByTrade = new Map<string, TradeTag[]>();

  for (const row of fillRows) {
    const fills = fillsByTrade.get(row.trade_id) ?? [];
    fills.push(mapFillRow(row));
    fillsByTrade.set(row.trade_id, fills);
  }

  for (const row of attachmentRows) {
    const attachments = attachmentsByTrade.get(row.trade_id) ?? [];
    attachments.push(mapAttachmentRow(row));
    attachmentsByTrade.set(row.trade_id, attachments);
  }

  for (const row of tagRows) {
    const tags = tagsByTrade.get(row.trade_id) ?? [];
    tags.push(mapTagRow(row));
    tagsByTrade.set(row.trade_id, tags);
  }

  return tradeRows.map((row) => ({
    ...mapTradeRow(row),
    fills: (fillsByTrade.get(row.id) ?? []).sort(
      (left, right) => new Date(left.filledAt).getTime() - new Date(right.filledAt).getTime()
    ),
    attachments: (attachmentsByTrade.get(row.id) ?? []).sort(
      (left, right) => new Date(right.uploadedAt).getTime() - new Date(left.uploadedAt).getTime()
    ),
    tags: tagsByTrade.get(row.id) ?? []
  }));
}
