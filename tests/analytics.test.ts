import { describe, expect, it } from "vitest";
import { buildDashboardData, computeTradeMetrics } from "@/lib/domain/analytics";
import {
  deriveCapitalAllocatedFromFills,
  formatCapitalBucket,
  formatDuration,
  getDateKeyInTimeZone,
  getWeekKeyInTimeZone,
  formatShortDate,
  parseDateTimeInTimeZone,
  toInputDateTimeInTimeZone
} from "@/lib/domain/utils";
import { buildTradeInsight, buildWeeklyInsight } from "@/lib/domain/insights";
import { Trade } from "@/lib/domain/types";

function makeTrade(overrides: Partial<Trade>): Trade {
  const base: Trade = {
    id: "trade_test",
    userId: "user_demo",
    symbol: "TEST",
    assetClass: "stock",
    instrumentLabel: "Test Inc",
    direction: "long",
    tradeType: "breakout",
    setupType: "orb",
    status: "closed",
    openedAt: "2026-03-18T09:30:00-04:00",
    closedAt: "2026-03-18T10:00:00-04:00",
    thesis: "Test thesis for the setup.",
    reasonForEntry: "Structured entry.",
    reasonForExit: "Structured exit.",
    preTradePlan: "Defined risk.",
    postTradeReview: "Review.",
    capitalAllocated: 2000,
    plannedRisk: 200,
    fees: 10,
    notes: "",
    fills: [
      {
        id: "fill_entry",
        tradeId: "trade_test",
        side: "entry",
        filledAt: "2026-03-18T09:30:00-04:00",
        quantity: 10,
        price: 100
      },
      {
        id: "fill_exit",
        tradeId: "trade_test",
        side: "exit",
        filledAt: "2026-03-18T10:00:00-04:00",
        quantity: 10,
        price: 104
      }
    ],
    attachments: [],
    tags: []
  };

  return {
    ...base,
    ...overrides,
    fills: overrides.fills ?? base.fills,
    attachments: overrides.attachments ?? base.attachments,
    tags: overrides.tags ?? base.tags
  };
}

