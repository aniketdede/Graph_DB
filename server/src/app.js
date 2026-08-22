// Express application factory. Kept separate from the listener (index.js) so
// the fully-wired app can be imported and exercised by tests, or mounted
// inside another process, without binding a port.
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import config from './config.js';
import apiRouter from './routes/api.js';
import { requestLogger, notFound } from './middleware/index.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  // Production single-service mode: if the client has been built (Vite),
  // serve it and fall back to index.html for SPA routes. Override the
  // location with CLIENT_DIST if hosting the UI elsewhere.
  const clientDist = process.env.CLIENT_DIST || path.join(here, '../../client/dist');
  const servingClient = existsSync(clientDist);

  if (!servingClient) {
    // API-only mode (local dev): a small banner at / instead of the SPA.
    app.get('/', (_req, res) =>
      res.json({
        name: 'PuneRoutes API',
        mode: config.demoMode ? 'demo' : 'cognodb',
        docs: '/api/health',
      })
    );
  }

  app.use('/api', apiRouter);

  if (servingClient) {
    app.use(express.static(clientDist));
    app.get('*', (req, res, next) =>
      req.path.startsWith('/api') ? next() : res.sendFile(path.join(clientDist, 'index.html'))
    );
  }

  // Registered last: JSON 404 for anything that fell through the API router.
  app.use(notFound);

  return app;
}
