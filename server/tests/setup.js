// Hermetic tests: force the in-memory demo data layer even if a developer or
// CI runner has real CognoDB credentials in server/.env. Live-mode behaviour
// is exercised by the running application / hosted demo instead.
// Must be the first import — ESM executes imports in order.
process.env.DEMO_MODE = 'true';
