import type { PropsWithChildren } from "react";

export function Card({ children }: PropsWithChildren) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">{children}</div>;
}

export function Label({ children }: PropsWithChildren) {
  return <label className="mb-1 block text-sm font-medium text-slate-700">{children}</label>;
}
