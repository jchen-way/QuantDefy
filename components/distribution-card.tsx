import { SectionCard } from "@/components/section-card";
import { DistributionDatum } from "@/lib/domain/types";
import { toCurrency } from "@/lib/domain/utils";

type DistributionCardProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  items: DistributionDatum[];
};

export function DistributionCard({
  title,
  eyebrow,
  description,
  items
}: DistributionCardProps) {
  const maxValue = Math.max(...items.map((item) => item.value), 1);

  return (
    <SectionCard title={title} eyebrow={eyebrow} description={description}>
      {items.length === 0 ? (
        <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-8 text-sm leading-6 text-muted">
          No matching data in the current view yet. Change the filters or log more trades to populate this distribution.
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-end justify-between gap-4 text-sm">
                <div className="pr-3 text-[15px] font-medium tracking-[-0.02em] text-ink">{item.label}</div>
                <div className="shrink-0 text-right text-white/52">
                  <span className="font-mono text-[12px] tracking-[0.08em]">{item.value}</span>
                  <span className="ml-4 font-mono text-[12px] tracking-[0.08em]">{toCurrency(item.realizedPl)}</span>
                </div>
              </div>
              <div className="h-[5px] overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(245,188,117,0.88),rgba(226,120,71,0.92))]"
                  style={{
                    width: `${Math.max((item.value / maxValue) * 100, 8)}%`
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}
