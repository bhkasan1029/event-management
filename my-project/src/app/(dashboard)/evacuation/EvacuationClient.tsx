"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EventMap } from "@/components/map/EventMap";
import { ZonePolygons, ZonePolygon } from "@/components/map/ZonePolygons";
import { LabeledMarker } from "@/components/map/LabeledMarker";
import { VenueGraphLayer, GraphEdge, GraphNode } from "@/components/map/VenueGraphLayer";
import { EvacuationPlanLayer } from "@/components/map/EvacuationPlanLayer";
import { useLive } from "@/lib/use-live";

// Keep in sync with the palette in EvacuationPlanLayer.
const PATH_COLORS = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];

type EvacPlan = {
  perZone: Array<{
    zoneId: number;
    zoneName: string;
    crowd: number;
    exitNodeId: number;
    exitName: string;
    pathNodeIds: number[];
    pathCoords: Array<{ lat: number; lng: number }>;
    distanceM: number;
  }>;
  unreachable: Array<{ zoneId: number; zoneName: string }>;
};

type ActiveEvacuation = {
  id: number;
  reason: string | null;
  blockedEdgeIds: number[];
  plan: EvacPlan | null;
  createdAt: string;
  status: string;
};

type EvacData = {
  active: ActiveEvacuation | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

export function EvacuationClient({
  center,
  zones,
}: {
  center: { lat: number; lng: number };
  zones: ZonePolygon[];
}) {
  const [data, setData] = useState<EvacData | null>(null);
  const [blocked, setBlocked] = useState<Set<number>>(new Set());
  const [reason, setReason] = useState("Fire alarm — Pandal");
  const [triggering, setTriggering] = useState(false);
  const [plan, setPlan] = useState<EvacPlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/evacuation", { cache: "no-store" });
    if (!res.ok) return;
    const d = (await res.json()) as EvacData;
    setData(d);
    if (d.active) {
      setBlocked(new Set(d.active.blockedEdgeIds));
      setPlan(d.active.plan ?? null);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useLive({ evacuation: () => refresh() });

  const toggleBlocked = (id: number) => {
    setBlocked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setPlan(null);
  };

  const trigger = async () => {
    setTriggering(true); setError(null);
    try {
      const res = await fetch("/api/evacuation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, blockedEdgeIds: Array.from(blocked) }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: "failed" }));
        setError(j.error || "failed");
        return;
      }
      const j = await res.json();
      setPlan(j.plan);
      refresh();
    } finally { setTriggering(false); }
  };

  const endEvacuation = async () => {
    await fetch("/api/evacuation", { method: "DELETE" });
    setPlan(null);
    refresh();
  };

  const exitNodes = useMemo(() => data?.nodes.filter((n) => n.isExit) ?? [], [data]);

  return (
    <div className="-m-6 lg:-m-8 h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-[1fr_380px]">
      <div className="relative h-[50vh] lg:h-full">
        <EventMap center={center}>
          <ZonePolygons zones={zones} muted />
          {data && (
            <VenueGraphLayer
              nodes={data.nodes}
              edges={data.edges}
              blockedIds={blocked}
              onEdgeClick={toggleBlocked}
            />
          )}
          {exitNodes.map((n) => (
            <LabeledMarker
              key={n.id}
              position={{ lat: n.lat, lng: n.lng }}
              background="#059669"
              glyph="→"
              title={n.name ?? "exit"}
            />
          ))}
          {plan && <EvacuationPlanLayer perZone={plan.perZone} />}
        </EventMap>
        <div className="absolute left-4 bottom-4 bg-white/95 backdrop-blur-md px-5 py-4 rounded-xl shadow-xl ring-1 ring-slate-900/5 border border-slate-200 text-sm min-w-[240px]">
          <p className="text-[11px] font-bold uppercase tracking-widest text-rose-700 mb-3 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-600" />
            Evacuation Legend
          </p>
          <ul className="space-y-2">
            <li className="flex items-center gap-3 text-slate-800 font-medium">
              <span
                className="w-5 h-5 rounded-md shrink-0 border-2"
                style={{ background: "#94a3b818", borderColor: "#94a3b8" }}
              />
              Zone area
            </li>
            <li className="flex items-center gap-3 text-slate-800 font-medium">
              <span className="w-6 h-1 rounded-full shrink-0 bg-slate-500" />
              Walkable path
            </li>
            <li className="flex items-center gap-3 text-slate-800 font-medium">
              <span className="w-6 h-1 rounded-full shrink-0 bg-rose-600" style={{ backgroundImage: "repeating-linear-gradient(90deg,#dc2626 0 4px,transparent 4px 7px)" }} />
              Blocked <span className="text-[11px] text-slate-400">(click to toggle)</span>
            </li>
            <li className="flex items-center gap-3 text-slate-800 font-medium">
              <span
                className="w-5 h-5 rounded-full border-2 border-white shadow-md shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                style={{ background: "#059669" }}
              >
                →
              </span>
              Exit
            </li>
          </ul>

          {plan && plan.perZone.length > 0 && (
            <>
              <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500 mt-4 mb-2">
                Active Routes
              </p>
              <ul className="space-y-1.5">
                {plan.perZone.map((z, i) => (
                  <li key={z.zoneId} className="flex items-center gap-3 text-slate-800">
                    <span
                      className="w-6 h-1.5 rounded-full shrink-0"
                      style={{ background: PATH_COLORS[i % PATH_COLORS.length] }}
                    />
                    <span className="font-semibold">{z.zoneName}</span>
                    <span className="text-slate-400">→</span>
                    <span className="text-emerald-700 font-semibold">{z.exitName}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <aside className="bg-white border-l border-slate-200 overflow-y-auto p-5 flex flex-col gap-4">
        <header>
          <h2 className="text-lg font-bold text-slate-900">Evacuation</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Click paths to mark them blocked, then trigger to compute the plan.
          </p>
        </header>

        {data?.active ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
            <p className="text-xs font-bold text-rose-800 uppercase tracking-wider">
              Evacuation active
            </p>
            <p className="text-sm text-rose-900 mt-0.5">{data.active.reason}</p>
            <button
              onClick={endEvacuation}
              className="mt-2 w-full py-1.5 bg-rose-700 hover:bg-rose-800 text-white text-xs font-semibold rounded"
            >
              End evacuation
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
              Reason
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded"
            />
            <p className="text-xs text-slate-500">
              {blocked.size} path{blocked.size === 1 ? "" : "s"} marked blocked
            </p>
            <button
              onClick={trigger}
              disabled={triggering}
              className="w-full py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-bold rounded shadow"
            >
              {triggering ? "Computing plan…" : "⚠ Trigger evacuation"}
            </button>
          </div>
        )}

        {error && (
          <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-1">
            {error}
          </p>
        )}

        {plan && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Per-zone assignments
            </h3>
            {plan.perZone.map((z) => (
              <div key={z.zoneId} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs">
                <p className="font-semibold text-slate-800">
                  {z.zoneName} → <span className="text-emerald-700">{z.exitName}</span>
                </p>
                <p className="text-slate-500">
                  {Math.round(z.distanceM)}m · {z.crowd} people
                </p>
              </div>
            ))}
            {plan.unreachable.length > 0 && (
              <div className="rounded border border-rose-200 bg-rose-50 px-3 py-2 text-xs">
                <p className="font-semibold text-rose-800">Unreachable zones</p>
                <ul className="mt-1 list-disc list-inside text-rose-700">
                  {plan.unreachable.map((u) => <li key={u.zoneId}>{u.zoneName}</li>)}
                </ul>
              </div>
            )}
          </section>
        )}
      </aside>
    </div>
  );
}

