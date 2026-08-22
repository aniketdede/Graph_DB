// Entry point: boot the app, bind the port, own the process lifecycle.
// All routing/middleware wiring lives in app.js so it stays testable.
import config from './config.js';
import { createApp } from './app.js';
import { closeDriver } from './db/driver.js';

const server = createApp().listen(config.port, '0.0.0.0', () => {
  console.log(
    `PuneRoutes API listening on :${config.port} — data layer: ${
      config.demoMode
        ? 'DEMO (in-memory) — set COGNODB_URI & COGNODB_PASSWORD to go live'
        : `CognoDB (${config.neo4j.uri})`
    }`
  );
});

async function shutdown(signal) {
  console.log(`\n${signal} received — shutting down…`);
  server.close();
  await closeDriver().catch(() => {});
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
