import { SectionCard } from "@/components/section-card";
import { EquityPoint } from "@/lib/domain/types";
import { cn, toCurrency } from "@/lib/domain/utils";

type LineChartCardProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  series: EquityPoint[];
  accent?: "green" | "red" | "ink";
};

function buildPath(series: EquityPoint[], width: number, height: number) {
  if (series.length < 2) {
    return null;
  }

  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  return series
    .map((point, index) => {
      const x = (index / Math.max(series.length - 1, 1)) * width;
      const y = height - ((point.value - min) / span) * height;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

export function LineChartCard({
  title,
  eyebrow,
  description,
  series,
  accent = "green"
}: LineChartCardProps) {
  const current = series.at(-1)?.value ?? 0;
  const path = buildPath(series, 520, 180);
  const singlePoint = series.length === 1 ? series[0] : null;
  const xAxisPoints = singlePoint
    ? [singlePoint]
    : series.filter((point, index) => {
        if (series.length <= 4) {
          return true;
        }

        const step = Math.ceil((series.length - 1) / 3);
        return index === 0 || index === series.length - 1 || index % step === 0;
      });
  const accentColor =
    accent === "green" ? "#3cb58a" : accent === "red" ? "#ee7d79" : "#f5bc75";
  const gradientId = `gradient-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  return (
    <SectionCard
      title={title}
      eyebrow={eyebrow}
      description={description}
      className="flex h-full flex-col"
    >
      <div className="flex flex-1 flex-col gap-5">
        <div className={cn("text-[2.35rem] font-semibold tracking-[-0.06em]", accent === "red" ? "metric-negative" : "metric-positive")}>
          {toCurrency(current)}
        </div>
        <div className="flex min-h-[22rem] flex-1 flex-col rounded-[1.5rem] border border-white/8 bg-[rgba(255,255,255,0.035)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <svg viewBox="0 0 520 180" preserveAspectRatio="none" className="h-full min-h-[16rem] w-full flex-1">
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accentColor} stopOpacity="0.28" />
                <stop offset="100%" stopColor={accentColor} stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0, 1, 2, 3].map((row) => (
              <line
                key={row}
                x1="0"
                y1={row * 60}
                x2="520"
                y2={row * 60}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="4 8"
              />
            ))}
            {path ? (
              <>
                <path
                  d={`${path} L520,180 L0,180 Z`}
                  fill={`url(#${gradientId})`}
                />
                <path d={path} fill="none" stroke={accentColor} strokeWidth="3" strokeLinecap="round" />
              </>
            ) : null}
            {singlePoint ? (
              <>
                <line
                  x1="260"
                  y1="16"
                  x2="260"
                  y2="164"
                  stroke={accentColor}
                  strokeOpacity="0.28"
                  strokeDasharray="4 8"
                />
                <circle cx="260" cy="90" r="7" fill={accentColor} />
                <circle cx="260" cy="90" r="12" fill={accentColor} fillOpacity="0.18" />
              </>
            ) : null}
          </svg>
          <div
            className="mt-4 grid items-end gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/40"
            style={{ gridTemplateColumns: `repeat(${Math.max(xAxisPoints.length, 1)}, minmax(0, 1fr))` }}
          >
            {xAxisPoints.map((point, index) => (
              <span
                key={`${point.date}-${index}`}
                className={cn(
                  "truncate",
                  index === 0 ? "text-left" : index === xAxisPoints.length - 1 ? "text-right" : "text-center"
                )}
              >
                {point.date.slice(5)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}
