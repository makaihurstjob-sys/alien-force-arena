import type { ReactNode } from "react";

/** A Windows 3.1-style beveled window frame with a title bar. */
export function RetroFrame({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-2 border-panel-shadow bg-panel shadow-panel ${className}`}>
      <div className="flex items-center justify-between bg-titlebar px-2 py-1 font-mono text-xs font-bold uppercase tracking-widest text-titlebar-foreground">
        <span>{title}</span>
        <span className="flex gap-1" aria-hidden>
          <span className="inline-block h-3 w-3 border border-panel-shadow bg-panel" />
          <span className="inline-block h-3 w-3 border border-panel-shadow bg-panel" />
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
