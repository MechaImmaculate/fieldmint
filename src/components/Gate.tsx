import type { ReactNode } from "react";

export default function Gate({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border-low bg-card p-8 text-center shadow-sm">
      <h1 className="text-xl font-bold">{title}</h1>
      <p className="mb-4 mt-2 text-sm text-muted">{text}</p>
      {children}
    </div>
  );
}