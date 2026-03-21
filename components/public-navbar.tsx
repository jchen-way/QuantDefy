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
      <div className="mx-auto flex max-w-7xl items-center justify-between rounded-[1.8rem] border border-white/10 bg-[rgba(7,10,18,0.72)] px-4 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.18)] backdrop-blur-xl sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[rgba(255,255,255,0.12)] bg-[radial-gradient(circle_at_top,#ffb86b,#7a4c22)] text-sm font-semibold text-[#0a0e16]">
            QD
          </div>
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/55">QuantDefy</div>
            <div className="whitespace-nowrap text-[12px] font-medium tracking-[0.01em] text-white/58">
              Review with an edge
            </div>
          </div>
        </Link>
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
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/85 transition hover:bg-white/8"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-[linear-gradient(135deg,#f4b268,#f17c47)] px-4 py-2 text-sm font-semibold text-[#0a0e16] shadow-[0_10px_28px_rgba(241,124,71,0.22)] transition hover:translate-y-[-1px]"
          >
            Start journaling
          </Link>
        </div>
      </div>
    </header>
  );
}
