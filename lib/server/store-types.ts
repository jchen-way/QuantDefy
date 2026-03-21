import {
  InsightReport,
  Trade,
  TradeAttachment,
  TradeFilterPreset,
  TradeFill,
  TradeTag,
  UserSettings
} from "@/lib/domain/types";

export type StoreBackend = "file" | "neon";

export type TradeRow = {
  id: string;
  user_id: string;
  symbol: string;
  asset_class: Trade["assetClass"];
  instrument_label: string;
  direction: Trade["direction"];
  trade_type: Trade["tradeType"];
  setup_type: Trade["setupType"];
  status: Trade["status"];
  opened_at: string;
  closed_at: string | null;
  thesis: string;
  reason_for_entry: string;
  reason_for_exit: string;
  pre_trade_plan: string;
  post_trade_review: string;
  capital_allocated: number;
  planned_risk: number;
  fees: number;
  notes: string;
};

export type FillRow = {
  id: string;
  trade_id: string;
  side: TradeFill["side"];
  filled_at: string;
  quantity: number;
  price: number;
};

export type AttachmentRow = {
  id: string;
  trade_id: string;
  kind: TradeAttachment["kind"];
  storage_path: string;
  caption: string;
  uploaded_at: string;
  file_name: string | null;
};

export type TagRow = {
  id: string;
  trade_id: string;
  category: TradeTag["category"];
  value: string;
};

export type PresetRow = {
  id: string;
  user_id: string;
  name: string;
  symbol: string | null;
  setup_type: TradeFilterPreset["setupType"] | null;
  direction: TradeFilterPreset["direction"] | null;
  result: TradeFilterPreset["result"] | null;
  duration_bucket: TradeFilterPreset["durationBucket"] | null;
};

export type SettingsRow = {
  user_id: string;
  display_name: string;
  email: string;
  timezone: string;
  default_risk: number;
  default_capital: number;
  ai_insights_enabled: boolean;
  insight_mode: UserSettings["insightMode"];
  privacy_mode: UserSettings["privacyMode"];
  strategy_taxonomy: string[] | null;
  custom_trade_types: string[] | null;
  custom_setup_types: string[] | null;
};

export type InsightRow = {
  id: string;
  user_id: string;
  scope: InsightReport["scope"];
  scope_key: string;
  created_at: string;
  title: string;
  tone: InsightReport["tone"];
  summary: string;
  supporting_trade_ids: string[] | null;
  bullets: string[] | null;
};
