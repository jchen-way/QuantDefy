"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteTradeFilterPresetAction,
  saveTradeFilterPresetAction
} from "@/app/trades/actions";
import { InsightReport, Trade, TradeFilterPreset, TradeMetrics } from "@/lib/domain/types";
import { cn, durationBucketLabel, formatDateTime, getResultColor, toCurrency, toDecimal } from "@/lib/domain/utils";
import { fieldClass, selectFieldClass } from "@/lib/ui/form-styles";

type TradeWithComputed = Trade & { metrics: TradeMetrics; insight?: InsightReport };

type TradesWorkspaceProps = {
  trades: TradeWithComputed[];
  presets: TradeFilterPreset[];
};

const PAGE_SIZE = 8;

export function TradesWorkspace({ trades, presets }: TradesWorkspaceProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [setupType, setSetupType] = useState("all");
  const [direction, setDirection] = useState("all");
  const [result, setResult] = useState("all");
  const [duration, setDuration] = useState("all");
  const [page, setPage] = useState(1);
  const [presetName, setPresetName] = useState("");
  const [presetError, setPresetError] = useState<string | null>(null);
  const [presetSuccess, setPresetSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(search);
  const setupOptions = Array.from(new Set(trades.map((trade) => trade.setupType))).sort((left, right) =>
    left.localeCompare(right)
  );

  const filtered = trades.filter((trade) => {
    const searchMatches =
      deferredSearch.trim().length === 0 ||
      trade.symbol.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      trade.instrumentLabel.toLowerCase().includes(deferredSearch.toLowerCase()) ||
      trade.tags.some((tag) => tag.value.toLowerCase().includes(deferredSearch.toLowerCase()));

    return (
      searchMatches &&
      (setupType === "all" || trade.setupType === setupType) &&
      (direction === "all" || trade.direction === direction) &&
      (result === "all" || trade.metrics.result === result) &&
      (duration === "all" || trade.metrics.durationBucket === duration)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageStart = filtered.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE;
  const paginatedTrades = filtered.slice(pageStart, pageStart + PAGE_SIZE);
  const pageEnd = pageStart + paginatedTrades.length;

  useEffect(() => {
    setPage(1);
  }, [deferredSearch, setupType, direction, result, duration]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  async function savePreset() {
    const response = await saveTradeFilterPresetAction({
      name: presetName,
      symbol: search || undefined,
      setupType: setupType as TradeFilterPreset["setupType"] | "all",
      direction: direction as TradeFilterPreset["direction"] | "all",
      result: result as TradeFilterPreset["result"] | "all",
      durationBucket: duration as TradeFilterPreset["durationBucket"] | "all"
    });

    if (!response.success) {
      setPresetSuccess(null);
      setPresetError(response.error);
      return;
    }

    setPresetName("");
    setPresetError(null);
    setPresetSuccess("Saved view added.");
    router.refresh();
  }

  async function deletePreset(presetId: string) {
    const response = await deleteTradeFilterPresetAction(presetId);

    if (!response.success) {
      setPresetSuccess(null);
      setPresetError(response.error);
      return;
    }

    setPresetError(null);
    setPresetSuccess("Saved view removed.");
    router.refresh();
  }

  function resetFilters() {
    setSearch("");
    setSetupType("all");
    setDirection("all");
    setResult("all");
    setDuration("all");
    setPresetError(null);
    setPresetSuccess(null);
  }

  if (trades.length === 0) {
    return (
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="glass-panel rounded-[1.8rem] p-6 sm:p-7">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Journal setup</div>
          <h2 className="mt-3 max-w-xl text-[2rem] font-semibold tracking-[-0.05em] text-ink">
            This account is live, but the journal is still empty.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
            Start by logging a closed trade with fills, tags, and at least one chart image. The
            calendar, analytics, and coaching surfaces will populate from that first record.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/trades/new"
              className="rounded-full bg-[linear-gradient(135deg,#f5bc75,#e27847)] px-5 py-3 text-sm font-semibold text-[#091019] shadow-[0_14px_34px_rgba(241,124,71,0.24)] transition hover:translate-y-[-1px]"
            >
              Log first trade
            </Link>
            <Link
              href="/settings"
              className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white"
            >
              Review defaults
            </Link>
          </div>
        </div>

        <div className="glass-panel rounded-[1.8rem] p-6 sm:p-7">
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">What to capture</div>
          <div className="mt-4 grid gap-3">
            {[
              "At least one entry fill and, for closed trades, one exit fill.",
              "A clear thesis, entry reason, and post-trade review note.",
              "Mistake, emotion, and lesson tags so the insight layer has structure.",
              "Setup or postmortem screenshots attached to the trade record."
            ].map((item) => (
              <div
                key={item}
                className="rounded-[1.3rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-ink"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="glass-panel rounded-[1.6rem] p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1.1fr_repeat(4,0.5fr)]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={fieldClass}
            placeholder="Search symbol, tag, or instrument"
          />
          <select value={setupType} onChange={(event) => setSetupType(event.target.value)} className={selectFieldClass}>
            <option value="all">All setups</option>
            {setupOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          <select value={direction} onChange={(event) => setDirection(event.target.value)} className={selectFieldClass}>
            <option value="all">All directions</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <select value={result} onChange={(event) => setResult(event.target.value)} className={selectFieldClass}>
            <option value="all">All results</option>
            <option value="win">Wins</option>
            <option value="loss">Losses</option>
            <option value="scratch">Scratch</option>
            <option value="open">Open</option>
          </select>
          <select value={duration} onChange={(event) => setDuration(event.target.value)} className={selectFieldClass}>
            <option value="all">All durations</option>
            <option value="scalp">Scalp</option>
            <option value="intraday">Intraday</option>
            <option value="session">Session</option>
            <option value="swing">Swing</option>
            <option value="position">Position</option>
            <option value="open">Open</option>
          </select>
        </div>
        <div className="mt-5 rounded-[1.35rem] border border-white/8 bg-white/[0.025] p-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0 flex-1">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Saved views</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {presets.length === 0 ? (
                  <div className="rounded-full border border-dashed border-white/10 px-3 py-1.5 text-sm text-white/48">
                    No saved views yet
                  </div>
                ) : null}
                {presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="group flex items-center gap-2 rounded-full border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] px-3 py-1.5 text-sm text-ink transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-white/16 hover:bg-white/[0.06]"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSearch(preset.symbol ?? "");
                        setSetupType(preset.setupType ?? "all");
                        setDirection(preset.direction ?? "all");
                        setResult(preset.result ?? "all");
                        setDuration(preset.durationBucket ?? "all");
                        setPresetSuccess(null);
                        setPresetError(null);
                      }}
                      className="truncate text-[13px] font-medium text-white/88 transition group-hover:text-white"
                    >
                      {preset.name}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        startTransition(async () => {
                          await deletePreset(preset.id);
                        })
                      }
                      className="flex h-5 w-5 items-center justify-center rounded-full bg-white/[0.05] text-[11px] text-white/42 transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-rose-400/16 hover:text-rose-200"
                      aria-label={`Delete preset ${preset.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-xs text-muted">
                {filtered.length === 0 ? (
                  "No trades match the active view."
                ) : (
                  <>
                    Showing {pageStart + 1}-{pageEnd} of {filtered.length}{" "}
                    {filtered.length === 1 ? "trade" : "trades"} in the active view.
                  </>
                )}
              </div>
            </div>

            <div className="w-full xl:max-w-[32rem]">
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Save current filters</div>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  value={presetName}
                  onChange={(event) => setPresetName(event.target.value)}
                  className={fieldClass}
                  placeholder="Morning winners"
                />
                <div className="flex gap-2 sm:shrink-0">
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-3 text-sm font-medium text-white/62 transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/[0.08] hover:text-white active:scale-[0.98]"
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() =>
                      startTransition(async () => {
                        await savePreset();
                      })
                    }
                    className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-semibold text-white transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-white/[0.11] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPending ? "Saving" : "Save"}
                  </button>
                </div>
              </div>
              <div className="mt-2 min-h-[1.25rem] text-xs">
                {presetError ? <span className="text-red">{presetError}</span> : null}
                {!presetError && presetSuccess ? <span className="metric-positive">{presetSuccess}</span> : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {paginatedTrades.map((trade) => (
          <Link
            key={trade.id}
            href={`/trades/${trade.id}`}
            className="glass-panel rounded-[1.8rem] p-5 transition duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] hover:translate-y-[-1px] hover:border-white/12"
          >
            <article className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_13rem] xl:gap-8">
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-4 xl:hidden">
                  <div className="min-w-0">
                    <div className="text-2xl font-semibold tracking-[-0.05em] text-ink">{trade.symbol}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/54">
                        {trade.setupType}
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                        {trade.tradeType}
                      </span>
                    </div>
                  </div>
                  <div
                    className={cn(
                      "shrink-0 text-right text-[2rem] font-semibold tracking-[-0.06em]",
                      getResultColor(trade.metrics.result)
                    )}
                  >
                    {trade.status === "open" ? "Open" : toCurrency(trade.metrics.realizedPl)}
                  </div>
                </div>

                <div className="hidden items-start justify-between gap-6 xl:flex">
                  <div className="min-w-0">
                    <div className="text-[2.1rem] font-semibold tracking-[-0.06em] text-ink">{trade.symbol}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/54">
                        {trade.setupType}
                      </span>
                      <span className="rounded-full border border-white/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">
                        {trade.tradeType}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-4 max-w-[68ch] text-sm leading-7 text-white/68">{trade.thesis}</p>

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/52">
                  <span>{formatDateTime(trade.openedAt)}</span>
                  <span className="h-1 w-1 rounded-full bg-white/18" />
                  <span className="capitalize">{trade.direction}</span>
                  <span className="h-1 w-1 rounded-full bg-white/18" />
                  <span>{durationBucketLabel(trade.metrics.durationBucket)}</span>
                  <span className="h-1 w-1 rounded-full bg-white/18" />
                  <span>
                    {trade.attachments.length} image{trade.attachments.length === 1 ? "" : "s"}
                  </span>
                </div>

                <div className="mt-5 space-y-3 border-t border-white/8 pt-4">
                  {(["mistake", "lesson"] as const).map((category) => {
                    const values = trade.tags
                      .filter((tag) => tag.category === category)
                      .map((tag) => tag.value);

                    if (values.length === 0) {
                      return null;
                    }

                    return (
                      <div key={category} className="grid gap-1 sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-4">
                        <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/34">
                          {category === "mistake" ? "Mistakes" : "Lessons"}
                        </div>
                        <div className="text-sm leading-7 text-white/74">{values.join("  /  ")}</div>
                      </div>
                    );
                  })}
                  {trade.tags.filter((tag) => tag.category !== "mistake" && tag.category !== "lesson").length > 0 ? (
                    <div className="grid gap-1 sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-4">
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/34">Tags</div>
                      <div className="text-sm leading-7 text-white/60">
                        {trade.tags
                          .filter((tag) => tag.category !== "mistake" && tag.category !== "lesson")
                          .map((tag) => tag.value)
                          .join("  /  ")}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <aside className="border-t border-white/8 pt-4 xl:border-l xl:border-t-0 xl:pt-0 xl:pl-6">
                <div
                  className={cn(
                    "hidden text-right text-[2.25rem] font-semibold tracking-[-0.06em] xl:block",
                    getResultColor(trade.metrics.result)
                  )}
                >
                  {trade.status === "open" ? "Open" : toCurrency(trade.metrics.realizedPl)}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm xl:mt-5 xl:grid-cols-1">
                  <div className="space-y-1 text-left xl:text-right">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/34">R multiple</dt>
                    <dd className="text-base text-white/78">R {toDecimal(trade.metrics.rMultiple)}</dd>
                  </div>
                  <div className="space-y-1 text-left xl:text-right">
                    <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/34">Capital</dt>
                    <dd className="text-base text-white/78">{toCurrency(trade.metrics.maxCapitalUsed)}</dd>
                  </div>
                </dl>
              </aside>
            </article>
          </Link>
        ))}
        {filtered.length === 0 ? (
          <div className="glass-panel rounded-[1.6rem] px-6 py-12 text-center text-sm text-muted">
            No trades matched the current filters.
          </div>
        ) : null}
        {filtered.length > PAGE_SIZE ? (
          <div className="flex flex-col gap-3 rounded-[1.4rem] border border-white/8 bg-white/[0.03] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-white/58">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={currentPage === 1}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-white/68 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-medium tracking-[0.08em] text-white/44">
                {pageStart + 1}-{pageEnd}
              </div>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={currentPage === totalPages}
                className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm font-medium text-white/68 transition hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
