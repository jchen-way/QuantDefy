import Link from "next/link";

const publicLinks = [
  { href: "/#product", label: "Product" },
  { href: "/#features", label: "Features" },
  { href: "/#insights", label: "Insights" },
  { href: "/#faq", label: "FAQ" }
];

export function PublicNavbar() {
  return (
    <header className="sticky top-0 z-30 px-4 pt-4 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 rounded-[1.8rem] border border-white/10 bg-[rgba(7,10,18,0.72)] px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center justify-between gap-3 lg:flex-1">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[radial-gradient(circle_at_top,#ffb86b,#7a4c22)] text-sm font-semibold text-[#0a0e16]">
              QD
            </div>
            <div className="min-w-0 max-w-[11.5rem] sm:max-w-none">
              <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/55">QuantDefy</div>
              <div className="mt-0.5 text-[11px] leading-4 text-white/58 sm:mt-0 sm:whitespace-nowrap sm:text-[12px] sm:font-medium sm:tracking-[0.01em]">
                Review with an edge
              </div>
            </div>
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-11 flex-none items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/8 lg:hidden"
          >
            Login
          </Link>
        </div>
        <nav className="hidden items-center gap-1 lg:flex">
          {publicLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm text-white/68 transition hover:bg-white/6 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-[auto_minmax(0,1fr)] lg:flex lg:w-auto lg:flex-none lg:items-center">
          <Link
            href="/login"
            className="hidden min-h-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/8 lg:inline-flex"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(135deg,#f4b268,#f17c47)] px-5 py-2.5 text-sm font-semibold text-[#0a0e16] shadow-[0_10px_28px_rgba(241,124,71,0.22)] transition hover:translate-y-[-1px]"
          >
            Start journaling
          </Link>
        </div>
      </div>
    </header>
  );
}