describe("computeTradeMetrics", () => {
  it("handles scaled long entries and exits", () => {
    const trade = makeTrade({
      id: "scale_long",
      fills: [
        {
          id: "entry_1",
          tradeId: "scale_long",
          side: "entry",
          filledAt: "2026-03-18T09:30:00-04:00",
          quantity: 5,
          price: 100
        },
        {
          id: "entry_2",
          tradeId: "scale_long",
          side: "entry",
          filledAt: "2026-03-18T09:35:00-04:00",
          quantity: 5,
          price: 102
        },
        {
          id: "exit_1",
          tradeId: "scale_long",
          side: "exit",
          filledAt: "2026-03-18T09:50:00-04:00",
          quantity: 4,
          price: 105
        },
        {
          id: "exit_2",
          tradeId: "scale_long",
          side: "exit",
          filledAt: "2026-03-18T10:00:00-04:00",
          quantity: 6,
          price: 107
        }
      ]
    });

    const metrics = computeTradeMetrics(trade);

    expect(metrics.avgEntryPrice).toBe(101);
    expect(metrics.avgExitPrice).toBe(106.2);
    expect(metrics.grossPl).toBe(52);
    expect(metrics.realizedPl).toBe(52);
    expect(metrics.rMultiple).toBe(0.26);
  });

  it("handles short trades correctly", () => {
    const trade = makeTrade({
      id: "short_trade",
      direction: "short",
      fills: [
        {
          id: "short_entry",
          tradeId: "short_trade",
          side: "entry",
          filledAt: "2026-03-18T09:30:00-04:00",
          quantity: 10,
          price: 50
        },
        {
          id: "short_exit",
          tradeId: "short_trade",
          side: "exit",
          filledAt: "2026-03-18T10:00:00-04:00",
          quantity: 10,
          price: 45
        }
      ]
    });

    const metrics = computeTradeMetrics(trade);

    expect(metrics.grossPl).toBe(50);
    expect(metrics.realizedPl).toBe(50);
    expect(metrics.result).toBe("win");
  });

  it("applies the option contract multiplier to realized P/L and capital usage", () => {
    const trade = makeTrade({
      id: "option_trade",
      assetClass: "option",
      capitalAllocated: 569,
      fills: [
        {
          id: "option_entry",
          tradeId: "option_trade",
          side: "entry",
          filledAt: "2026-03-18T09:30:00-04:00",
          quantity: 1,
          price: 5.69
        },
        {
          id: "option_exit",
          tradeId: "option_trade",
          side: "exit",
          filledAt: "2026-03-18T10:00:00-04:00",
          quantity: 1,
          price: 5.64
        }
      ],
      fees: 0
    });

    const metrics = computeTradeMetrics(trade);

    expect(metrics.grossPl).toBe(-5);
    expect(metrics.realizedPl).toBe(-5);
    expect(metrics.maxCapitalUsed).toBe(569);
  });

  it("treats short single-option trades as bearish direction, not short premium exposure", () => {
    const trade = makeTrade({
      id: "short_option_direction",
      assetClass: "option",
      direction: "short",
      capitalAllocated: 620,
      fills: [
        {
          id: "short_option_entry",
          tradeId: "short_option_direction",
          side: "entry",
          filledAt: "2026-03-19T12:05:00-04:00",
          quantity: 2,
          price: 3.1
        },
        {
          id: "short_option_exit",
          tradeId: "short_option_direction",
          side: "exit",
          filledAt: "2026-03-19T14:13:00-04:00",
          quantity: 2,
          price: 3.6
        }
      ]
    });

    const metrics = computeTradeMetrics(trade);

    expect(metrics.grossPl).toBe(100);
    expect(metrics.realizedPl).toBe(100);
    expect(metrics.returnOnCapitalPct).toBe(16.13);
  });

  it("keeps open trades out of realized calendar rollups", () => {
    const closedTrade = makeTrade({ id: "closed_trade" });
    const openTrade = makeTrade({
      id: "open_trade",
      status: "open",
      closedAt: null,
      fills: [
        {
          id: "entry_only",
          tradeId: "open_trade",
          side: "entry",
          filledAt: "2026-03-19T09:30:00-04:00",
          quantity: 10,
          price: 100
        }
      ]
    });

    const closedInsight = buildTradeInsight(closedTrade, computeTradeMetrics(closedTrade));
    const dashboard = buildDashboardData(
      [closedTrade, openTrade],
      [closedInsight],
      "America/New_York",
      "2026-03-18",
      undefined,
      new Date("2026-03-20T12:00:00-04:00")
    );
    const realizedDay = dashboard.calendarDays.find((day) => day.isoDate === "2026-03-18");
    const openDay = dashboard.calendarDays.find((day) => day.isoDate === "2026-03-19");

    expect(realizedDay?.tradeIds).toContain("closed_trade");
    expect(openDay?.tradeIds).toHaveLength(0);
  });

  it("derives date and week keys in the provided timezone", () => {
    const lateTrade = makeTrade({
      id: "late_trade",
      openedAt: "2026-03-20T03:30:00.000Z",
      closedAt: "2026-03-20T03:45:00.000Z",
      fills: [
        {
          id: "late_entry",
          tradeId: "late_trade",
          side: "entry",
          filledAt: "2026-03-20T03:30:00.000Z",
          quantity: 10,
          price: 100
        },
        {
          id: "late_exit",
          tradeId: "late_trade",
          side: "exit",
          filledAt: "2026-03-20T03:45:00.000Z",
          quantity: 10,
          price: 101
        }
      ]
    });

    const metrics = computeTradeMetrics(lateTrade, "America/New_York");

    expect(getDateKeyInTimeZone(lateTrade.closedAt!, "America/New_York")).toBe("2026-03-19");
    expect(getWeekKeyInTimeZone(lateTrade.closedAt!, "America/New_York")).toBe("2026-03-16");
    expect(metrics.closedDate).toBe("2026-03-19");
  });

  it("builds month calendar days using the provided timezone instead of server-local month math", () => {
    const dashboard = buildDashboardData(
      [],
      [],
      "America/New_York",
      undefined,
      undefined,
      new Date("2026-03-01T02:30:00.000Z")
    );

    expect(dashboard.monthLabel).toBe("February 2026");
    expect(dashboard.calendarDays.some((day) => day.isoDate === "2026-02-01" && day.inMonth)).toBe(true);
  });

  it("lets the dashboard render an explicitly requested month and adjacent month keys", () => {
    const dashboard = buildDashboardData(
      [],
      [],
      "America/New_York",
      undefined,
      "2026-04",
      new Date("2026-03-20T12:00:00-04:00")
    );

    expect(dashboard.monthKey).toBe("2026-04");
    expect(dashboard.monthLabel).toBe("April 2026");
    expect(dashboard.previousMonthKey).toBe("2026-03");
    expect(dashboard.nextMonthKey).toBe("2026-05");
    expect(dashboard.calendarDays.some((day) => day.isoDate === "2026-04-01" && day.inMonth)).toBe(true);
  });

  it("carries cumulative P/L across month boundaries in the calendar view", () => {
    const marchWin = makeTrade({
      id: "march_win",
      openedAt: "2026-03-30T09:30:00-04:00",
      closedAt: "2026-03-30T10:00:00-04:00",
      fills: [
        {
          id: "march_win_entry",
          tradeId: "march_win",
          side: "entry",
          filledAt: "2026-03-30T09:30:00-04:00",
          quantity: 10,
          price: 100
        },
        {
          id: "march_win_exit",
          tradeId: "march_win",
          side: "exit",
          filledAt: "2026-03-30T10:00:00-04:00",
          quantity: 10,
          price: 110
        }
      ]
    });
    const aprilLoss = makeTrade({
      id: "april_loss",
      openedAt: "2026-04-01T09:30:00-04:00",
      closedAt: "2026-04-01T10:00:00-04:00",
      fills: [
        {
          id: "april_loss_entry",
          tradeId: "april_loss",
          side: "entry",
          filledAt: "2026-04-01T09:30:00-04:00",
          quantity: 10,
          price: 100
        },
        {
          id: "april_loss_exit",
          tradeId: "april_loss",
          side: "exit",
          filledAt: "2026-04-01T10:00:00-04:00",
          quantity: 10,
          price: 95
        }
      ]
    });

    const dashboard = buildDashboardData(
      [marchWin, aprilLoss],
      [],
      "America/New_York",
      undefined,
      "2026-04",
      new Date("2026-04-02T12:00:00-04:00")
    );

    expect(dashboard.calendarDays.find((day) => day.isoDate === "2026-03-30")?.cumulativePl).toBe(100);
    expect(dashboard.calendarDays.find((day) => day.isoDate === "2026-03-31")?.cumulativePl).toBe(100);
    expect(dashboard.calendarDays.find((day) => day.isoDate === "2026-04-01")?.cumulativePl).toBe(50);
    expect(dashboard.calendarDays.find((day) => day.isoDate === "2026-04-04")?.cumulativePl).toBe(50);
    expect(dashboard.calendarDays.find((day) => day.isoDate === "2026-04-11")?.cumulativePl).toBe(50);
  });

  it("uses the latest closed week rather than the latest opened trade when building dashboard coaching", () => {
    const olderOpenLaterClose = makeTrade({
      id: "swing_trade",
      openedAt: "2026-03-10T09:30:00-04:00",
      closedAt: "2026-03-20T15:45:00-04:00",
      fills: [
        {
          id: "swing_entry",
          tradeId: "swing_trade",
          side: "entry",
          filledAt: "2026-03-10T09:30:00-04:00",
          quantity: 10,
          price: 100
        },
        {
          id: "swing_exit",
          tradeId: "swing_trade",
          side: "exit",
          filledAt: "2026-03-20T15:45:00-04:00",
          quantity: 10,
          price: 103
        }
      ]
    });
    const newerOpenEarlierClose = makeTrade({
      id: "quick_trade",
      openedAt: "2026-03-19T09:30:00-04:00",
      closedAt: "2026-03-19T10:00:00-04:00",
      fills: [
        {
          id: "quick_entry",
          tradeId: "quick_trade",
          side: "entry",
          filledAt: "2026-03-19T09:30:00-04:00",
          quantity: 10,
          price: 100
        },
        {
          id: "quick_exit",
          tradeId: "quick_trade",
          side: "exit",
          filledAt: "2026-03-19T10:00:00-04:00",
          quantity: 10,
          price: 98
        }
      ]
    });

    const dashboard = buildDashboardData(
      [newerOpenEarlierClose, olderOpenLaterClose],
      [],
      "America/New_York",
      undefined,
      undefined,
      new Date("2026-03-20T18:00:00-04:00")
    );

    expect(dashboard.weeklyInsight?.scopeKey).toBe("2026-03-16");
  });

  it("parses datetime-local strings against the configured journal timezone", () => {
    expect(parseDateTimeInTimeZone("2026-03-18T09:35", "America/New_York")).toBe(
      "2026-03-18T13:35:00.000Z"
    );
    expect(parseDateTimeInTimeZone("2026-01-15T09:35", "America/New_York")).toBe(
      "2026-01-15T14:35:00.000Z"
    );
  });

  it("renders datetime-local values in the configured journal timezone", () => {
    expect(toInputDateTimeInTimeZone("2026-03-18T13:35:00.000Z", "America/New_York")).toBe(
      "2026-03-18T09:35"
    );
    expect(toInputDateTimeInTimeZone("2026-01-15T14:35:00.000Z", "America/New_York")).toBe(
      "2026-01-15T09:35"
    );
  });

  it("formats date keys without shifting them backward by timezone", () => {
    expect(formatShortDate("2026-03-20")).toBe("Mar 20");
  });

  it("formats durations into readable time units", () => {
    expect(formatDuration(52)).toBe("52 minutes");
    expect(formatDuration(295)).toBe("4 hours 55 minutes");
    expect(formatDuration(24 * 60 + 75)).toBe("1 day 1 hour 15 minutes");
  });

  it("formats capital buckets with readable separators", () => {
    expect(formatCapitalBucket(2000)).toBe("$1k – $5k");
    expect(formatCapitalBucket(6000)).toBe("$5k – $8k");
  });

  it("derives capital allocation from fills with option contract value", () => {
    expect(
      deriveCapitalAllocatedFromFills(
        [
          { side: "entry", quantity: 2, price: 5.66 },
          { side: "entry", quantity: 2, price: 5.69 },
          { side: "exit", quantity: 4, price: 4.5 }
        ],
        "option"
      )
    ).toBe(2270);
  });

  it("increases capital allocation when adds raise cumulative cost basis at a lower price", () => {
    expect(
      deriveCapitalAllocatedFromFills(
        [
          { side: "entry", quantity: 2, price: 3.39 },
          { side: "entry", quantity: 4, price: 0.84 }
        ],
        "option"
      )
    ).toBe(1014);
  });
});

