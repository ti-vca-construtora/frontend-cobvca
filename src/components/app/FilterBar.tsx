import type { ReactNode } from "react";

export function FilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end gap-3 p-4 rounded-md border bg-card">
      {children}
    </div>
  );
}
