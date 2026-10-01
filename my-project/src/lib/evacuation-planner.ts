import { prisma } from "./prisma";

type Node = { id: number; name: string | null; lat: number; lng: number; isExit: boolean; zoneId: number | null };
type Edge = { id: number; fromNode: number; toNode: number; lengthM: number; isBlocked: boolean };

export type EvacuationPlan = {
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

export async function computeEvacuationPlan(
  eventId: number,
  blockedEdgeIds: number[],
): Promise<EvacuationPlan> {
  const nodes = (await prisma.venueNode.findMany({ where: { eventId } })) as unknown as Node[];
  const edgeRows = (await prisma.venueEdge.findMany({
    where: {
      from: { eventId },
    },
  })) as unknown as Array<{ id: number; fromNode: number | null; toNode: number | null; lengthM: unknown; isBlocked: boolean | null }>;
  const edges: Edge[] = edgeRows
    .filter((e): e is Edge & { fromNode: number; toNode: number } => e.fromNode != null && e.toNode != null)
    .map((e) => ({
      id: e.id,
      fromNode: e.fromNode,
      toNode: e.toNode,
      lengthM: Number(e.lengthM),
      isBlocked: e.isBlocked ?? false,
    }));
  const zones = await prisma.zone.findMany({ where: { eventId } });
  const zoneCrowd = Object.fromEntries(zones.map((z) => [z.id, z.capacity ?? 100])); // crowd ≈ capacity for now

  const blocked = new Set(blockedEdgeIds);
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const adj = new Map<number, Array<{ to: number; weight: number; edgeId: number }>>();
  for (const e of edges) {
    if (blocked.has(e.id) || e.isBlocked) continue;
    const list = adj.get(e.fromNode) ?? [];
    list.push({ to: e.toNode, weight: e.lengthM, edgeId: e.id });
    adj.set(e.fromNode, list);
  }

  const exitIds = nodes.filter((n) => n.isExit).map((n) => n.id);
  const perZone: EvacuationPlan["perZone"] = [];
  const unreachable: EvacuationPlan["unreachable"] = [];

  // Zone nodes = non-exit nodes with a zoneId.
  const zoneNodes = nodes.filter((n) => n.zoneId != null && !n.isExit);
  for (const start of zoneNodes) {
    const result = multiDijkstra(start.id, exitIds, adj);
    const zone = zones.find((z) => z.id === start.zoneId);
    if (!zone) continue;
    const crowd = zoneCrowd[zone.id] ?? 100;

    if (!result) {
      unreachable.push({ zoneId: zone.id, zoneName: zone.name });
      continue;
    }

    // Weight: shorter path preferred, but a wider / less-crowded path matters.
    // We approximate "crowd factor" with crowd / 100.
    let bestExit = result[0];
    for (const r of result) {
      const score = r.distance * (1 + crowd / 500);
      const bestScore = bestExit.distance * (1 + crowd / 500);
      if (score < bestScore) bestExit = r;
    }
    const pathCoords = bestExit.path
      .map((id) => nodeById.get(id))
      .filter((n): n is Node => !!n)
      .map((n) => ({ lat: n.lat, lng: n.lng }));
    perZone.push({
      zoneId: zone.id,
      zoneName: zone.name,
      crowd,
      exitNodeId: bestExit.target,
      exitName: nodeById.get(bestExit.target)?.name ?? "exit",
      pathNodeIds: bestExit.path,
      pathCoords,
      distanceM: bestExit.distance,
    });
  }

  return { perZone, unreachable };
}

type DijkstraResult = { target: number; distance: number; path: number[] };

function multiDijkstra(
  start: number,
  targets: number[],
  adj: Map<number, Array<{ to: number; weight: number; edgeId: number }>>,
): DijkstraResult[] | null {
  const dist = new Map<number, number>();
  const prev = new Map<number, number>();
  dist.set(start, 0);
  // Simple priority queue (sorted array — fine for ~10-100 nodes).
  const queue: Array<[number, number]> = [[0, start]];
  while (queue.length) {
    queue.sort((a, b) => a[0] - b[0]);
    const [d, u] = queue.shift()!;
    if (d > (dist.get(u) ?? Infinity)) continue;
    for (const { to, weight } of adj.get(u) ?? []) {
      const nd = d + weight;
      if (nd < (dist.get(to) ?? Infinity)) {
        dist.set(to, nd);
        prev.set(to, u);
        queue.push([nd, to]);
      }
    }
  }
  const results: DijkstraResult[] = [];
  for (const t of targets) {
    const d = dist.get(t);
    if (d == null) continue;
    // Reconstruct path.
    const path: number[] = [];
    let cur: number | undefined = t;
    while (cur != null) {
      path.unshift(cur);
      cur = prev.get(cur);
    }
    results.push({ target: t, distance: d, path });
  }
  return results.length ? results : null;
}
