# 🚇 PuneRoutes — Pune Transit Route Finder

A multi-modal **route finder for Pune's Metro + PMPML bus network**, backed by **CognoDB** (a managed graph database speaking openCypher over Bolt) with an **Express + React + Node** stack — the MERN stack with the "M" upgraded to a graph database.

> **Wexa AI — Take-Home Assignment 2** · Build a Graph Database Application on CognoDB

**Live demo:** https://puneroutes.onrender.com/ · **Screen recording:** _<add link>_

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
| `(:Station {id, name, zone})` | A metro station or bus stop (43 total) |
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
puneroutes/
├── package.json                npm workspaces root — `npm run dev` runs everything
├── scripts/dev.mjs             zero-dependency runner: API + UI together, Ctrl-C stops both
├── server/                     Express API (Node, ES modules)
│   ├── src/
│   │   ├── index.js            entry point: listen + graceful shutdown
│   │   ├── app.js              Express app factory (importable by tests)
│   │   ├── config.js           env-driven config
│   │   ├── middleware/         request logging · JSON 404s
│   │   ├── db/driver.js        Bolt driver singleton (official neo4j-driver)
│   │   ├── routes/api.js       REST endpoints + uniform error handling
│   │   └── services/
│   │       ├── graphService.js all Cypher queries (primary data layer)
│   │       └── demoService.js  in-memory fallback for graceful degradation
│   ├── seed/
│   │   ├── data.js             the Pune transit dataset
│   │   └── seed.js             idempotent loader (npm run seed)
│   ├── tests/api.test.js       API contract tests (node:test, zero deps)
│   └── .env.example
└── client/                     React (Vite) SPA
    └── src/
        ├── App.jsx             shell, health status, tabs
        ├── api.js              fetch wrapper
        └── components/         JourneyPlanner · ExplorePanel · InsightsPanel · common states
```

### Architecture notes

- **Layered server** — `routes` (HTTP concerns: parsing, validation, status codes) → `services` (domain logic) → `db` (driver/session lifecycle). The graph and demo services share one interface, so the data layer swaps without touching a route.
- **App/listener split** — `app.js` builds the middleware stack; `index.js` owns the port and process lifecycle. Tests import the app directly and listen on an ephemeral port.
- **Parameterised Cypher only** — every query takes `$params`; no string concatenation anywhere.
- **Graceful degradation** — no credentials ⇒ demo mode; database down at runtime ⇒ `503` + retryable UI state.
- **Zero-dependency tests** — `node:test` + the real Express app against the in-memory graph: `npm test` (12 contract tests, no DB needed).

## Setup & run

```bash
npm install          # at the repo root — installs both workspaces
```

### 0. Quick look (no database needed)

```bash
npm run dev          # API on :4000 (demo mode) + UI on :3000, one command
```

### 1. Create a CognoDB instance
1. Sign up at **https://console.cognodb.com/signup** (free tier, no card).
2. Create a free **c0** instance and pick a region (provisions in <1 min).
3. Copy the connection URI (`bolt+s://<instance-id>.<region>.databases.cognodb.com`) and the one-time password for user `cognodb`.

### 2. Configure & seed
```bash
cd server
cp .env.example .env        # paste your COGNODB_URI and COGNODB_PASSWORD
cd ..
npm run seed                # loads 61 nodes / 109 relationships (idempotent)
```

### 3. Run
```bash
npm run dev                 # from the repo root — API :4000 + UI :3000 together
# or individually:
npm run dev:server          # Express API with --watch
npm run dev:client          # Vite dev server (proxies /api → :4000)
```

Open http://localhost:3000.

### Tests
```bash
npm test                    # 12 API contract tests (hermetic demo mode — no database needed)
```
Also wired for GitHub Actions: copy [`docs/github-actions-ci.yml`](./docs/github-actions-ci.yml) to
`.github/workflows/ci.yml` in the repo (one paste in the GitHub UI — *Actions → set up a workflow yourself*)
to run tests + client build on every push, Node 18/20/22.

### Production mode (single service)
```bash
npm run build               # builds the React client → client/dist
npm start                   # Express serves UI + API on :4000
```

## Deployment (hosted demo — free tier)

A [`render.yaml`](./render.yaml) Blueprint deploys the whole app as **one free Render web service**: the
Express API (connected to CognoDB), the seeded graph, and the built React client on the same origin —
no CORS or proxy setup needed. The seed script is idempotent and runs as part of the start command,
so every deploy re-seeds the graph if it was ever emptied.

1. Push this repo to GitHub, then in Render: **New → Blueprint** → select the repo.
2. When prompted, fill the two `sync: false` secrets — they are stored in Render only, never in the repo:
   - `COGNODB_URI` = `bolt+s://<your-instance>.<region>.databases.cognodb.com`
   - `COGNODB_PASSWORD` = your one-time CognoDB password
3. Apply. First deploy ≈ 2 minutes → your app is live at `https://<service>.onrender.com`
   (the header pill should read **Live · CognoDB Graph · 61 nodes**).

## Screenshots

_Add screenshots of Plan Journey, Reachability, and Insights here before submission._

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

Screenshots :
<img width="1912" height="883" alt="Screenshot 2026-08-22 114538" src="https://github.com/user-attachments/assets/c946426b-17cb-4108-b5d0-804ca04a73ce" />

<img width="1891" height="870" alt="Screenshot 2026-08-22 114725" src="https://github.com/user-attachments/assets/4a1da351-e955-44da-ac2a-64b5e385dd6e" />

<img width="1896" height="877" alt="Screenshot 2026-08-22 114622" src="https://github.com/user-attachments/assets/c3c73938-335b-4bc9-9729-ac0b85cf0f7c" />

<img width="1879" height="865" alt="Screenshot 2026-08-22 114558" src="https://github.com/user-attachments/assets/20440136-fb4c-4fdf-944c-cd72ca8c18e2" />

<img width="1893" height="861" alt="Screenshot 2026-08-22 114504" src="https://github.com/user-attachments/assets/e462e0b7-d228-4368-9f6a-f2819c9a85e1" />

<img width="1894" height="875" alt="Screenshot 2026-08-22 114431" src="https://github.com/user-attachments/assets/7d512940-2d63-4bdb-ac50-02f5229a8c99" />



---
 Stack: **CognoDB · Express · React · Node** (official `neo4j-driver`, Bolt 5.x, openCypher).
