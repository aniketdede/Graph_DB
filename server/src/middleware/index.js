// Cross-cutting HTTP middleware: structured request logging and JSON 404s.

/** Log one line per request: timestamp, method, path, status, duration. */
export function requestLogger(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(
      `${new Date().toISOString()} ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms.toFixed(1)}ms)`
    );
  });
  next();
}

/** Terminating middleware: unknown routes get a JSON body, not an HTML stack. */
export function notFound(req, res) {
  res.status(404).json({ error: `No such endpoint: ${req.method} ${req.originalUrl}` });
}
