"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EventMap } from "@/components/map/EventMap";
import { ZonePolygons, ZonePolygon } from "@/components/map/ZonePolygons";
import { LabeledMarker } from "@/components/map/LabeledMarker";
import { RouteLine } from "@/components/map/RouteLine";
import { CountdownBadge } from "@/components/incidents/CountdownBadge";
import { useLive } from "@/lib/use-live";

type Issue = {
  id: number;
  type: "medical" | "crowd" | "equipment" | "other";
  status: "open" | "acknowledged" | "resolved";
  description: string | null;
  lat: number | null;
  lng: number | null;
  zone: { id: number; name: string } | null;
  reportedBy: { id: number; name: string } | null;
  assignedTo: { id: number; name: string; role: string } | null;
  ambulance: { id: number; label: string } | null;
  escalationLevel: number;
  createdAt: string;
  acknowledgedAt: string | null;
  escalateAt: string | null;
  route: {
    ambulanceLabel?: string;
    from?: { lat: number; lng: number };
    to?: { lat: number; lng: number };
    path?: Array<{ lat: number; lng: number }>;
    distanceMeters?: number;
    durationSeconds?: number;
  } | null;
};

const TYPE_COLOR: Record<Issue["type"], string> = {
  medical: "#dc2626",
  crowd: "#d97706",
  equipment: "#2563eb",
  other: "#64748b",
};

export function IssuesClient({
  center,
  zones,
  currentUserId,
}: {
  center: { lat: number; lng: number };
  zones: ZonePolygon[];
  currentUserId: number;
}) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [reporting, setReporting] = useState<{ type: Issue["type"]; lat?: number; lng?: number; zoneId?: number; description: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/issues", { cache: "no-store" });
    if (res.ok) setIssues(await res.json());
  }, []);

  useEffect(() => {
    refresh();
    // Poll every second to drive countdown + pick up server-side escalations.
    const t = setInterval(refresh, 1_000);
    return () => clearInterval(t);
  }, [refresh]);

  useLive({ issues: () => refresh() });

  const activeMedicalRoute = useMemo(() => {
    const live = issues.find(
      (i) => i.type === "medical" && i.status !== "resolved" && i.route?.path?.length,
    );
    return live?.route;
  }, [issues]);

  const createIssue = async (payload: {
    type: Issue["type"]; description: string; zoneId?: number; lat?: number; lng?: number;
  }) => {
    setError(null);
    const endpoint = payload.type === "medical" && payload.lat != null && payload.lng != null
      ? "/api/injury"
      : "/api/issues";
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "failed" }));
      setError(j.error || "failed");
      return;
    }
    setReporting(null);
    refresh();
  };

  const ack = async (id: number) => {
    await fetch(`/api/issues/${id}/ack`, { method: "POST" });
    refresh();
  };
  const resolve = async (id: number) => {
    await fetch(`/api/issues/${id}/resolve`, { method: "POST" });
    refresh();
  };

  return (
    <div className="-m-6 lg:-m-8 h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-[1fr_420px]">
      <div className="relative h-[50vh] lg:h-full">
        <EventMap
          center={center}
          onClick={(e) => {
            if (!reporting) return;
            const latLng = e.detail.latLng;
            if (!latLng) return;
            setReporting({ ...reporting, lat: latLng.lat, lng: latLng.lng });
          }}
        >
          <ZonePolygons zones={zones} />
          {issues.map((i) =>
            i.lat != null && i.lng != null ? (
              <LabeledMarker
                key={i.id}
                position={{ lat: i.lat, lng: i.lng }}
                background={TYPE_COLOR[i.type]}
                glyph={i.type[0].toUpperCase()}
                title={`${i.type} · ${i.description ?? ""}`}
              />
            ) : null,
          )}
          {activeMedicalRoute?.from && (
            <LabeledMarker position={activeMedicalRoute.from} background="#0ea5e9" glyph="A" title={activeMedicalRoute.ambulanceLabel} />
          )}
          {activeMedicalRoute?.path && <RouteLine path={activeMedicalRoute.path} color="#dc2626" />}
          {reporting?.lat && reporting?.lng && (
            <LabeledMarker position={{ lat: reporting.lat, lng: reporting.lng }} background="#f59e0b" glyph="?" title="Pending issue" />
          )}
        </EventMap>
        <div className="absolute left-3 top-3 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow border border-slate-200 text-xs flex items-center gap-3">
          <LegendDot color="#dc2626" label="medical" />
          <LegendDot color="#d97706" label="crowd" />
          <LegendDot color="#2563eb" label="equipment" />
          <LegendDot color="#0ea5e9" label="ambulance" />
        </div>
        {reporting && (
          <div className="absolute right-3 top-3 bg-white px-3 py-2 rounded-lg shadow border border-amber-300 text-xs text-amber-800 max-w-xs">
            Click the map to drop the location pin, then submit the form →
          </div>
        )}
      </div>

      <aside className="bg-white border-l border-slate-200 overflow-y-auto p-5 flex flex-col gap-4">
        <header>
          <h2 className="text-lg font-bold text-slate-900">Issues</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Routed to zone lead first — escalates to head coordinator after 60s.
          </p>
        </header>

        {!reporting ? (
          <div className="grid grid-cols-2 gap-2">
            {(["medical", "crowd", "equipment", "other"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setReporting({ type: t, description: "" })}
                className="rounded-lg border px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90"
                style={{ background: TYPE_COLOR[t] }}
              >
                + {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        ) : (
          <ReportForm
            draft={reporting}
            zones={zones}
            onCancel={() => setReporting(null)}
            onChange={(patch) => setReporting({ ...reporting, ...patch })}
            onSubmit={() => createIssue(reporting)}
          />
        )}

        {error && (
          <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-1">{error}</p>
        )}

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Live incidents ({issues.length})
          </h3>
          {issues.length === 0 && (
            <p className="text-xs text-slate-400 italic">All quiet — no open issues.</p>
          )}
          {issues.map((i) => (
            <IssueCard
              key={i.id}
              issue={i}
              currentUserId={currentUserId}
              onAck={() => ack(i.id)}
              onResolve={() => resolve(i.id)}
            />
          ))}
        </section>
      </aside>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-slate-700">
      <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} /> {label}
    </span>
  );
}

function ReportForm({
  draft,
  zones,
  onChange,
  onCancel,
  onSubmit,
}: {
  draft: { type: Issue["type"]; description: string; zoneId?: number; lat?: number; lng?: number };
  zones: ZonePolygon[];
  onChange: (p: Partial<typeof draft>) => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const needsLocation = draft.type === "medical";
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
      className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-600">
          New {draft.type} issue
        </span>
        <button type="button" onClick={onCancel} className="text-xs text-slate-500 hover:text-slate-800">
          Cancel
        </button>
      </div>
      <textarea
        value={draft.description}
        onChange={(e) => onChange({ description: e.target.value })}
        placeholder="Describe what's happening"
        rows={2}
        className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded"
      />
      <select
        value={draft.zoneId ?? ""}
        onChange={(e) => onChange({ zoneId: e.target.value ? Number(e.target.value) : undefined })}
        className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded"
      >
        <option value="">— Pick zone (optional) —</option>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>{z.name}</option>
        ))}
      </select>
      {needsLocation && (
        <p className="text-[11px] text-slate-500">
          {draft.lat != null
            ? `Location pinned: ${draft.lat.toFixed(5)}, ${draft.lng!.toFixed(5)}`
            : "Click the map to drop the injury pin (required for medical)."}
        </p>
      )}
      <button
        type="submit"
        disabled={needsLocation && draft.lat == null}
        className="w-full py-1.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded"
      >
        Submit
      </button>
    </form>
  );
}

