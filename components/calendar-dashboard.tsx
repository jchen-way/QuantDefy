"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarGrid, CalendarGridWeek } from "@/components/calendar-grid";
import { CalendarDay, InsightReport, Trade, TradeMetrics } from "@/lib/domain/types";
import { cn, formatShortDate, getResultColor, toCurrency, toDecimal } from "@/lib/domain/utils";

type TradeWithComputed = Trade & { metrics: TradeMetrics; insight?: InsightReport };

type CalendarDashboardProps = {
  calendarDays: CalendarDay[];
  trades: TradeWithComputed[];
  initialSelectedDay: string | null;
  monthLabel: string;
  previousMonthHref?: string;
  nextMonthHref?: string;
};

const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function chunkWeeks(days: CalendarDay[]) {
  const weeks: CalendarDay[][] = [];

  for (let index = 0; index < days.length; index += 7) {
    weeks.push(days.slice(index, index + 7));
  }

  return weeks;
}

export function CalendarDashboard({
  calendarDays,
  trades,
  initialSelectedDay,
  monthLabel,
  previousMonthHref,
  nextMonthHref
}: CalendarDashboardProps) {
  const [selectedDay, setSelectedDay] = useState(initialSelectedDay ?? calendarDays[0]?.isoDate ?? null);
  const selectedTrades = trades.filter((trade) => trade.metrics.closedDate === selectedDay);
  const weeks: CalendarGridWeek[] = chunkWeeks(calendarDays).map((week, weekIndex) => {
    const weekTotal = week.reduce((total, day) => total + day.realizedPl, 0);
    const saturdayDate = week[6]?.isoDate;

    return {
      id: `week-${weekIndex}`,
      days: week.map((day) => ({
        key: day.isoDate,
        dayLabel: day.label,
        topRight:
          day.isoDate === saturdayDate ? "Cumulative" : toCurrency(day.cumulativePl, true),
        body:
          day.isoDate === saturdayDate
            ? toCurrency(weekTotal, true)
            : day.realizedPl === 0
              ? "$0.00"
              : toCurrency(day.realizedPl, true),
        footer:
          day.isoDate === saturdayDate
            ? "week close"
            : `${day.tradeIds.length} ${day.tradeIds.length === 1 ? "trade" : "trades"}`,
        tone:
          day.isoDate === saturdayDate
            ? weekTotal > 0
              ? "win"
              : weekTotal < 0
                ? "loss"
                : "flat"
            : day.realizedPl > 0
              ? "win"
              : day.realizedPl < 0
                ? "loss"
                : "flat",
        inMonth: day.inMonth,
        active: selectedDay === day.isoDate,
        onSelect: () => setSelectedDay(day.isoDate)
      }))
    };
  });

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_0.6fr]">
      <div className="rounded-[1.7rem] border border-white/8 bg-[rgba(255,255,255,0.035)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/42">Month view</div>
            <div className="mt-1 text-xl font-semibold tracking-[-0.04em] text-white">{monthLabel}</div>
          </div>
          <div className="flex items-center gap-2">
            {previousMonthHref ? (
              <Link
                href={previousMonthHref}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-white/72 transition hover:bg-white/10 hover:text-white"
                aria-label="Previous month"
              >
                ←
              </Link>
            ) : null}
            {nextMonthHref ? (
              <Link
                href={nextMonthHref}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg text-white/72 transition hover:bg-white/10 hover:text-white"
                aria-label="Next month"
              >
                →
              </Link>
            ) : null}
          </div>
        </div>
        <CalendarGrid weeks={weeks} weekdayHeaders={weekdayHeaders} />
      </div>

      <div className="rounded-[1.7rem] border border-white/8 bg-[linear-gradient(180deg,rgba(19,27,39,0.9),rgba(13,18,28,0.84))] p-5 text-white">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/42">Day drilldown</div>
            <h3 className="mt-2 text-[1.8rem] font-semibold tracking-[-0.05em]">
              {selectedDay ? formatShortDate(selectedDay) : "No day selected"}
            </h3>
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/56">
            Closed trades only
          </div>
        </div>
        <div className="scrollbar-thin max-h-[32rem] space-y-4 overflow-auto pr-1">
          {selectedTrades.length === 0 ? (
            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] px-4 py-8 text-sm text-white/56">
              No closed trades on this date.
            </div>
          ) : null}
          {selectedTrades.map((trade) => (
            <Link
              key={trade.id}
              href={`/trades/${trade.id}`}
              className="block rounded-[1.55rem] border border-white/8 bg-white/[0.035] p-4 transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:translate-y-[-1px] hover:border-white/14 hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/36">
                    {trade.tradeType}
                  </div>
                  <div className="mt-2 text-[1.45rem] font-semibold tracking-[-0.04em] text-white">{trade.symbol}</div>
                </div>
                <div className={cn("shrink-0 text-right text-[1.4rem] font-semibold tracking-[-0.04em]", getResultColor(trade.metrics.result))}>
                  {toCurrency(trade.metrics.realizedPl)}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/54">
                  {trade.setupType}
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-white/66">{trade.thesis}</p>
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/8 pt-3 text-sm text-white/52">
                <span className="capitalize">{trade.direction}</span>
                <span className="h-1 w-1 rounded-full bg-white/18" />
                <span>R {toDecimal(trade.metrics.rMultiple)}</span>
                <span className="h-1 w-1 rounded-full bg-white/18" />
                <span>{trade.tags.length} tags</span>
              </div>
              {trade.tags.length > 0 ? (
                <div className="mt-3 text-sm leading-7 text-white/58">
                  {trade.tags
                    .slice(0, 2)
                    .map((tag) => tag.value)
                    .join("  /  ")}
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
