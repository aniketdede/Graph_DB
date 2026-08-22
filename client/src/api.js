// Tiny fetch wrapper with uniform error surface.
async function request(path) {
  let res;
  try {
    res = await fetch(`/api${path}`);
  } catch {
    throw new Error('Cannot reach the PuneRoutes API. Is the server running?');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`);
  return body;
}

export const api = {
  health: () => request('/health'),
  stations: () => request('/stations'),
  lines: () => request('/lines'),
  interchanges: () => request('/interchanges'),
  landmarks: () => request('/landmarks'),
  stats: () => request('/stats'),
  route: (from, to, avoid) =>
    request(`/route?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${avoid ? `&avoid=${encodeURIComponent(avoid)}` : ''}`),
  nearby: (id, hops) => request(`/stations/${encodeURIComponent(id)}/nearby?hops=${hops}`),
};
