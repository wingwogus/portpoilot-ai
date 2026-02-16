import type { PropsWithChildren } from "react";

interface MobileShellProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

export function MobileShell({ title, subtitle, children }: MobileShellProps) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-md bg-slate-50 px-4 pb-8 pt-6 text-slate-900">
      <header className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Reason MVP</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-slate-600">{subtitle}</p> : null}
      </header>
      <section className="space-y-4">{children}</section>
    </main>
  );
}
