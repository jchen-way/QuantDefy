import Link from "next/link";
import { CalendarGrid, CalendarGridWeek } from "@/components/calendar-grid";
import { PublicNavbar } from "@/components/public-navbar";

const featureBlocks = [
  {
    title: "Calendar P/L mapping",
    copy: "See winning, flat, and drawdown days at a glance, then drill straight into the trades that produced them."
  },
  {
    title: "Structured trade review",
    copy: "Capture entries, exits, thesis quality, emotions, sizing, and post-trade lessons in one repeatable flow."
  },
  {
    title: "Screenshot evidence",
    copy: "Upload setup images, winners, losers, and postmortems so your journal is visual, not just textual."
  },
  {
    title: "Insight loops",
    copy: "Combine deterministic stats with coaching-style summaries to expose recurring pain points in your execution."
  }
];

const previewWeekdayHeaders = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type PreviewTone = "flat" | "win" | "loss";
type PreviewDay = {
  day: number;
  cumulative: string;
  daily: string;
  tone: PreviewTone;
  active?: boolean;
};

const previewWeeks: PreviewDay[][] = [
  [
    { day: 2, daily: "$0.00", cumulative: "$0.00", tone: "flat" },
    { day: 3, daily: "$0.00", cumulative: "$0.00", tone: "flat" },
    { day: 4, daily: "$0.00", cumulative: "$0.00", tone: "flat" },
    { day: 5, daily: "$0.00", cumulative: "$0.00", tone: "flat" },
    { day: 6, daily: "$0.00", cumulative: "$0.00", tone: "flat" },
    { day: 7, daily: "$0.00", cumulative: "$0.00", tone: "flat" }
  ],
  [
    { day: 9, daily: "$59.6", cumulative: "-$66.8", tone: "win" },
    { day: 10, daily: "-$47.6", cumulative: "-$114.3", tone: "loss", active: true },
    { day: 11, daily: "-$6.9", cumulative: "-$121.2", tone: "loss" },
    { day: 12, daily: "$57.4", cumulative: "-$63.8", tone: "win" },
    { day: 13, daily: "-$32.3", cumulative: "-$96.1", tone: "loss" },
    { day: 14, daily: "-$96.1", cumulative: "-$96.1", tone: "loss" }
  ],
  [
    { day: 16, daily: "-$5.7", cumulative: "-$101.8", tone: "loss" },
    { day: 17, daily: "$34.6", cumulative: "-$67.2", tone: "win" },
    { day: 18, daily: "$51.4", cumulative: "-$15.8", tone: "win" },
    { day: 19, daily: "$0.00", cumulative: "-$15.8", tone: "flat" },
    { day: 20, daily: "$0.00", cumulative: "-$15.8", tone: "flat" },
    { day: 21, daily: "-$15.8", cumulative: "-$15.8", tone: "loss" }
  ]
];

