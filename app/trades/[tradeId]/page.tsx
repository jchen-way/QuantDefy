import { notFound } from "next/navigation";
import { AttachmentGallery } from "@/components/attachment-gallery";
import { DeleteTradeButton } from "@/components/delete-trade-button";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { TradeForm } from "@/components/trade-form";
import { WorkspaceShell } from "@/components/workspace-shell";
import { computeTradeMetrics } from "@/lib/domain/analytics";
import { buildTradeInsight } from "@/lib/domain/insights";
import { requireCurrentUser } from "@/lib/server/auth";
import { durationBucketLabel, formatDateTime, formatDuration, toCurrency, toDecimal, toPercent } from "@/lib/domain/utils";
import { getInsightReports, getSettings, getTrade } from "@/lib/server/store";

type TradeDetailPageProps = {
  params: Promise<{
    tradeId: string;
  }>;
};

export default async function TradeDetailPage({ params }: TradeDetailPageProps) {
  const { tradeId } = await params;
  const user = await requireCurrentUser();
  const [trade, settings, insights] = await Promise.all([
    getTrade(tradeId, user.id),
    getSettings(user.id),
    getInsightReports(user.id)
  ]);

  if (!trade) {
    notFound();
  }

  const metrics = computeTradeMetrics(trade, settings.timezone);
  const insight = insights.find((report) => report.scope === "trade" && report.scopeKey === trade.id) ?? buildTradeInsight(trade, metrics);

  return (
    <WorkspaceShell
      currentPath="/trades"
      title={`${trade.symbol} review`}
      description="Edit the journal record and compare the actual execution with the deterministic metrics and generated coaching summary."
      actions={<DeleteTradeButton tradeId={trade.id} />}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Realized P/L"
          value={trade.status === "closed" ? toCurrency(metrics.realizedPl) : "Open"}
          accent={trade.status === "open" ? "gold" : metrics.realizedPl >= 0 ? "green" : "red"}
        />
        <StatCard
          label="R multiple"
          value={toDecimal(metrics.rMultiple)}
          detail={`${durationBucketLabel(metrics.durationBucket)}${metrics.holdingMinutes !== null ? ` · ${formatDuration(metrics.holdingMinutes)}` : ""}`}
          accent="gold"
        />
        <StatCard label="Return on capital" value={toPercent(metrics.returnOnCapitalPct)} detail={`Max capital ${toCurrency(metrics.maxCapitalUsed)}`} accent="green" />
        <StatCard label="Trade status" value={trade.status.toUpperCase()} detail={`Opened ${formatDateTime(trade.openedAt)}`} accent="neutral" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          title={insight.title}
          eyebrow="Review takeaway"
          description={insight.summary}
        >
          <div className="space-y-3">
            {insight.bullets.map((bullet) => (
              <div key={bullet} className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-ink">
                {bullet}
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Execution snapshot"
          eyebrow="Review"
          description="A compact summary of why the trade happened and how it was managed."
        >
          <div className="space-y-4 text-sm leading-6 text-ink">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Thesis</div>
              <p>{trade.thesis}</p>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Entry</div>
              <p>{trade.reasonForEntry}</p>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Exit</div>
              <p>{trade.reasonForExit || "Still open."}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Attached setups and postmortems"
        eyebrow="Media"
        description="Review the visual evidence directly alongside the journal record."
      >
        <AttachmentGallery tradeId={trade.id} attachments={trade.attachments} />
      </SectionCard>

      <TradeForm
        trade={trade}
        defaultRisk={settings.defaultRisk}
        timezone={settings.timezone}
        customTradeTypes={settings.customTradeTypes}
        customSetupTypes={settings.customSetupTypes}
      />
    </WorkspaceShell>
  );
}
