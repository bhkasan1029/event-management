"use client";

import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect } from "react";

type ZonePlan = {
  zoneId: number;
  zoneName: string;
  exitName: string;
  pathCoords: Array<{ lat: number; lng: number }>;
  distanceM: number;
};

// Deliberately high-contrast palette so paths stand out against the muted zones.
const COLORS = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#dc2626", "#0891b2"];

export function EvacuationPlanLayer({ perZone }: { perZone: ZonePlan[] }) {
  const map = useMap();
  const maps = useMapsLibrary("maps");

  useEffect(() => {
    if (!map || !maps) return;
    const polylines: google.maps.Polyline[] = [];
    perZone.forEach((z, i) => {
      if (z.pathCoords.length < 2) return;
      const color = COLORS[i % COLORS.length];

      // White halo underneath so the colored line pops on any map background.
      polylines.push(
        new maps.Polyline({
          path: z.pathCoords,
          strokeColor: "#ffffff",
          strokeOpacity: 0.95,
          strokeWeight: 11,
          zIndex: 10,
          map,
        }),
      );

      polylines.push(
        new maps.Polyline({
          path: z.pathCoords,
          strokeColor: color,
          strokeOpacity: 1,
          strokeWeight: 7,
          zIndex: 11,
          icons: [
            {
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 5,
                strokeColor: "#ffffff",
                strokeWeight: 2,
                fillColor: color,
                fillOpacity: 1,
              },
              offset: "100%",
            },
            {
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 4,
                strokeColor: "#ffffff",
                strokeWeight: 1.5,
                fillColor: color,
                fillOpacity: 1,
              },
              offset: "35%",
            },
            {
              icon: {
                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                scale: 4,
                strokeColor: "#ffffff",
                strokeWeight: 1.5,
                fillColor: color,
                fillOpacity: 1,
              },
              offset: "70%",
            },
          ],
          map,
        }),
      );
    });
    return () => polylines.forEach((p) => p.setMap(null));
  }, [map, maps, perZone]);

  return null;
}