export default function HomePage() {
  const previewClosedTrades = previewWeeks.reduce(
    (total, week) =>
      total +
      week.filter((day) => day.day !== 7 && day.day !== 14 && day.day !== 21 && day.tone !== "flat").length,
    0
  );

  const previewCalendarWeeks: CalendarGridWeek[] = previewWeeks.map((week, weekIndex) => ({
    id: `preview-week-${weekIndex}`,
    days: week.map((day) => ({
      key: `preview-day-${day.day}`,
      dayLabel: day.day,
      topRight: day.day === 7 || day.day === 14 || day.day === 21 ? "Cumulative" : day.cumulative,
      body: day.day === 7 || day.day === 14 || day.day === 21 ? day.cumulative : day.daily,
      footer: day.day === 7 || day.day === 14 || day.day === 21 ? "week close" : day.tone === "flat" ? "0 trades" : "1 trade",
      tone:
        day.day === 7 || day.day === 14 || day.day === 21
          ? day.cumulative.includes("-")
            ? "loss"
            : day.cumulative === "$0.00"
              ? "flat"
              : "win"
          : day.tone,
      active: "active" in day && Boolean(day.active)
    }))
  }));

  return (
    <main className="min-h-screen bg-[#090d16] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_18%,rgba(241,124,71,0.22),transparent_18%),radial-gradient(circle_at_84%_10%,rgba(61,149,135,0.2),transparent_22%),linear-gradient(180deg,#09101a_0%,#080c13_100%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="relative">
        <PublicNavbar />
        <section className="mx-auto max-w-[1380px] px-4 pb-16 pt-8 sm:px-6 lg:pt-12">
          <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
            <div className="space-y-8 xl:max-w-[39rem] xl:pt-6">
              <div className="soft-pill inline-flex items-center rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-white/56">
                Calendar-first trading journal
              </div>
              <div className="space-y-5">
                <h1 className="max-w-[10ch] text-5xl font-semibold tracking-[-0.08em] text-white sm:text-6xl lg:text-[5.25rem] lg:leading-[0.96]">
                  Review every trade inside a system that actually teaches you something back.
                </h1>
                <p className="max-w-xl text-base leading-8 text-white/70 sm:text-lg">
                  QuantDefy is a private performance workspace for traders who want a real review loop:
                  day-by-day P/L visibility, structured thesis capture, screenshot evidence, and analytics
                  that expose what is hurting edge quality.
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/register"
                  className="rounded-full bg-[linear-gradient(135deg,#f5bc75,#e27847)] px-7 py-3 text-center text-sm font-semibold text-[#081019] transition hover:translate-y-[-1px]"
                >
                  Create account
                </Link>
                <Link
                  href="/login"
                  className="rounded-full border border-white/10 bg-white/5 px-7 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Sign in
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2" id="features">
                {featureBlocks.map((item) => (
                  <div
                    key={item.title}
                    className="soft-panel rounded-[1.45rem] p-5"
                  >
                    <div className="text-lg font-semibold text-white">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-white/60">{item.copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative xl:pt-6">
              <div className="absolute inset-8 rounded-full bg-[radial-gradient(circle,rgba(243,180,103,0.26),transparent_54%)] blur-3xl" />
              <div className="soft-panel relative overflow-hidden rounded-[2rem] p-5 shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/46">Live preview</div>
                    <div className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">Desk for post-trade review</div>
                  </div>
                  <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200">
                    +$2,840 week
                  </div>
                </div>
                <div className="grid gap-4">
                  <div className="soft-panel rounded-[1.5rem] p-4" id="product">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-sm text-white/70">March review calendar</div>
                      <div className="text-sm font-semibold text-white">{previewClosedTrades} closed trades</div>
                    </div>
                    <CalendarGrid weeks={previewCalendarWeeks} weekdayHeaders={previewWeekdayHeaders} variant="preview" />
                  </div>
                  <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                    <div className="soft-panel rounded-[1.5rem] p-4">
                      <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/46">Insight</div>
                      <div className="mt-3 text-lg font-semibold text-white" id="insights">
                        Entry quality is still the main leak.
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/62">
                        Most losing trades this week came from early entry attempts before confirmation held.
                      </p>
                    </div>
                    <div className="soft-panel rounded-[1.5rem] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/46">Distribution</div>
                        <div className="text-xs text-white/58">Trade type mix</div>
                      </div>
                      <div className="space-y-3">
                        {[
                          ["Opening drive", "68%"],
                          ["Trend pullback", "18%"],
                          ["Failed breakout", "9%"],
                          ["Gamma momentum", "5%"]
                        ].map(([label, width]) => (
                          <div key={label}>
                            <div className="mb-2 flex items-center justify-between text-sm text-white/70">
                              <span>{label}</span>
                              <span>{width}</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/8">
                              <div
                                className="h-full rounded-full bg-[linear-gradient(90deg,#f5bc75,#e27847)]"
                                style={{ width }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section className="mt-14 grid gap-4 lg:grid-cols-3" id="faq">
            {[
              ["Why not spreadsheets?", "Because execution review, screenshots, and mistake patterns become fragmented the moment your workflow leaves one system."],
              ["Does it support images?", "Yes. Capture setups, winners, losers, and postmortems so review stays tied to actual chart evidence."],
              ["Can it generate insights?", "Yes. Deterministic analytics stay the source of truth, and the insight layer helps surface patterns faster."]
            ].map(([title, copy]) => (
              <div key={title} className="soft-panel rounded-[1.6rem] p-6">
                <div className="text-xl font-semibold text-white">{title}</div>
                <p className="mt-3 text-sm leading-7 text-white/60">{copy}</p>
              </div>
            ))}
          </section>
        </section>
      </div>
    </main>
  );
}
