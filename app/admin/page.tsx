import { SectionCard } from "@/components/section-card";
import { WorkspaceShell } from "@/components/workspace-shell";
import { formatDateTime } from "@/lib/domain/utils";
import { isAdminEmail, requireAdminUser } from "@/lib/server/auth";
import {
  getSemanticRefreshPolicy,
  listSemanticRefreshUsageSummaries
} from "@/lib/server/semantic-usage";

function formatWindow(ms: number) {
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes % 1440 === 0) {
    const days = totalMinutes / 1440;
    return `${days} day${days === 1 ? "" : "s"}`;
  }
  if (totalMinutes % 60 === 0) {
    const hours = totalMinutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }
  return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
}

export default async function AdminPage() {
  await requireAdminUser();
  const policy = getSemanticRefreshPolicy();
  const summaries = await listSemanticRefreshUsageSummaries(isAdminEmail);

  return (
    <WorkspaceShell
      currentPath="/admin"
      title="Admin"
      description="Monitor premium semantic refresh usage across accounts and verify the current quota policy."
    >
      <SectionCard
        title="Semantic refresh usage"
        eyebrow="Per user"
        description={`Non-admin users can run ${policy.maxRefreshesPerWindow} premium refreshes every ${formatWindow(policy.windowMs)} with a ${formatWindow(policy.cooldownMs)} cooldown between runs. Admin users bypass those limits.`}
      >
        <div className="overflow-x-auto rounded-[1.35rem] border border-white/10 bg-white/[0.03]">
          <div className="grid min-w-[760px] grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_120px_180px] gap-3 border-b border-white/10 px-4 py-3 text-[11px] uppercase tracking-[0.16em] text-white/42">
            <div>User</div>
            <div>Email</div>
            <div>Count</div>
            <div>Last refresh</div>
          </div>
          <div className="divide-y divide-white/8">
            {summaries.map((item) => (
              <div
                key={item.userId}
                className="grid min-w-[760px] grid-cols-[minmax(0,1.3fr)_minmax(0,1.1fr)_120px_180px] gap-3 px-4 py-3 text-sm text-white/78"
              >
                <div className="min-w-0">
                  <div className="truncate font-medium text-ink">{item.displayName}</div>
                  {item.isAdmin ? (
                    <div className="mt-1 inline-flex rounded-full border border-amber-300/18 bg-amber-300/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100/88">
                      Admin
                    </div>
                  ) : null}
                </div>
                <div className="truncate text-white/62">{item.email}</div>
                <div className="font-semibold text-ink">{item.refreshCount}</div>
                <div className="text-white/62">
                  {item.lastRefreshedAt ? formatDateTime(item.lastRefreshedAt) : "No refreshes"}
                </div>
              </div>
            ))}
            {summaries.length === 0 ? (
              <div className="px-4 py-6 text-sm text-white/58">No users found.</div>
            ) : null}
          </div>
        </div>
      </SectionCard>
    </WorkspaceShell>
  );
}
