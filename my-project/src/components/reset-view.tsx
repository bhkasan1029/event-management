"use client";

import { useState } from "react";

export function ResetView({ children }: { children: React.ReactNode }) {
  const [cleared, setCleared] = useState(false);

  return (
    <>
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setCleared((c) => !c)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-xs font-medium transition-colors"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
          {cleared ? "Show" : "Reset view"}
        </button>
      </div>
      {!cleared && children}
    </>
  );
}