function IssueCard({
  issue,
  currentUserId,
  onAck,
  onResolve,
}: {
  issue: Issue;
  currentUserId: number;
  onAck: () => void;
  onResolve: () => void;
}) {
  const assignedToMe = issue.assignedTo?.id === currentUserId;
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold text-white shrink-0"
            style={{ background: TYPE_COLOR[issue.type] }}
          >
            {issue.type[0].toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">
              #{issue.id} · {issue.type}
              {issue.zone && <span className="text-slate-400 font-normal"> · {issue.zone.name}</span>}
            </p>
            <p className="text-xs text-slate-500 truncate">{issue.description ?? "(no description)"}</p>
          </div>
        </div>
        <CountdownBadge escalateAt={issue.escalateAt} escalationLevel={issue.escalationLevel} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
        <span>
          {issue.assignedTo ? `Assigned → ${issue.assignedTo.name}` : "Unassigned"}
          {issue.ambulance && ` · ${issue.ambulance.label}`}
        </span>
        <span className="font-mono">{new Date(issue.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {issue.status === "open" && (
          <button
            onClick={onAck}
            className={`text-xs font-semibold px-2 py-1 rounded ${assignedToMe ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            {assignedToMe ? "Acknowledge" : "Take on"}
          </button>
        )}
        {issue.status === "acknowledged" && (
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
            Acknowledged
          </span>
        )}
        <button
          onClick={onResolve}
          className="text-xs font-semibold text-slate-500 hover:text-slate-900 ml-auto"
        >
          Resolve
        </button>
      </div>
    </div>
  );
}
