"use client";

import { useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect } from "react";

export type GraphNode = { id: number; name: string | null; lat: number; lng: number; isExit: boolean };
export type GraphEdge = { id: number; from: number; to: number; isBlocked: boolean };

/**
 * Renders every undirected edge of the venue graph as a thin line. Blocked
 * edges go red + dashed. Clicking an edge calls onEdgeClick(edgeId).
 */
export function VenueGraphLayer({
  nodes,
  edges,
  blockedIds,
  onEdgeClick,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  blockedIds: Set<number>;
  onEdgeClick?: (edgeId: number) => void;
}) {
  const map = useMap();
  const maps = useMapsLibrary("maps");

  useEffect(() => {
    if (!map || !maps) return;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    // Deduplicate: our DB stores both directions; we only want one line per pair.
    const drawn = new Set<string>();
    const polylines: google.maps.Polyline[] = [];
    for (const e of edges) {
      const key = [e.from, e.to].sort((a, b) => a - b).join("-");
      if (drawn.has(key)) continue;
      drawn.add(key);
      const a = byId.get(e.from);
      const b = byId.get(e.to);
      if (!a || !b) continue;
      const blocked = blockedIds.has(e.id) || e.isBlocked;
      const line = new maps.Polyline({
        path: [{ lat: a.lat, lng: a.lng }, { lat: b.lat, lng: b.lng }],
        strokeColor: blocked ? "#dc2626" : "#64748b",
        strokeOpacity: blocked ? 0 : 0.9,
        strokeWeight: blocked ? 4 : 2.5,
        clickable: !!onEdgeClick,
        icons: blocked
          ? [
              {
                icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
                offset: "0",
                repeat: "10px",
              },
            ]
          : undefined,
        map,
      });
      if (onEdgeClick) {
        line.addListener("click", () => onEdgeClick(e.id));
      }
      polylines.push(line);
    }
    return () => polylines.forEach((p) => p.setMap(null));
  }, [map, maps, nodes, edges, blockedIds, onEdgeClick]);

  return null;
}
