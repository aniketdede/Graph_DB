# 🚇 PuneRoutes — Pune Transit Route Finder

A multi-modal **route finder for Pune's Metro + PMPML bus network**, backed by **CognoDB** (a managed graph database speaking openCypher over Bolt) with an **Express + React + Node** stack — the MERN stack with the "M" upgraded to a graph database.

> **Wexa AI — Take-Home Assignment 2** · Build a Graph Database Application on CognoDB

**Live demo:** _<add hosted URL>_ · **Screen recording:** _<add link>_

---

## The use case

Pune commuters juggle two metro lines (Purple: PCMC↔Swargate, Aqua: Vanaz↔Ramwadi) and a web of PMPML/BRT bus corridors. Getting from, say, **Vanaz to Pune Airport** means: ride the Aqua Line, transfer somewhere, catch the airport bus — but *where* do you transfer, and what's fastest?

PuneRoutes answers:

- 🚇 **Plan Journey** — fastest multi-modal routes between any two stops, ranked by travel time + transfer penalty, with a **"simulate closed station"** mode for disruption planning.
- 🧭 **Explore Network** — every station reachable within N hops of any stop.
- 📊 **Insights** — interchange stations, line summaries, busiest hub, landmarks and their nearest stations.

## Why a graph database?

A transit network **is** a graph — the domain model and the storage model are the same thing:

1. **Route finding is path traversal.** "Fastest route from A to B" is `allShortestPaths((a)-[:CONNECTS*..30]-(b))` — one declarative pattern. In SQL it's a recursive CTE that must accumulate the visited path, guard against cycles, and reconstruct the path row-by-row in application code. Deletion of a single station ("closed station" mode) is a one-line `WHERE NONE(n IN nodes(p) ...)` filter; relationally it invalidates the whole CTE approach.
2. **Variable-length queries are native.** "Everything within 3 hops" (`[:CONNECTS*..5]` + hop filter) has no fixed number of joins — SQL needs one self-join *per hop* or another recursive CTE.
3. **Transfers fall out of the path.** Counting line changes is a `reduce` over the relationship sequence of the returned path; SQL has no notion of "the path" to reduce over.
4. **The model stays honest.** Interchanges (Civil Court), multi-modal stops (Swargate, Shivajinagar, Kalyani Nagar) are just nodes with more edges — no junction-table explosion, no schema migration to add a new mode (add a `Line` node with `mode: 'ferry'` tomorrow and every query still works).

## Graph data model

```
                    ┌────────────────────────────┐
                    │  (:Line)                   │
                    │  id, name, mode, color     │
                    └──────────▲─────────────────┘
                               │ :ON_LINE {seq}
                    ┌──────────┴─────────────────┐   :CONNECTS {lineId, timeMin}
                    │  (:Station)                │◄───────────────────────────┐
                    │  id, name, zone            │────────────────────────────┘
                    └──────────▲─────────────────┘        (adjacent stops)
                               │ :NEAR
                    ┌──────────┴─────────────────┐
                    │  (:Landmark)               │
                    │  id, name, category        │
                    └────────────────────────────┘
```

| Element | Meaning |
|---|---|
| `(:Station {id, name, zone})` | A metro station or bus stop (44 total) |
| `(:Line {id, name, mode, color})` | A metro line or bus corridor (2 metro + 4 bus) |
| `(:Landmark {id, name, category})` | A city landmark (12) |
| `(:Station)-[:CONNECTS {lineId, timeMin}]->(:Station)` | Adjacent stops on a line, weighted by minutes (traversed undirected) |
| `(:Station)-[:ON_LINE {seq}]->(:Line)` | Station membership + ordering on a line |
| `(:Landmark)-[:NEAR]->(:Station)` | Landmark ↔ nearest station(s) |

## The main queries (all parameterised — no string-concatenated Cypher)

**1. Multi-hop route planning** (`server/src/services/graphService.js → findRoutes`) — *the ≥2-hop traversal*. Enumerates bounded simple paths (optionally avoiding a closed station), computes travel time and transfers by folding over each path's relationship sequence, and ranks by time + 4 min/transfer. Fewest-hop search is deliberately not used — the fewest-stop route is often not the fastest in a weighted multi-modal network:

