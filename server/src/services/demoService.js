// In-memory fallback mirroring graphService's API, used only when no CognoDB
// connection is configured — the app degrades gracefully instead of failing.
import { lines, stations, landmarks, routes, buildEdges } from '../../seed/data.js';

const TRANSFER_PENALTY_MIN = 4;

const stationById = new Map(stations.map((s) => [s.id, s]));
const lineById = new Map(lines.map((l) => [l.id, l]));

const stationLines = new Map(); // stationId -> Set(lineId)
for (const r of routes) {
  for (const stop of r.stops) {
    if (!stationLines.has(stop)) stationLines.set(stop, new Set());
    stationLines.get(stop).add(r.lineId);
  }
}

const adj = new Map(); // stationId -> [{to, lineId, timeMin}]
for (const e of buildEdges()) {
  if (!adj.has(e.from)) adj.set(e.from, []);
  if (!adj.has(e.to)) adj.set(e.to, []);
  adj.get(e.from).push({ to: e.to, lineId: e.lineId, timeMin: e.timeMin });
  adj.get(e.to).push({ to: e.from, lineId: e.lineId, timeMin: e.timeMin });
}

const lineRefs = (stationId) =>
  [...(stationLines.get(stationId) || [])].map((id) => {
    const l = lineById.get(id);
    return { id: l.id, name: l.name, color: l.color, mode: l.mode };
  });

export async function health() {
  // Parity with graphService.health: count every relationship the seed would
  // create — CONNECTS + ON_LINE + NEAR — not just the segment edges.
  const onLine = routes.reduce((n, r) => n + r.stops.length, 0);
  const near = landmarks.reduce((n, lm) => n + lm.near.length, 0);
  return {
    mode: 'demo',
    nodes: stations.length + lines.length + landmarks.length,
    rels: buildEdges().length + onLine + near,
  };
}

export async function listStations() {
  return [...stations]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => ({ ...s, lines: lineRefs(s.id) }));
}

export async function listLines() {
  return lines.map((l) => ({
    ...l,
    stationCount: routes.find((r) => r.lineId === l.id)?.stops.length ?? 0,
  }));
}

/** Dijkstra over (station, lastLine) states with a transfer penalty. */
export async function findRoutes({ from, to, avoid = null }) {
  const start = { station: from, lastLine: null };
  const key = (s, l) => `${s}|${l ?? ''}`;
  const dist = new Map([[key(from, null), 0]]);
  const prev = new Map();
  const pq = [[0, start]];

  while (pq.length) {
    pq.sort((a, b) => a[0] - b[0]);
    const [d, cur] = pq.shift();
    if (d > (dist.get(key(cur.station, cur.lastLine)) ?? Infinity)) continue;
    for (const edge of adj.get(cur.station) || []) {
      if (edge.to === avoid || cur.station === avoid) continue;
      const transfer = cur.lastLine && cur.lastLine !== edge.lineId ? TRANSFER_PENALTY_MIN : 0;
      const nd = d + edge.timeMin + transfer;
      const nk = key(edge.to, edge.lineId);
      if (nd < (dist.get(nk) ?? Infinity)) {
        dist.set(nk, nd);
        prev.set(nk, { fromKey: key(cur.station, cur.lastLine), edge, from: cur.station });
        pq.push([nd, { station: edge.to, lastLine: edge.lineId }]);
      }
    }
  }

  // best terminal state at destination
  let bestKey = null;
  for (const [k, d] of dist) {
    if (k.startsWith(`${to}|`) || k === key(to, null)) {
      if (bestKey === null || d < dist.get(bestKey)) bestKey = k;
    }
  }
  if (bestKey === null) return [];

  const steps = [];
  let k = bestKey;
  while (prev.has(k)) {
    const { fromKey, edge, from: f } = prev.get(k);
    steps.unshift({
      from: { id: f, name: stationById.get(f).name },
      to: { id: edge.to, name: stationById.get(edge.to).name },
      lineId: edge.lineId,
      timeMin: edge.timeMin,
    });
    k = fromKey;
  }
  const travelTime = steps.reduce((t, s) => t + s.timeMin, 0);
  const transfers = steps.filter((s, i) => i > 0 && s.lineId !== steps[i - 1].lineId).length;
  return [{ steps, travelTime, transfers, totalTime: travelTime + transfers * TRANSFER_PENALTY_MIN }];
}

export async function nearbyStations({ id, hops }) {
  const seen = new Map([[id, 0]]);
  let frontier = [id];
  for (let h = 1; h <= hops; h++) {
    const next = [];
    for (const cur of frontier) {
      for (const e of adj.get(cur) || []) {
        if (!seen.has(e.to)) {
          seen.set(e.to, h);
          next.push(e.to);
        }
      }
    }
    frontier = next;
  }
  seen.delete(id);
  return [...seen.entries()]
    .map(([sid, hopCount]) => ({
      id: sid,
      name: stationById.get(sid).name,
      zone: stationById.get(sid).zone,
      hops: hopCount,
      lines: lineRefs(sid),
    }))
    .sort((a, b) => a.hops - b.hops || a.name.localeCompare(b.name));
}

export async function interchanges() {
  return stations
    .filter((s) => (stationLines.get(s.id)?.size ?? 0) >= 2)
    .map((s) => ({ id: s.id, name: s.name, zone: s.zone, lines: lineRefs(s.id) }))
    .sort((a, b) => b.lines.length - a.lines.length || a.name.localeCompare(b.name));
}

export async function listLandmarks() {
  return [...landmarks]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((lm) => ({
      id: lm.id,
      name: lm.name,
      category: lm.category,
      stations: lm.near.map((sid) => ({ id: sid, name: stationById.get(sid).name })),
    }));
}

export async function stats() {
  let busiest = null;
  for (const [sid, edges] of adj) {
    if (!busiest || edges.length > busiest.degree) busiest = { sid, degree: edges.length };
  }
  return {
    stations: stations.length,
    lines: lines.length,
    landmarks: landmarks.length,
    segments: buildEdges().length,
    busiestStation: stationById.get(busiest.sid).name,
    busiestDegree: busiest.degree,
  };
}
