export type AssetClass = "stock" | "option";

export type TradeDirection = "long" | "short";

export type TradeStatus = "open" | "closed";

export type TradeType = string;

export type SetupType = string;

export type AttachmentKind =
  | "setup"
  | "entry"
  | "exit"
  | "winner"
  | "loser"
  | "postmortem";

export type TagCategory = "setup" | "mistake" | "emotion" | "lesson";

export type FillSide = "entry" | "exit";

export type TradeResult = "win" | "loss" | "scratch" | "open";

export type DurationBucket =
  | "scalp"
  | "intraday"
  | "session"
  | "swing"
  | "position"
  | "open";

export type InsightScope = "trade" | "week" | "month";

export type InsightTone = "constructive" | "warning" | "reinforcement";

export type InsightMode = "local" | "semantic";

export type TradeFill = {
  id: string;
  tradeId: string;
  side: FillSide;
  filledAt: string;
  quantity: number;
  price: number;
};

export type TradeAttachment = {
  id: string;
  tradeId: string;
  kind: AttachmentKind;
  storagePath: string;
  caption: string;
  uploadedAt: string;
  fileName?: string;
};

export type TradeTag = {
  id: string;
  tradeId: string;
  category: TagCategory;
  value: string;
};

export type Trade = {
  id: string;
  userId: string;
  symbol: string;
  assetClass: AssetClass;
  instrumentLabel: string;
  direction: TradeDirection;
  tradeType: TradeType;
  setupType: SetupType;
  status: TradeStatus;
  openedAt: string;
  closedAt: string | null;
  thesis: string;
  reasonForEntry: string;
  reasonForExit: string;
  preTradePlan: string;
  postTradeReview: string;
  capitalAllocated: number;
  plannedRisk: number;
  fees: number;
  notes: string;
  fills: TradeFill[];
  attachments: TradeAttachment[];
  tags: TradeTag[];
};

export type TradeMetrics = {
  tradeId: string;
  status: TradeStatus;
  result: TradeResult;
  grossPl: number;
  realizedPl: number;
  avgEntryPrice: number;
  avgExitPrice: number;
  totalEntryQuantity: number;
  totalExitQuantity: number;
  holdingMinutes: number | null;
  durationBucket: DurationBucket;
  rMultiple: number | null;
  returnOnCapitalPct: number | null;
  maxCapitalUsed: number;
  closedDate: string | null;
  weekday: string | null;
};

export type InsightReport = {
  id: string;
  userId: string;
  scope: InsightScope;
  scopeKey: string;
  createdAt: string;
  title: string;
  tone: InsightTone;
  summary: string;
  supportingTradeIds: string[];
  bullets: string[];
};

export type TradeFilterPreset = {
  id: string;
  userId: string;
  name: string;
  symbol?: string;
  setupType?: SetupType | "all";
  direction?: TradeDirection | "all";
  result?: TradeResult | "all";
  durationBucket?: DurationBucket | "all";
};

export type UserAccount = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
};

export type UserSession = {
  id: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
};

export type UserSettings = {
  userId: string;
  displayName: string;
  email: string;
  timezone: string;
  defaultRisk: number;
  defaultCapital: number;
  aiInsightsEnabled: boolean;
  insightMode: InsightMode;
  privacyMode: "private-cloud";
  strategyTaxonomy: string[];
  customTradeTypes: string[];
  customSetupTypes: string[];
};

export type AppStore = {
  users: UserAccount[];
  sessions: UserSession[];
  trades: Trade[];
  insightReports: InsightReport[];
  filterPresets: TradeFilterPreset[];
  settings: UserSettings[];
};

export type SemanticRefreshUsageEntry = {
  userId: string;
  refreshedAt: string;
};

export type DashboardKpis = {
  realizedMonthToDate: number;
  realizedWeekToDate: number;
  winRate: number;
  expectancy: number;
  avgWinner: number;
  avgLoser: number;
  openRisk: number;
};

export type CalendarDay = {
  isoDate: string;
  label: number;
  inMonth: boolean;
  realizedPl: number;
  cumulativePl: number;
  tradeIds: string[];
};

export type EquityPoint = {
  date: string;
  value: number;
};

export type DistributionDatum = {
  label: string;
  value: number;
  realizedPl: number;
};

export type DashboardData = {
  monthKey: string;
  monthLabel: string;
  previousMonthKey: string;
  nextMonthKey: string;
  kpis: DashboardKpis;
  calendarDays: CalendarDay[];
  selectedDay: string | null;
  selectedTrades: Array<Trade & { metrics: TradeMetrics; insight?: InsightReport }>;
  openTrades: Array<Trade & { metrics: TradeMetrics }>;
  equityCurve: EquityPoint[];
  weeklyCurve: EquityPoint[];
  tradeTypeDistribution: DistributionDatum[];
  durationDistribution: DistributionDatum[];
  capitalDistribution: DistributionDatum[];
  topMistakes: DistributionDatum[];
  weeklyInsight: InsightReport | null;
};

export type AnalyticsSnapshot = {
  trades: Array<Trade & { metrics: TradeMetrics; insight?: InsightReport }>;
  equityCurve: EquityPoint[];
  distributions: {
    tradeType: DistributionDatum[];
    capital: DistributionDatum[];
    duration: DistributionDatum[];
    weekday: DistributionDatum[];
    setup: DistributionDatum[];
    mistakes: DistributionDatum[];
  };
  kpis: DashboardKpis;
};
