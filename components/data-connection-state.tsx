import { SectionCard } from "@/components/section-card";

type DataConnectionStateProps = {
  title?: string;
  description?: string;
  message: string;
};

export function DataConnectionState({
  title = "Unable to load data right now",
  description = "The page is temporarily unavailable because the database connection did not respond.",
  message
}: DataConnectionStateProps) {
  return (
    <SectionCard title={title} eyebrow="Data connection" description={description}>
      <div className="space-y-3">
        <div className="rounded-[1.25rem] border border-white/10 bg-white/5 px-4 py-3 text-sm leading-6 text-ink">
          Try refreshing the page in a moment. If the issue keeps happening, verify the active `DATABASE_URL`, Neon project status, and network/DNS access from the runtime.
        </div>
        <div className="rounded-[1.25rem] border border-amber-300/12 bg-amber-300/10 px-4 py-3 text-sm leading-6 text-ink">
          {message}
        </div>
      </div>
    </SectionCard>
  );
}
