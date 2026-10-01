"use client";

import { LabeledMarker } from "./LabeledMarker";

export type ParkingSpotDTO = {
  id: number;
  label: string;
  isVip: boolean;
  lat: number | null;
  lng: number | null;
  status: "free" | "occupied" | "reserved_vip";
  vehicleId: number | null;
  plate: string | null;
  reservedFor: string | null;
};

export function ParkingSpotMarkers({
  spots,
  onSelect,
}: {
  spots: ParkingSpotDTO[];
  onSelect?: (spot: ParkingSpotDTO) => void;
}) {
  return (
    <>
      {spots.map((s) => {
        if (s.lat == null || s.lng == null) return null;
        const bg =
          s.status === "occupied"
            ? "#dc2626"
            : s.status === "reserved_vip"
            ? "#2563eb"
            : s.isVip
            ? "#7c3aed"
            : "#16a34a";
        return (
          <LabeledMarker
            key={s.id}
            position={{ lat: s.lat, lng: s.lng }}
            background={bg}
            borderColor="#ffffff"
            glyph={s.label}
            title={`Spot ${s.label} · ${s.status}${s.plate ? ` · ${s.plate}` : ""}${s.reservedFor ? ` · ${s.reservedFor}` : ""}`}
            onClick={() => onSelect?.(s)}
          />
        );
      })}
    </>
  );
}
