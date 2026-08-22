import express from 'express';
import cors from 'cors';
import config from './config.js';
import apiRouter from './routes/api.js';
import { closeDriver } from './db/driver.js';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', apiRouter);

app.get('/', (_req, res) =>
  res.json({ name: 'PuneRoutes API', mode: config.demoMode ? 'demo' : 'cognodb', docs: '/api/health' })
);

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(
    `PuneRoutes API listening on :${config.port} — data layer: ${
      config.demoMode ? 'DEMO (in-memory) — set COGNODB_URI & COGNODB_PASSWORD to go live' : `CognoDB (${config.neo4j.uri})`
    }`
  );
});

process.on('SIGTERM', async () => {
  server.close();
  await closeDriver();
  process.exit(0);
});
