import { cn } from "@/lib/domain/utils";

export type CalendarGridDay = {
  key: string;
  dayLabel: string | number;
  topRight: string;
  body: string;
  footer: string;
  tone: "flat" | "win" | "loss";
  inMonth?: boolean;
  active?: boolean;
  onSelect?: () => void;
};

export type CalendarGridWeek = {
  id: string;
  days: CalendarGridDay[];
  summaryLabel?: string;
  summaryValue?: string;
  summaryTone?: "flat" | "win" | "loss";
};

type CalendarGridProps = {
  weeks: CalendarGridWeek[];
  weekdayHeaders: string[];
  variant?: "app" | "preview";
};

function toneClass(tone: CalendarGridDay["tone"]) {
  if (tone === "win") return "bg-emerald-500/12";
  if (tone === "loss") return "bg-rose-500/14";
  return "bg-white/[0.04]";
}

function summaryToneClass(tone: CalendarGridWeek["summaryTone"]) {
  if (tone === "win") return "text-green";
  if (tone === "loss") return "text-red";
  return "text-white";
}

export function CalendarGrid({
  weeks,
  weekdayHeaders,
  variant = "app"
}: CalendarGridProps) {
  const preview = variant === "preview";
  const columnStyle = { gridTemplateColumns: `repeat(${weekdayHeaders.length}, minmax(0, 1fr))` };

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="space-y-3 md:hidden">
          {weeks.map((week) => (
            <div key={`${week.id}-mobile`} className="grid grid-cols-3 gap-2">
              {week.days.map((day, dayIndex) => {
                const weekdayLabel = weekdayHeaders[dayIndex] ?? "";
                const summaryDay = dayIndex === week.days.length - 1;

                return (
                  <div
                    key={`${day.key}-mobile`}
                    className={cn(
                      "grid rounded-[1rem] border text-left",
                      summaryDay
                        ? "col-span-3 min-h-[88px] grid-rows-[auto_1fr_auto] px-3 py-3"
                        : "min-h-[94px] grid-rows-[auto_1fr_auto] px-2.5 py-2.5",
                      day.inMonth === false ? "border-white/5 opacity-55" : "border-white/10",
                      toneClass(day.tone),
                      day.active ? "ring-2 ring-[rgba(245,188,117,0.9)]" : ""
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                          {summaryDay ? "Week close" : weekdayLabel}
                        </div>
                        <div
                          className={cn(
                            "mt-1 font-mono uppercase tracking-[0.18em] text-white/70",
                            summaryDay ? "text-xs" : "text-[11px]"
                          )}
                        >
                          {day.dayLabel}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-right font-semibold leading-tight",
                          summaryDay ? "max-w-[5.75rem]" : "max-w-[3.7rem]",
                          day.topRight.length > 8
                            ? summaryDay
                              ? "text-[10px]"
                              : "text-[9px]"
                            : "text-[10px]",
                          day.tone === "win" && "text-green",
                          day.tone === "loss" && "text-red",
                          day.tone === "flat" && "text-white/60"
                        )}
                      >
                        {day.topRight}
                      </span>
                    </div>
                    <div className="flex items-center justify-center py-2 text-center">
                      <div
                        className={cn(
                          "font-semibold leading-none text-ink",
                          summaryDay ? "text-base" : "text-[11px]"
                        )}
                      >
                        {day.body}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-center leading-none text-muted",
                        summaryDay ? "text-[10px]" : "text-[9px]"
                      )}
                    >
                      {day.footer}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      ) : null}

      <div className={cn("pb-1", preview ? "hidden pb-2 md:block md:overflow-x-auto" : "overflow-x-auto")}>
        <div
          className={cn(
            "space-y-3 px-2",
            preview ? "min-w-[33rem] sm:min-w-0 sm:px-1" : "min-w-[760px] sm:px-1"
          )}
        >
          <div className={cn("grid", preview ? "gap-1.5" : "gap-2")} style={columnStyle}>
            {weekdayHeaders.map((day) => (
              <div
                key={day}
                className={cn(
                  "px-2 py-1 text-center font-mono uppercase tracking-[0.18em] text-muted",
                  preview ? "text-[10px] sm:text-[11px]" : "text-[11px]"
                )}
              >
                {day}
              </div>
            ))}
          </div>
          {weeks.map((week) => (
            <div key={week.id} className="space-y-2">
              <div className={cn("grid", preview ? "gap-1.5" : "gap-2")} style={columnStyle}>
                {week.days.map((day) => (
                  <button
                    key={day.key}
                    type="button"
                    disabled={!day.onSelect}
                    onClick={day.onSelect}
                    className={cn(
                      "grid grid-rows-[auto_1fr_auto] border text-left transition",
                      preview
                        ? "min-h-[96px] rounded-[1rem] px-2 py-2 sm:min-h-[106px] sm:px-2.5 sm:py-2.5"
                        : "min-h-[124px] rounded-[1.2rem] px-3 py-3",
                      day.onSelect ? "hover:translate-y-[-1px]" : "cursor-default",
                      day.inMonth === false ? "border-white/5 opacity-55" : "border-white/10",
                      toneClass(day.tone),
                      day.active ? "ring-2 ring-[rgba(245,188,117,0.9)]" : ""
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-mono text-xs uppercase leading-none tracking-[0.18em] text-muted">
                        {day.dayLabel}
                      </span>
                      <span
                        className={cn(
                          "max-w-[5rem] text-right font-semibold leading-tight sm:max-w-[5.25rem]",
                          day.topRight.length > 8 ? "text-[9px] sm:text-[10px]" : "text-[10px] sm:text-[11px]",
                          day.tone === "win" && "text-green",
                          day.tone === "loss" && "text-red",
                          day.tone === "flat" && "text-white/60"
                        )}
                      >
                        {day.topRight}
                      </span>
                    </div>
                    <div className="flex items-center justify-center py-2 text-center">
                      <div
                        className={cn(
                          "font-semibold leading-none text-ink",
                          preview ? "text-[13px] sm:text-[15px]" : "text-[15px]"
                        )}
                      >
                        {day.body}
                      </div>
                    </div>
                    <div
                      className={cn(
                        "text-center leading-none text-muted",
                        preview ? "text-[9px] sm:text-[10px]" : "text-[11px]"
                      )}
                    >
                      {day.footer}
                    </div>
                  </button>
                ))}
              </div>
              {week.summaryLabel && week.summaryValue ? (
                <div className="flex justify-end">
                  <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] uppercase tracking-[0.18em] text-white/60">
                    {week.summaryLabel}
                    <span
                      className={cn(
                        "ml-3 text-sm font-semibold normal-case tracking-normal",
                        summaryToneClass(week.summaryTone ?? "flat")
                      )}
                    >
                      {week.summaryValue}
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
