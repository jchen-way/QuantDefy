import Link from "next/link";
import { ReactNode } from "react";
import { PublicNavbar } from "@/components/public-navbar";

type AuthShellProps = {
  title: string;
  description: string;
  mode: "login" | "register";
  children: ReactNode;
};

export function AuthShell({ title, description, mode, children }: AuthShellProps) {
  return (
    <main className="min-h-screen bg-[#090d16] text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(241,124,71,0.24),transparent_22%),radial-gradient(circle_at_85%_10%,rgba(60,154,138,0.22),transparent_20%),linear-gradient(180deg,#0b1019_0%,#090d16_100%)]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] [background-size:36px_36px]" />
      <div className="relative">
        <PublicNavbar />
        <div className="mx-auto grid min-h-[calc(100vh-96px)] max-w-7xl items-center gap-10 px-4 py-8 sm:px-6 lg:grid-cols-[1.08fr_0.92fr]">
          <section className="space-y-8">
            <div className="soft-pill inline-flex rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.24em] text-white/60">
              Private cloud journal
            </div>
            <div className="space-y-4">
              <h1 className="max-w-[12ch] text-4xl font-semibold tracking-[-0.065em] text-white sm:text-5xl lg:text-[4.5rem] lg:leading-[0.98]">
                {mode === "login"
                  ? "Return to your trading process with context intact."
                  : "Turn your trading journal into a system you can actually improve."}
              </h1>
              <p className="max-w-xl text-base leading-8 text-white/68 sm:text-lg">
                Calendar-first review, structured trade notes, visual postmortems, and insight loops built for traders who want to correct process drift early.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["Daily P/L map", "Color-coded calendar reveals streaks, drawdowns, and recovery days."],
                ["Setup evidence", "Attach screenshots to winners, losers, and postmortems."],
                ["Weekly coaching", "Surface repeated mistakes before they become habits."]
              ].map(([label, copy]) => (
                <div key={label} className="soft-panel rounded-[1.45rem] p-4">
                  <div className="text-sm font-semibold text-white">{label}</div>
                  <p className="mt-2 text-sm leading-6 text-white/58">{copy}</p>
                </div>
              ))}
            </div>
          </section>
          <section className="soft-panel rounded-[2rem] p-6 shadow-[0_32px_80px_rgba(0,0,0,0.28)] sm:p-8">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <div className="font-mono text-[11px] uppercase tracking-[0.22em] text-white/50">
                  {mode === "login" ? "Login" : "Register"}
                </div>
                <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-white">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-white/64">{description}</p>
              </div>
            </div>
            {children}
            <div className="mt-6 text-sm text-white/64">
              {mode === "login" ? (
                <>
                  Need an account?{" "}
                  <Link href="/register" className="text-white underline underline-offset-4">
                    Create one
                  </Link>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <Link href="/login" className="text-white underline underline-offset-4">
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
