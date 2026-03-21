import { ReactNode } from "react";
import { cn } from "@/lib/domain/utils";

type StatCardProps = {
  label: string;
  value: string;
  detail?: string;
  accent?: "green" | "red" | "gold" | "neutral";
  icon?: ReactNode;
};

export function StatCard({ label, value, detail, accent = "neutral", icon }: StatCardProps) {
  return (
    <div className="rounded-[1.55rem] border border-white/8 bg-[rgba(255,255,255,0.035)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/42">{label}</div>
        {icon ? <div className="text-muted">{icon}</div> : null}
      </div>
      <div
        className={cn(
          "text-[2rem] font-semibold tracking-[-0.06em] sm:text-[2.35rem]",
          accent === "green" && "metric-positive",
          accent === "red" && "metric-negative",
          accent === "gold" && "text-gold",
          accent === "neutral" && "text-ink"
        )}
      >
        {value}
      </div>
      {detail ? <p className="mt-2 text-sm leading-6 text-white/54">{detail}</p> : null}
    </div>
  );
}