describe("insight clustering", () => {
  it("groups similar weekly pain points even when the wording differs", () => {
    const firstTrade = makeTrade({
      id: "cluster_1",
      closedAt: "2026-03-20T14:00:00-04:00",
      postTradeReview: "Overconfident on a demand break and forced the breakout.",
      attachments: [
        {
          id: "attachment_cluster_1",
          tradeId: "cluster_1",
          kind: "postmortem",
          storagePath: "/api/uploads/mock-1.png",
          caption: "Forced breakout into supply after testing demand",
          uploadedAt: "2026-03-20T14:10:00-04:00",
          fileName: "mock-1.png"
        }
      ],
      tags: [{ id: "tag_cluster_1", tradeId: "cluster_1", category: "mistake", value: "Forced breakout after demand test" }]
    });
    const secondTrade = makeTrade({
      id: "cluster_2",
      closedAt: "2026-03-20T15:00:00-04:00",
      postTradeReview: "Pressed a breakout too early near supply.",
      tags: [{ id: "tag_cluster_2", tradeId: "cluster_2", category: "mistake", value: "Early breakout near supply" }]
    });

    const report = buildWeeklyInsight(
      [
        { ...firstTrade, metrics: computeTradeMetrics(firstTrade) },
        { ...secondTrade, metrics: computeTradeMetrics(secondTrade) }
      ],
      "user_demo"
    );

    expect(report).not.toBeNull();
    expect(report?.bullets[0]).toMatch(/Recurring friction:/);
    expect(report?.bullets[0]).toMatch(/trade/);
    expect(report?.bullets[0]).toMatch(/trade/);
  });
});

