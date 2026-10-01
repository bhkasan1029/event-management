"use client";

import { useCallback, useEffect, useState } from "react";
import { EventMap } from "@/components/map/EventMap";
import { ZonePolygons, ZonePolygon } from "@/components/map/ZonePolygons";
import { ParkingSpotMarkers, ParkingSpotDTO } from "@/components/map/ParkingSpotMarkers";
import { useLive } from "@/lib/use-live";

type ParkingData = {
  counts: { total: number; occupied: number; reserved: number; free: number; vip: number };
  spots: ParkingSpotDTO[];
  reservations: Array<{
    id: number;
    guestName: string;
    plate: string | null;
    spotId: number | null;
    expectedArrival: string | null;
    status: string;
  }>;
};

export function ParkingClient({
  center,
  zones,
}: {
  center: { lat: number; lng: number };
  zones: ZonePolygon[];
}) {
  const [data, setData] = useState<ParkingData | null>(null);
  const [selected, setSelected] = useState<ParkingSpotDTO | null>(null);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [addingVip, setAddingVip] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/parking", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useLive({ parking: () => refresh() });

  const addVehicle = async (plate: string, ownerName: string, spotLabel: string) => {
    setError(null);
    const res = await fetch("/api/parking/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plate, ownerName, spotLabel: spotLabel || undefined }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "failed" }));
      setError(j.error || "failed");
      return;
    }
    setAddingVehicle(false);
  };

  const removeVehicle = async (id: number) => {
    await fetch(`/api/parking/vehicles?id=${id}`, { method: "DELETE" });
  };

  const addVip = async (guestName: string, plate: string, when: string) => {
    setError(null);
    const res = await fetch("/api/parking/vip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ guestName, plate, expectedArrival: when || null }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({ error: "failed" }));
      setError(j.error || "failed");
      return;
    }
    setAddingVip(false);
  };

  const counts = data?.counts;

  return (
    <div className="-m-6 lg:-m-8 h-[calc(100vh-4rem)] grid grid-cols-1 lg:grid-cols-[1fr_380px]">
      <div className="relative h-[50vh] lg:h-full">
        <EventMap center={center}>
          <ZonePolygons zones={zones} />
          {data && <ParkingSpotMarkers spots={data.spots} onSelect={setSelected} />}
        </EventMap>
        <div className="absolute left-3 top-3 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow border border-slate-200 text-xs flex items-center gap-3">
          <LegendDot color="#16a34a" label="free" />
          <LegendDot color="#dc2626" label="occupied" />
          <LegendDot color="#2563eb" label="VIP reserved" />
          <LegendDot color="#7c3aed" label="VIP free" />
        </div>
      </div>

      <aside className="bg-white border-l border-slate-200 overflow-y-auto p-5 flex flex-col gap-5">
        <header>
          <h2 className="text-lg font-bold text-slate-900">Parking</h2>
          <p className="text-xs text-slate-500 mt-0.5">Lalbaugcha Raja · Lot A</p>
        </header>

        {counts && (
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Free" value={counts.free} tone="green" />
            <StatCard label="Occupied" value={counts.occupied} tone="red" />
            <StatCard label="VIP held" value={counts.reserved} tone="blue" />
            <StatCard label="Total" value={counts.total} tone="slate" />
          </div>
        )}

        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Add vehicle
            </h3>
            <button
              onClick={() => setAddingVehicle((v) => !v)}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              {addingVehicle ? "Cancel" : "+ New"}
            </button>
          </div>
          {addingVehicle && <VehicleForm onSubmit={addVehicle} />}
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              VIP reservations
            </h3>
            <button
              onClick={() => setAddingVip((v) => !v)}
              className="text-xs font-semibold text-teal-700 hover:underline"
            >
              {addingVip ? "Cancel" : "+ Reserve"}
            </button>
          </div>
          {addingVip && <VipForm onSubmit={addVip} />}
          <ul className="mt-2 space-y-1.5">
            {data?.reservations.map((r) => (
              <li key={r.id} className="text-xs flex items-center justify-between py-1 px-2 rounded bg-blue-50 border border-blue-100">
                <div>
                  <p className="font-semibold text-slate-800">{r.guestName}</p>
                  <p className="text-slate-500">
                    {r.plate ?? "no plate"} ·{" "}
                    {r.expectedArrival ? new Date(r.expectedArrival).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "any time"}
                  </p>
                </div>
                <span className="text-[10px] font-semibold text-blue-700 uppercase">{r.status}</span>
              </li>
            ))}
            {!data?.reservations.length && <li className="text-xs text-slate-400 italic">None today</li>}
          </ul>
        </section>

        {selected && (
          <section className="border-t border-slate-200 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Spot {selected.label}
            </h3>
            <p className="text-sm text-slate-700">
              {selected.status === "free" ? "Available" : selected.status === "occupied" ? `Occupied by ${selected.plate}` : `Reserved for ${selected.reservedFor}`}
            </p>
            {selected.status === "occupied" && selected.vehicleId != null && (
              <button
                className="mt-2 text-xs font-semibold text-rose-600 hover:underline"
                onClick={async () => {
                  await removeVehicle(selected.vehicleId!);
                  setSelected(null);
                }}
              >
                Mark as exited
              </button>
            )}
          </section>
        )}

        {error && (
          <p className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded px-2 py-1">
            {error}
          </p>
        )}
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

function StatCard({ label, value, tone }: { label: string; value: number; tone: "green" | "red" | "blue" | "slate" }) {
  const classes = {
    green: "bg-emerald-50 border-emerald-100 text-emerald-800",
    red: "bg-rose-50 border-rose-100 text-rose-800",
    blue: "bg-blue-50 border-blue-100 text-blue-800",
    slate: "bg-slate-50 border-slate-200 text-slate-700",
  }[tone];
  return (
    <div className={`rounded-lg border px-3 py-2 ${classes}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  );
}

function VehicleForm({ onSubmit }: { onSubmit: (plate: string, owner: string, spotLabel: string) => Promise<void> }) {
  const [plate, setPlate] = useState("");
  const [owner, setOwner] = useState("");
  const [spotLabel, setSpotLabel] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
          await onSubmit(plate, owner, spotLabel);
          setPlate(""); setOwner(""); setSpotLabel("");
        } finally {
          setSubmitting(false);
        }
      }}
      className="space-y-1.5"
    >
      <input value={plate} onChange={(e) => setPlate(e.target.value)} required placeholder="Plate (MH-01-AB-1234)" className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded" />
      <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Owner name (optional)" className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded" />
      <input value={spotLabel} onChange={(e) => setSpotLabel(e.target.value.toUpperCase())} placeholder="Spot label (e.g. B4) — blank for next free" className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded" />
      <button disabled={submitting} type="submit" className="w-full py-1.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-semibold rounded">
        {submitting ? "Adding…" : "Add vehicle"}
      </button>
    </form>
  );
}

function VipForm({ onSubmit }: { onSubmit: (guest: string, plate: string, when: string) => Promise<void> }) {
  const [guest, setGuest] = useState("");
  const [plate, setPlate] = useState("");
  const [when, setWhen] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try { await onSubmit(guest, plate, when); setGuest(""); setPlate(""); setWhen(""); }
        finally { setSubmitting(false); }
      }}
      className="space-y-1.5"
    >
      <input value={guest} onChange={(e) => setGuest(e.target.value)} required placeholder="Guest name" className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded" />
      <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="Plate (optional)" className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded" />
      <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded" />
      <button disabled={submitting} type="submit" className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded">
        {submitting ? "Reserving…" : "Reserve VIP spot"}
      </button>
    </form>
  );
}
