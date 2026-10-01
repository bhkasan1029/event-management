"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EventMap } from "@/components/map/EventMap";
import { ZonePolygons, ZonePolygon } from "@/components/map/ZonePolygons";
import { LabeledMarker } from "@/components/map/LabeledMarker";
import { useLive } from "@/lib/use-live";

type Ambulance = { id: number; label: string; lat: number | null; lng: number | null; status: string | null };

// Shared with ZonePolygons — keep in sync.
const TYPE_COLOR: Record<string, string> = {
  stage: "#9333ea",
  gate: "#2563eb",
  first_aid: "#dc2626",
  parking: "#0891b2",
  food: "#d97706",
  other: "#64748b",
};

const TYPE_LABEL: Record<string, string> = {
  stage: "Pandal / Stage",
  gate: "Entry Gate",
  first_aid: "First Aid",
  parking: "Parking",
  food: "Food Court",
  other: "Other",
};

const TYPE_GLYPH: Record<string, string> = {
  gate: "G",
  first_aid: "+",
  food: "F",
  other: "·",
};

// Which zone types are drawn as polygons vs. a single pin.
const POLYGON_TYPES = new Set(["stage", "parking"]);

function centroid(poly: Array<{ lat: number; lng: number }>) {
  if (!poly.length) return null;
  const lat = poly.reduce((s, p) => s + p.lat, 0) / poly.length;
  const lng = poly.reduce((s, p) => s + p.lng, 0) / poly.length;
  return { lat, lng };
}

export function LiveMapClient({
  center,
  zones,
  venue,
}: {
  center: { lat: number; lng: number };
  zones: ZonePolygon[];
  venue: string | null;
}) {
  const [ambulances, setAmbulances] = useState<Ambulance[]>([]);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/ambulances", { cache: "no-store" });
    if (res.ok) setAmbulances(await res.json());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useLive({ ambulances: () => refresh() });

  const polygonZones = useMemo(() => zones.filter((z) => POLYGON_TYPES.has(z.type)), [zones]);
  const pinZones = useMemo(
    () =>
      zones
        .filter((z) => !POLYGON_TYPES.has(z.type))
        .map((z) => ({ ...z, pin: centroid(z.polygon) }))
        .filter((z): z is typeof z & { pin: { lat: number; lng: number } } => z.pin != null),
    [zones],
  );

  // Legend only shows types actually present on the map, plus ambulance states.
  const presentTypes = Array.from(new Set(zones.map((z) => z.type)));

  return (
    <div className="-m-6 lg:-m-8 h-[calc(100vh-4rem)] relative">
      <EventMap center={center}>
        <ZonePolygons zones={polygonZones} />
        {pinZones.map((z) => (
          <LabeledMarker
            key={z.id}
            position={z.pin}
            background={TYPE_COLOR[z.type] ?? TYPE_COLOR.other}
            glyph={TYPE_GLYPH[z.type] ?? z.name[0]?.toUpperCase() ?? "·"}
            title={`${z.name} · ${TYPE_LABEL[z.type] ?? z.type}`}
          />
        ))}
        {ambulances.map((a) =>
          a.lat != null && a.lng != null ? (
            <LabeledMarker
              key={a.id}
              position={{ lat: a.lat, lng: a.lng }}
              background={a.status === "dispatched" ? "#dc2626" : "#0ea5e9"}
              glyph="A"
              title={`${a.label} · ${a.status}`}
            />
          ) : null,
        )}
      </EventMap>

      <div className="absolute left-4 top-4 bg-white/95 backdrop-blur px-4 py-3 rounded-lg shadow border border-slate-200 max-w-xs">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">Lalbaugcha Raja</p>
        <p className="text-sm text-slate-900 font-semibold">{venue}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
          {zones.map((z) => (
            <span key={z.id} className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700">
              {z.name}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute left-4 bottom-4 bg-white/95 backdrop-blur-md px-5 py-4 rounded-xl shadow-xl ring-1 ring-slate-900/5 border border-slate-200 text-sm min-w-[220px]">
        <p className="text-[11px] font-bold uppercase tracking-widest text-teal-700 mb-3 flex items-center gap-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-teal-600" />
          Map Legend
        </p>
        <ul className="space-y-2">
          {presentTypes.map((t) => (
            <li key={t} className="flex items-center gap-3 text-slate-800 font-medium">
              {POLYGON_TYPES.has(t) ? (
                <span
                  className="w-5 h-5 rounded-md border-2 border-white shadow-md shrink-0"
                  style={{
                    background: `${TYPE_COLOR[t] ?? TYPE_COLOR.other}26`,
                    borderColor: TYPE_COLOR[t] ?? TYPE_COLOR.other,
                  }}
                />
              ) : (
                <span
                  className="w-5 h-5 rounded-full border-2 border-white shadow-md shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ background: TYPE_COLOR[t] ?? TYPE_COLOR.other }}
                >
                  {TYPE_GLYPH[t] ?? ""}
                </span>
              )}
              <span className="flex-1">{TYPE_LABEL[t] ?? t}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                {POLYGON_TYPES.has(t) ? "area" : "pin"}
              </span>
            </li>
          ))}
          <li className="pt-2 mt-1 border-t border-slate-200 flex items-center gap-3 text-slate-800 font-medium">
            <span
              className="w-5 h-5 rounded-full border-2 border-white shadow-md shrink-0 flex items-center justify-center text-[10px] font-bold text-white"
              style={{ background: "#0ea5e9" }}
            >
              A
            </span>
            Ambulance · <span className="text-sky-700">available</span>
          </li>
          <li className="flex items-center gap-3 text-slate-800 font-medium">
            <span
              className="w-5 h-5 rounded-full border-2 border-white shadow-md shrink-0 flex items-center justify-center text-[10px] font-bold text-white animate-pulse"
              style={{ background: "#dc2626" }}
            >
              A
            </span>
            Ambulance · <span className="text-rose-700">dispatched</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
