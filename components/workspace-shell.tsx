import Link from "next/link";
import { ReactNode } from "react";
import { logoutAction } from "@/app/auth/actions";
import { getCurrentUser, isAdminUser } from "@/lib/server/auth";
import { cn } from "@/lib/domain/utils";

const baseNavigation = [
  { href: "/app", label: "Overview", short: "OV" },
  { href: "/trades", label: "Trades", short: "TR" },
  { href: "/analytics", label: "Analytics", short: "AN" },
  { href: "/insights", label: "Insights", short: "IN" },
  { href: "/settings", label: "Settings", short: "ST" }
];

type WorkspaceShellProps = {
  title: string;
  description: string;
  currentPath: string;
  actions?: ReactNode;
  children: ReactNode;
};

function getNavigationLinkClass(active: boolean) {
  return cn(
    "flex items-center gap-3 rounded-[1.35rem] px-4 py-3.5 text-sm font-medium transition",
    active
      ? "bg-[linear-gradient(135deg,rgba(244,178,104,0.18),rgba(241,124,71,0.22))] text-white ring-1 ring-[rgba(255,255,255,0.08)]"
      : "text-white/66 hover:bg-white/6 hover:text-white"
  );
}

function getMobileNavigationLinkClass(active: boolean) {
  return cn(
    "rounded-full px-4 py-2 text-sm transition",
    active
      ? "bg-[linear-gradient(135deg,#f5bc75,#e27847)] text-[#091019] shadow-[0_10px_30px_rgba(241,124,71,0.22)]"
      : "border border-white/10 bg-white/[0.045] text-white/68 hover:bg-white/10 hover:text-white"
  );
}

export async function WorkspaceShell({
  title,
  description,
  currentPath,
  actions,
  children
}: WorkspaceShellProps) {
  const user = await getCurrentUser();
  const isAdmin = isAdminUser(user);
  const navigation = isAdmin
    ? [...baseNavigation, { href: "/admin", label: "Admin", short: "AD" }]
    : baseNavigation;

  return (
    <main className="min-h-screen bg-[#091019] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(241,124,71,0.16),transparent_18%),radial-gradient(circle_at_88%_6%,rgba(62,148,132,0.18),transparent_20%),linear-gradient(180deg,#0a111c_0%,#091019_100%)]" />
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="relative flex min-h-screen flex-col lg:flex-row">
        <aside className="border-b border-white/8 bg-[rgba(7,10,18,0.82)] px-4 py-4 backdrop-blur-2xl lg:min-h-screen lg:w-[292px] lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <Link href="/" className="min-w-0 flex flex-1 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.25rem] border border-white/10 bg-[linear-gradient(135deg,#f5bc75,#e27847)] text-sm font-semibold text-[#091019]">
                QD
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-mono text-[11px] uppercase tracking-[0.24em] text-white/48">QuantDefy</div>
                <div
                  className={cn(
                    "mt-1 whitespace-nowrap text-[12px] font-medium tracking-[0.01em] text-white/52",
                    isAdmin ? "text-[11px]" : ""
                  )}
                >
                  Review with an edge
                </div>
                {isAdmin ? (
                  <div className="mt-1 inline-flex rounded-full border border-amber-300/18 bg-amber-300/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100/88">
                    Admin
                  </div>
                ) : null}
              </div>
            </Link>
            <form action={logoutAction} className="shrink-0 self-start">
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-[12px] font-medium text-white/46 transition hover:text-white/78"
              >
                <span aria-hidden="true" className="text-white/34">
                  ↗
                </span>
                Log out
              </button>
            </form>
          </div>

          <nav className="mt-7 hidden gap-2.5 lg:grid">
            {navigation.map((item) => {
              const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={getNavigationLinkClass(active)}
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 font-mono text-[11px] uppercase tracking-[0.16em] text-white/82">
                    {item.short}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-7 hidden lg:block">
            <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.035] px-4 py-4">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/42">Review rhythm</div>
              <div className="mt-4 space-y-3">
                {[
                  ["Morning", "Prep levels and thesis."],
                  ["Close", "Tag mistakes and attach screenshots."],
                  ["Weekend", "Compare setups, size, and hold duration."]
                ].map(([label, copy]) => (
                  <div key={label} className="border-l border-white/10 pl-3">
                    <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/45">{label}</div>
                    <div className="mt-1 text-sm leading-6 text-white/72">{copy}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <section className="flex-1 p-4 sm:p-5 lg:p-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-5">
            <div className="rounded-[2rem] border border-white/8 bg-[rgba(10,14,22,0.74)] p-4 backdrop-blur-2xl sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-4">
                  <div>
                    <h1 className="text-3xl font-semibold tracking-[-0.06em] text-white sm:text-4xl">{title}</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-7 text-white/62 sm:text-base">{description}</p>
                  </div>
                </div>
                {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-2 lg:hidden">
                {navigation.map((item) => {
                  const active = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={`${item.href}-top`}
                      href={item.href}
                      className={getMobileNavigationLinkClass(active)}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}
