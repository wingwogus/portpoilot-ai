import Link from "next/link";
import type { PropsWithChildren } from "react";

interface MobileShellProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

export function MobileShell({ title, subtitle, children }: MobileShellProps) {
  return (
    <div className="min-h-dvh bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-indigo-600">REASON PROTOTYPE</p>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">{title}</h1>
            {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
          </div>
          <nav aria-label="주요 이동" className="hidden gap-2 md:flex">
            <Link className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100" href="/checkup">
              체크업
            </Link>
            <Link className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100" href="/result?jobId=demo">
              결과
            </Link>
            <Link className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100" href="/briefing?jobId=demo">
              브리핑
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
        <section className="grid grid-cols-1 gap-4 md:gap-6">{children}</section>
      </main>
    </div>
  );
}
