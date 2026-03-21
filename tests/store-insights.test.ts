import { describe, expect, it } from "vitest";
import { buildInsightReportsForState } from "@/lib/server/store-insights";
import { Trade, UserSettings } from "@/lib/domain/types";

function makeTrade(id: string, closedAt: string): Trade {
  return {
    id,
    userId: "user_demo",
    symbol: `SYM${id.slice(-1)}`,
    assetClass: "stock",
    instrumentLabel: `Symbol ${id}`,
    direction: "long",
    tradeType: "Reversal",
    setupType: "Demand reversal",
    status: "closed",
    openedAt: closedAt,
    closedAt,
    thesis: "Repeated review evidence for testing.",
    reasonForEntry: "Entry reason with enough structure.",
    reasonForExit: "Exit reason with enough structure.",
    preTradePlan: "Plan before the trade.",
    postTradeReview: "Review after the trade.",
    capitalAllocated: 1000,
    plannedRisk: 100,
    fees: 0,
    notes: "Testing historical period insight persistence.",
    fills: [
      {
        id: `${id}_entry`,
        tradeId: id,
        side: "entry",
        filledAt: closedAt,
        quantity: 10,
        price: 100
      },
      {
        id: `${id}_exit`,
        tradeId: id,
        side: "exit",
        filledAt: new Date(new Date(closedAt).getTime() + 30 * 60 * 1000).toISOString(),
        quantity: 10,
        price: 103
      }
    ],
    attachments: [],
    tags: [{ id: `${id}_tag`, tradeId: id, category: "lesson", value: "Wait for confirmation" }]
  };
}

const settings: UserSettings = {
  userId: "user_demo",
  displayName: "Demo",
  email: "demo@example.com",
  timezone: "America/New_York",
  defaultRisk: 100,
  defaultCapital: 1000,
  aiInsightsEnabled: true,
  insightMode: "local",
  privacyMode: "private-cloud",
  strategyTaxonomy: ["ORB"],
  customTradeTypes: [],
  customSetupTypes: []
};

describe("buildInsightReportsForState", () => {
  it("keeps historical weekly and monthly reports instead of only the latest period", () => {
    const reports = buildInsightReportsForState(
      [
        makeTrade("trade_1", "2026-03-03T14:00:00-05:00"),
        makeTrade("trade_2", "2026-03-10T14:00:00-05:00"),
        makeTrade("trade_3", "2026-04-02T14:00:00-04:00")
      ],
      settings
    );

    expect(reports.filter((report) => report.scope === "trade")).toHaveLength(3);
    expect(reports.filter((report) => report.scope === "week")).toHaveLength(3);
    expect(reports.filter((report) => report.scope === "month")).toHaveLength(2);
    expect(reports.filter((report) => report.scope === "month").map((report) => report.scopeKey)).toEqual(
      expect.arrayContaining(["2026-03", "2026-04"])
    );
  });
});
