// API contract tests. They boot the real Express app (via createApp) against
// the in-memory demo data layer on an ephemeral port — no database and no
// extra dependencies required:   npm test
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import './setup.js';
import { createApp } from '../src/app.js';

const server = createApp().listen(0);
const base = `http://127.0.0.1:${server.address().port}`;

after(() => new Promise((done) => server.close(done)));

const get = async (path) => {
  const res = await fetch(`${base}${path}`);
  return { status: res.status, body: await res.json() };
};

// --- health & reference data -------------------------------------------------

test('GET /api/health → ok, reports data-layer node/rel counts', async () => {
  const { status, body } = await get('/api/health');
  assert.equal(status, 200);
  assert.equal(body.ok, true);
  assert.ok(body.nodes > 0 && body.rels > 0, 'expects a non-empty graph');
});

test('GET /api/stations → sorted list with line memberships', async () => {
  const { status, body } = await get('/api/stations');
  assert.equal(status, 200);
  assert.ok(body.length >= 40);
  for (const s of body) {
    assert.ok(s.id && s.name && s.zone && Array.isArray(s.lines));
  }
  const names = body.map((s) => s.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});

test('GET /api/lines → metro + bus corridors with station counts', async () => {
  const { body } = await get('/api/lines');
  assert.equal(body.length, 6);
  assert.equal(body.filter((l) => l.mode === 'metro').length, 2);
  assert.equal(body.filter((l) => l.mode === 'bus').length, 4);
  for (const l of body) assert.ok(l.stationCount > 0);
});

test('GET /api/interchanges → includes Civil Court with 2+ lines', async () => {
  const { body } = await get('/api/interchanges');
  const civilCourt = body.find((s) => s.id === 'civil-court');
  assert.ok(civilCourt, 'Civil Court should be detected as an interchange');
  assert.ok(civilCourt.lines.length >= 2);
});

test('GET /api/stats → busiest hub + counts', async () => {
  const { body } = await get('/api/stats');
  assert.ok(body.busiestStation && body.busiestDegree >= 2);
  assert.ok(body.stations > 0 && body.lines > 0 && body.segments > 0);
});

// --- route planning (the core graph query) ------------------------------------

test('GET /api/route vanaz → pune-airport returns ranked multi-modal routes', async () => {
  const { status, body } = await get('/api/route?from=vanaz&to=pune-airport');
  assert.equal(status, 200);
  assert.ok(body.routes.length >= 1, 'at least one route must exist');

  for (const r of body.routes) {
    assert.ok(r.travelTime > 0);
    assert.equal(typeof r.transfers, 'number');
    assert.equal(r.totalTime, r.travelTime + r.transfers * 4);
    // path continuity: each step starts where the previous ended
    assert.equal(r.steps[0].from.id, 'vanaz');
    assert.equal(r.steps.at(-1).to.id, 'pune-airport');
    for (let i = 1; i < r.steps.length; i++) {
      assert.equal(r.steps[i].from.id, r.steps[i - 1].to.id);
    }
    // transfer count matches line changes across steps
    const changes = r.steps.filter((s, i) => i > 0 && s.lineId !== r.steps[i - 1].lineId).length;
    assert.equal(r.transfers, changes);
  }

  // ranked best-first by total time
  const totals = body.routes.map((r) => r.totalTime);
  assert.deepEqual(totals, [...totals].sort((a, b) => a - b));
});

test('GET /api/route with avoid= bans the station from every returned path', async () => {
  // koregaon-park sits on the bus shuttle, but the Aqua line crosses at
  // Kalyani Nagar — a detour exists, so routes must still come back.
  const { body } = await get('/api/route?from=vanaz&to=pune-airport&avoid=koregaon-park');
  assert.ok(body.routes.length >= 1, 'an alternative around the closure must exist');
  for (const r of body.routes) {
    const visited = [r.steps[0].from.id, ...r.steps.map((s) => s.to.id)];
    assert.ok(!visited.includes('koregaon-park'));
  }
});

test('avoiding a cut vertex correctly severs the network', async () => {
  // civil-court is the only Aqua↔Purple interchange, and pune-station the
  // only gate to the airport branch: closing either leaves [] — the right answer.
  const cutA = await get('/api/route?from=vanaz&to=swargate&avoid=civil-court');
  assert.equal(cutA.status, 200);
  assert.deepEqual(cutA.body, { routes: [] });

  const cutB = await get('/api/route?from=vanaz&to=pune-airport&avoid=pune-station');
  assert.deepEqual(cutB.body, { routes: [] });
});;

test('GET /api/route validates input', async () => {
  const missing = await get('/api/route?from=vanaz');
  assert.equal(missing.status, 400);
  assert.match(missing.body.error, /from.*to/i);

  const same = await get('/api/route?from=vanaz&to=vanaz');
  assert.equal(same.status, 200);
  assert.deepEqual(same.body, { routes: [] });
});

// --- reachability --------------------------------------------------------------

test('GET /api/stations/:id/nearby returns stations ordered by hop count', async () => {
  const { body } = await get('/api/stations/vanaz/nearby?hops=2');
  assert.ok(body.length >= 1);
  for (const s of body) assert.ok(s.hops >= 1 && s.hops <= 2);
  const hops = body.map((s) => s.hops);
  assert.deepEqual(hops, [...hops].sort((a, b) => a - b));
});

test('nearby clamps out-of-range hops into 1..5', async () => {
  const wide = await get('/api/stations/vanaz/nearby?hops=99');
  const narrow = await get('/api/stations/vanaz/nearby?hops=1');
  assert.ok(wide.body.every((s) => s.hops <= 5));
  assert.ok(narrow.body.every((s) => s.hops === 1));
});

// --- error surfaces -------------------------------------------------------------

test('unknown endpoints return JSON 404, not an HTML stack', async () => {
  const { status, body } = await get('/api/nope');
  assert.equal(status, 404);
  assert.match(body.error, /No such endpoint/);
});
