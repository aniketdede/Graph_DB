// Express application factory. Kept separate from the listener (index.js) so
// the fully-wired app can be imported and exercised by tests, or mounted
// inside another process, without binding a port.
import express from 'express';
import cors from 'cors';
import config from './config.js';
import apiRouter from './routes/api.js';
import { requestLogger, notFound } from './middleware/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json());
  app.use(requestLogger);

  app.get('/', (_req, res) =>
    res.json({
      name: 'PuneRoutes API',
      mode: config.demoMode ? 'demo' : 'cognodb',
      docs: '/api/health',
    })
  );

  app.use('/api', apiRouter);

  // Registered last: JSON 404 for anything that fell through the API router.
  app.use(notFound);

  return app;
}
