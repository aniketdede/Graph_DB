import { Router } from 'express';
import config from '../config.js';
import * as graphService from '../services/graphService.js';
import * as demoService from '../services/demoService.js';

const service = config.demoMode ? demoService : graphService;
const router = Router();

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const isUnreachable = (err) =>
  err.code === 'ServiceUnavailable' ||
  err.code === 'SessionExpired' ||
  /connect|routing|pool|unavailable/i.test(err.message ?? '');

/** Wrap an async handler with uniform JSON error responses. */
const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    console.error(`[api] ${req.method} ${req.originalUrl} →`, err.message);
    if (isUnreachable(err)) {
      res.status(503).json({ error: 'Database is unreachable. Please check the CognoDB instance and try again.' });
    } else if (err.status === 400) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: 'Something went wrong while querying the graph.' });
    }
  }
};

const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

router.get('/health', handle(async () => ({ ok: true, ...(await service.health()) })));
router.get('/stations', handle(() => service.listStations()));
router.get('/lines', handle(() => service.listLines()));
router.get('/interchanges', handle(() => service.interchanges()));
router.get('/landmarks', handle(() => service.listLandmarks()));
router.get('/stats', handle(() => service.stats()));

router.get('/route', handle(async (req) => {
  const { from, to, avoid } = req.query;
  if (!from || !to) throw badRequest('Query parameters "from" and "to" are required.');
  if (from === to) return { routes: [] };
  return { routes: await service.findRoutes({ from, to, avoid: avoid || null }) };
}));

router.get('/stations/:id/nearby', handle((req) => {
  const hops = clamp(parseInt(req.query.hops, 10) || 2, 1, 5);
  return service.nearbyStations({ id: req.params.id, hops });
}));

export default router;
