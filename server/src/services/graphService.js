// All Cypher the application runs against CognoDB. Every query is
// parameterised — no string-concatenated Cypher.
import { read, verify } from '../db/driver.js';

const TRANSFER_PENALTY_MIN = 4;

const lineRef = (l) => ({ id: l.id, name: l.name, color: l.color, mode: l.mode });

export async function health() {
  await verify();
  const [rec] = await read(
    `MATCH (n) WITH count(n) AS nodes
     OPTIONAL MATCH ()-[r]->()
     RETURN nodes, count(r) AS rels`
  );
  return { mode: 'cognodb', nodes: rec.get('nodes'), rels: rec.get('rels') };
}

export async function listStations() {
  const records = await read(
    `MATCH (s:Station)
     OPTIONAL MATCH (s)-[:ON_LINE]->(l:Line)
     WITH s, collect({id: l.id, name: l.name, color: l.color, mode: l.mode}) AS lines
     RETURN s.id AS id, s.name AS name, s.zone AS zone, lines
     ORDER BY s.name`
  );
  return records.map((r) => ({
    id: r.get('id'),
    name: r.get('name'),
    zone: r.get('zone'),
    lines: r.get('lines').filter((l) => l.id !== null),
  }));
}

export async function listLines() {
  const records = await read(
    `MATCH (l:Line)
     OPTIONAL MATCH (s:Station)-[:ON_LINE]->(l)
     RETURN l.id AS id, l.name AS name, l.mode AS mode, l.color AS color,
            count(s) AS stationCount
     ORDER BY l.mode, l.name`
  );
  return records.map((r) => ({
    id: r.get('id'),
    name: r.get('name'),
    mode: r.get('mode'),
    color: r.get('color'),
    stationCount: r.get('stationCount'),
  }));
}

/**
 * Route planning: enumerate bounded simple paths between two stations,
 * optionally skipping a closed station, then rank by travel time plus a
 * per-transfer penalty. Transfers are counted by folding over each path's
 * relationship sequence. Fewest-hop search is deliberately avoided — the
 * fewest-stop route is rarely the fastest in a weighted multi-modal network.
 */
export async function findRoutes({ from, to, avoid = null }) {
  const records = await read(
    `MATCH (src:Station {id: $from}), (dst:Station {id: $to})
     MATCH p = (src)-[:CONNECTS*..20]-(dst)
     WHERE ($avoid IS NULL OR NONE(n IN nodes(p) WHERE n.id = $avoid))
       AND NONE(i IN range(1, size(nodes(p)) - 1)
                WHERE nodes(p)[i].id IN [x IN nodes(p)[0..i] | x.id])
     WITH p, relationships(p) AS rels
     WITH p, rels,
          reduce(t = 0, r IN rels | t + r.timeMin) AS travelTime,
          size([i IN range(1, size(rels) - 1)
                WHERE rels[i].lineId <> rels[i - 1].lineId]) AS transfers
     RETURN p, travelTime, transfers,
            travelTime + transfers * $penalty AS score
     ORDER BY score ASC, transfers ASC
     LIMIT 3`,
    { from, to, avoid, penalty: TRANSFER_PENALTY_MIN }
  );

  return records.map((rec) => {
    const travelTime = rec.get('travelTime');
    const transfers = rec.get('transfers');
    return {
      steps: rec.get('p').segments.map((seg) => ({
        from: { id: seg.start.properties.id, name: seg.start.properties.name },
        to: { id: seg.end.properties.id, name: seg.end.properties.name },
        lineId: seg.relationship.properties.lineId,
        timeMin: seg.relationship.properties.timeMin,
      })),
      travelTime,
      transfers,
      totalTime: travelTime + transfers * TRANSFER_PENALTY_MIN,
    };
  });
}

/** Stations reachable within N hops, with minimum hop distance. */
export async function nearbyStations({ id, hops }) {
  const records = await read(
    `MATCH (s:Station {id: $id}), (x:Station)
     WHERE x.id <> $id
     MATCH p = shortestPath((s)-[:CONNECTS*..5]-(x))
     WITH x, length(p) AS hopCount
     WHERE hopCount <= $hops
     OPTIONAL MATCH (x)-[:ON_LINE]->(l:Line)
     WITH x, hopCount, collect({id: l.id, name: l.name, color: l.color, mode: l.mode}) AS lines
     RETURN x.id AS id, x.name AS name, x.zone AS zone, hopCount, lines
     ORDER BY hopCount, name`,
    { id, hops }
  );
  return records.map((r) => ({
    id: r.get('id'),
    name: r.get('name'),
    zone: r.get('zone'),
    hops: r.get('hopCount'),
    lines: r.get('lines').filter((l) => l.id !== null),
  }));
}

/** Stations served by two or more lines. */
export async function interchanges() {
  const records = await read(
    `MATCH (s:Station)-[:ON_LINE]->(l:Line)
     WITH s, collect(DISTINCT l) AS ls
     WHERE size(ls) >= 2
     RETURN s.id AS id, s.name AS name, s.zone AS zone,
            [x IN ls | {id: x.id, name: x.name, color: x.color, mode: x.mode}] AS lines
     ORDER BY size(ls) DESC, name`
  );
  return records.map((r) => ({
    id: r.get('id'),
    name: r.get('name'),
    zone: r.get('zone'),
    lines: r.get('lines'),
  }));
}

export async function listLandmarks() {
  const records = await read(
    `MATCH (lm:Landmark)-[:NEAR]->(s:Station)
     WITH lm, collect({id: s.id, name: s.name}) AS stations
     RETURN lm.id AS id, lm.name AS name, lm.category AS category, stations
     ORDER BY lm.name`
  );
  return records.map((r) => ({
    id: r.get('id'),
    name: r.get('name'),
    category: r.get('category'),
    stations: r.get('stations'),
  }));
}

export async function stats() {
  const [r] = await read(
    `MATCH (s:Station) WITH count(s) AS stations
     MATCH (l:Line) WITH stations, count(l) AS lines
     MATCH (lm:Landmark) WITH stations, lines, count(lm) AS landmarks
     MATCH ()-[c:CONNECTS]->() WITH stations, lines, landmarks, count(c) AS segments
     MATCH (hub:Station)-[r:CONNECTS]-()
     WITH stations, lines, landmarks, segments, hub, count(r) AS degree
     ORDER BY degree DESC LIMIT 1
     RETURN stations, lines, landmarks, segments,
            hub.name AS busiestStation, degree AS busiestDegree`
  );
  return {
    stations: r.get('stations'),
    lines: r.get('lines'),
    landmarks: r.get('landmarks'),
    segments: r.get('segments'),
    busiestStation: r.get('busiestStation'),
    busiestDegree: r.get('busiestDegree'),
  };
}
