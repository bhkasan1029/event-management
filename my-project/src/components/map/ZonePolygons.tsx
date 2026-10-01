"use client";

import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect } from "react";

export type ZonePolygon = {
  id: number;
  name: string;
  type: string;
  polygon: Array<{ lat: number; lng: number }>;
};

const TYPE_COLOR: Record<string, string> = {
  gate: "#2563eb",
  stage: "#9333ea",
  first_aid: "#dc2626",
  parking: "#0891b2",
  food: "#d97706",
  other: "#64748b",
};

export function ZonePolygons({
  zones,
  muted = false,
}: {
  zones: ZonePolygon[];
  /** Draw as thin outlines only — use when another layer (e.g. evacuation paths) should dominate. */
  muted?: boolean;
}) {
  const map = useMap();
  const maps = useMapsLibrary("maps");

  useEffect(() => {
    if (!map || !maps) return;
    const polys = zones.map((z) => {
      const color = TYPE_COLOR[z.type] ?? TYPE_COLOR.other;
      const poly = new maps.Polygon({
        paths: z.polygon,
        strokeColor: muted ? "#94a3b8" : color,
        strokeWeight: muted ? 1 : 2,
        strokeOpacity: muted ? 0.5 : 0.85,
        fillColor: color,
        fillOpacity: muted ? 0.04 : 0.15,
        clickable: false,
        map,
      });
      return poly;
    });
    return () => polys.forEach((p) => p.setMap(null));
  }, [map, maps, zones, muted]);

  return null;
}
