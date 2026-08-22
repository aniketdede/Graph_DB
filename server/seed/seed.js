// Loads the Pune transit graph into CognoDB via the official neo4j-driver.
// Idempotent (MERGE-based). Usage: npm run seed
import neo4j from 'neo4j-driver';
import config from '../src/config.js';
import { lines, stations, routes, landmarks, buildEdges } from './data.js';

async function main() {
  if (!config.neo4j.uri || !config.neo4j.password) {
    console.error('Missing COGNODB_URI / COGNODB_PASSWORD environment variables.');
    console.error('Create a free instance at https://console.cognodb.com and set them in server/.env');
    process.exit(1);
  }

  const driver = neo4j.driver(
    config.neo4j.uri,
    neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
    { connectionTimeout: 15000 }
  );

  const session = driver.session();
  try {
    await driver.verifyConnectivity();
    console.log(`Connected to ${config.neo4j.uri}`);

    console.log('Clearing existing graph…');
    await session.run('MATCH (n) DETACH DELETE n');

    console.log(`Creating ${lines.length} lines…`);
    await session.run(
      `UNWIND $lines AS l
       MERGE (line:Line {id: l.id})
       SET line.name = l.name, line.mode = l.mode, line.color = l.color`,
      { lines }
    );

    console.log(`Creating ${stations.length} stations…`);
    await session.run(
      `UNWIND $stations AS s
       MERGE (st:Station {id: s.id})
       SET st.name = s.name, st.zone = s.zone`,
      { stations }
    );

    const onLine = routes.flatMap((r) =>
      r.stops.map((stationId, i) => ({ stationId, lineId: r.lineId, seq: i }))
    );
    console.log(`Creating ${onLine.length} ON_LINE relationships…`);
    await session.run(
      `UNWIND $onLine AS m
       MATCH (s:Station {id: m.stationId}), (l:Line {id: m.lineId})
       MERGE (s)-[r:ON_LINE]->(l)
       SET r.seq = m.seq`,
      { onLine }
    );

    const edges = buildEdges();
    console.log(`Creating ${edges.length} CONNECTS relationships…`);
    await session.run(
      `UNWIND $edges AS e
       MATCH (a:Station {id: e.from}), (b:Station {id: e.to})
       MERGE (a)-[r:CONNECTS {lineId: e.lineId}]->(b)
       SET r.timeMin = e.timeMin`,
      { edges }
    );

    const nearPairs = landmarks.flatMap((lm) =>
      lm.near.map((stationId) => ({ id: lm.id, name: lm.name, category: lm.category, stationId }))
    );
    console.log(`Creating ${landmarks.length} landmarks (+ NEAR relationships)…`);
    await session.run(
      `UNWIND $pairs AS p
       MERGE (lm:Landmark {id: p.id})
       SET lm.name = p.name, lm.category = p.category
       WITH lm, p
       MATCH (s:Station {id: p.stationId})
       MERGE (lm)-[:NEAR]->(s)`,
      { pairs: nearPairs }
    );

    const counts = await session.run(
      `MATCH (n) WITH count(n) AS nodes
       MATCH ()-[r]->() RETURN nodes, count(r) AS rels`
    );
    const rec = counts.records[0];
    console.log(`Done. Graph now has ${rec.get('nodes')} nodes and ${rec.get('rels')} relationships.`);
  } finally {
    await session.close();
    await driver.close();
  }
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
