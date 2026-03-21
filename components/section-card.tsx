import { ReactNode } from "react";
import { cn } from "@/lib/domain/utils";

type SectionCardProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SectionCard({
  title,
  eyebrow,
  description,
  action,
  children,
  className
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-[1.7rem] border border-white/8 bg-[linear-gradient(180deg,rgba(17,24,36,0.7),rgba(11,16,26,0.62))] p-5 shadow-[0_18px_44px_rgba(0,0,0,0.12)] sm:p-6",
        className
      )}
    >
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          {eyebrow ? (
            <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/42">{eyebrow}</div>
          ) : null}
          <div>
            <h2 className="text-lg font-semibold tracking-[-0.04em] text-ink sm:text-[1.35rem]">{title}</h2>
            {description ? <p className="mt-2 max-w-[68ch] text-sm leading-7 text-white/58">{description}</p> : null}
          </div>
        </div>
        {action ? <div>{action}</div> : null}
      </div>
      {children}
    </section>
  );
}
