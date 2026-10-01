"use client";

import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect } from "react";

export function RouteLine({
  path,
  color = "#dc2626",
  weight = 5,
  animated = true,
}: {
  path: Array<{ lat: number; lng: number }>;
  color?: string;
  weight?: number;
  animated?: boolean;
}) {
  const map = useMap();
  const maps = useMapsLibrary("maps");

  useEffect(() => {
    if (!map || !maps || !path.length) return;
    const line = new maps.Polyline({
      path,
      strokeColor: color,
      strokeOpacity: animated ? 0 : 0.9,
      strokeWeight: weight,
      map,
      icons: animated
        ? [
            {
              icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
              offset: "0",
              repeat: "14px",
            },
          ]
        : undefined,
    });
    return () => {
      line.setMap(null);
    };
  }, [map, maps, path, color, weight, animated]);

  return null;
}
