"use client";

import { useEffect, useState } from "react";

/**
 * Shows "⏱ 42s" ticking down to the target. When escalationLevel > 0 the
 * countdown is replaced with a red "ESCALATED" chip.
 */
export function CountdownBadge({
  escalateAt,
  escalationLevel,
}: {
  escalateAt: string | null;
  escalationLevel: number;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);

  if (escalationLevel > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-100 border border-rose-200 rounded-full px-2 py-0.5 animate-pulse">
        ESCALATED → Head coordinator
      </span>
    );
  }
  if (!escalateAt) {
    return null;
  }
  const target = new Date(escalateAt).getTime();
  const remainingMs = target - now;
  if (remainingMs <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-100 border border-rose-200 rounded-full px-2 py-0.5">
        ESCALATING…
      </span>
    );
  }
  const seconds = Math.ceil(remainingMs / 1000);
  const tone =
    seconds <= 10 ? "text-rose-700 bg-rose-50 border-rose-200" :
    seconds <= 30 ? "text-amber-700 bg-amber-50 border-amber-200" :
    "text-slate-700 bg-slate-50 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold rounded-full border px-2 py-0.5 tabular-nums ${tone}`}>
      ⏱ {seconds}s
    </span>
  );
}