```cypher
MATCH (src:Station {id: $from}), (dst:Station {id: $to})
MATCH p = (src)-[:CONNECTS*..20]-(dst)
WHERE ($avoid IS NULL OR NONE(n IN nodes(p) WHERE n.id = $avoid))
  AND NONE(i IN range(1, size(nodes(p)) - 1)          // simple paths only
           WHERE nodes(p)[i].id IN [x IN nodes(p)[0..i] | x.id])
WITH p, relationships(p) AS rels
WITH p, rels,
     reduce(t = 0, r IN rels | t + r.timeMin) AS travelTime,
     size([i IN range(1, size(rels)-1) WHERE rels[i].lineId <> rels[i-1].lineId]) AS transfers
RETURN p, travelTime, transfers, travelTime + transfers * $penalty AS score
ORDER BY score ASC, transfers ASC
LIMIT 3
```

**2. Reachability within N hops** (`nearbyStations`) — variable-length traversal with minimum hop distance per station:

```cypher
MATCH (s:Station {id: $id}), (x:Station) WHERE x.id <> $id
MATCH p = shortestPath((s)-[:CONNECTS*..5]-(x))
WITH x, length(p) AS hopCount WHERE hopCount <= $hops
...
```

**3. Interchange detection** (`interchanges`) — *the query SQL finds awkward*: stations on 2+ lines in one pattern, returning the collected lines inline (SQL: join station→station_line→line, GROUP BY, HAVING COUNT ≥ 2, then a second round-trip or string_agg hack to get the line details back):

```cypher
MATCH (s:Station)-[:ON_LINE]->(l:Line)
WITH s, collect(DISTINCT l) AS ls WHERE size(ls) >= 2
RETURN s.id, s.name, s.zone, [x IN ls | {id: x.id, name: x.name, color: x.color, mode: x.mode}]
```

Plus: busiest-hub degree centrality (`stats`), landmark lookups, and line summaries — see `graphService.js`.

## Project structure

```
pune-transit-graph/
├── server/                     Express API (Node, ES modules)
│   ├── src/
│   │   ├── index.js            entry point
│   │   ├── config.js           env-driven config
│   │   ├── db/driver.js        Bolt driver singleton (official neo4j-driver)
│   │   ├── routes/api.js       REST endpoints + uniform error handling
│   │   └── services/
│   │       ├── graphService.js all Cypher queries (primary data layer)
│   │       └── demoService.js  in-memory fallback for graceful degradation
│   ├── seed/
│   │   ├── data.js             the Pune transit dataset
│   │   └── seed.js             idempotent loader (npm run seed)
│   └── .env.example
└── client/                     React (Vite) SPA
    └── src/
        ├── App.jsx             shell, health status, tabs
        ├── api.js              fetch wrapper
        └── components/         JourneyPlanner · ExplorePanel · InsightsPanel · common states
```

## Setup & run

### 1. Create a CognoDB instance
1. Sign up at **https://console.cognodb.com/signup** (free tier, no card).
2. Create a free **c0** instance and pick a region (provisions in <1 min).
3. Copy the connection URI (`bolt+s://<instance-id>.databases.cognodb.cloud`) and the one-time password for user `cognodb`.

### 2. Configure & seed
```bash
cd server
cp .env.example .env        # paste your COGNODB_URI and COGNODB_PASSWORD
npm install
npm run seed                # loads 62 nodes / ~130 relationships (idempotent)
```

### 3. Run
```bash
# terminal 1 — API on :4000
cd server && npm start

# terminal 2 — UI on :3000 (proxies /api to the server)
cd client && npm install && npm run dev
```

Open http://localhost:3000.

### Graceful degradation
- **No credentials configured** → the API boots in clearly-labelled **demo mode** (same endpoints served from the in-memory seed dataset), and the header shows an amber "Demo data" pill.
- **Database unreachable at runtime** → API returns `503` with a friendly message; the UI shows a retry-able error state and recovers automatically.

## API

| Endpoint | Description |
|---|---|
| `GET /api/health` | Connectivity + node/relationship counts |
| `GET /api/route?from&to&avoid` | Ranked multi-modal routes (optional closed station) |
| `GET /api/stations/:id/nearby?hops=N` | Stations within N hops (1–5) |
| `GET /api/stations` · `/api/lines` · `/api/interchanges` · `/api/landmarks` · `/api/stats` | Network data |



---
 Stack: **CognoDB · Express · React · Node** (official `neo4j-driver`, Bolt 5.x, openCypher).