describe("insight generation", () => {
  it("flags chased entries as an execution issue", () => {
    const trade = makeTrade({
      tags: [{ id: "mistake_1", tradeId: "trade_test", category: "mistake", value: "chased entry" }]
    });
    const insight = buildTradeInsight(trade, computeTradeMetrics(trade));

    expect(insight.title).toBe("Entry quality broke the edge");
  });

  it("builds a weekly summary from closed trades", () => {
    const losingTrade = makeTrade({
      id: "loss_trade",
      fills: [
        {
          id: "loss_entry",
          tradeId: "loss_trade",
          side: "entry",
          filledAt: "2026-03-17T09:30:00-04:00",
          quantity: 10,
          price: 100
        },
        {
          id: "loss_exit",
          tradeId: "loss_trade",
          side: "exit",
          filledAt: "2026-03-17T10:00:00-04:00",
          quantity: 10,
          price: 96
        }
      ],
      tags: [{ id: "mistake_1", tradeId: "loss_trade", category: "mistake", value: "oversized" }]
    });
    const winningTrade = makeTrade({
      id: "win_trade",
      fills: [
        {
          id: "win_entry",
          tradeId: "win_trade",
          side: "entry",
          filledAt: "2026-03-18T09:30:00-04:00",
          quantity: 10,
          price: 100
        },
        {
          id: "win_exit",
          tradeId: "win_trade",
          side: "exit",
          filledAt: "2026-03-18T10:00:00-04:00",
          quantity: 10,
          price: 110
        }
      ]
    });

    const report = buildWeeklyInsight(
      [
        { ...losingTrade, metrics: computeTradeMetrics(losingTrade) },
        { ...winningTrade, metrics: computeTradeMetrics(winningTrade) }
      ],
      "user_demo"
    );

    expect(report).not.toBeNull();
    expect(report?.supportingTradeIds).toEqual(expect.arrayContaining(["loss_trade", "win_trade"]));
    expect(report?.bullets[0]).toContain("oversized");
  });

  it("keys weekly insights with the provided timezone", () => {
    const timezoneShiftedTrade = makeTrade({
      id: "timezone_shifted_trade",
      openedAt: "2026-03-23T03:30:00.000Z",
      closedAt: "2026-03-23T03:45:00.000Z",
      fills: [
        {
          id: "tz_entry",
          tradeId: "timezone_shifted_trade",
          side: "entry",
          filledAt: "2026-03-23T03:30:00.000Z",
          quantity: 10,
          price: 100
        },
        {
          id: "tz_exit",
          tradeId: "timezone_shifted_trade",
          side: "exit",
          filledAt: "2026-03-23T03:45:00.000Z",
          quantity: 10,
          price: 102
        }
      ]
    });

    const report = buildWeeklyInsight(
      [{ ...timezoneShiftedTrade, metrics: computeTradeMetrics(timezoneShiftedTrade, "America/New_York") }],
      "user_demo",
      "America/New_York"
    );

    expect(report?.scopeKey).toBe("2026-03-16");
  });
});
