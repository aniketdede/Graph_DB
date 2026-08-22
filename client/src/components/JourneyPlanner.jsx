import React, { useMemo, useState } from 'react';
import { api } from '../api.js';
import { Loading, EmptyState, ErrorState, LineBadge } from './common.jsx';
import StationSearchInput from './StationSearchInput.jsx';

/** Group consecutive steps on the same line into displayable legs. */
function toLegs(steps) {
  return steps.reduce((legs, step) => {
    const last = legs[legs.length - 1];
    if (last?.lineId === step.lineId) {
      last.stops.push(step.to);
      last.timeMin += step.timeMin;
    } else {
      legs.push({ lineId: step.lineId, from: step.from, stops: [step.to], timeMin: step.timeMin });
    }
    return legs;
  }, []);
}

function calculateFare(route) {
  // Base fare ₹15 + ₹5 per 2 stops + ₹10 per transfer
  const stopCount = route.steps.length;
  const base = 15;
  const distanceCost = Math.ceil(stopCount * 3.5);
  const transferCost = route.transfers * 10;
  return base + distanceCost + transferCost;
}

function calculateCarbonSavings(route) {
  // Average car emissions: ~120g CO2/km vs Metro/Bus: ~20g CO2/km
  // Approx 0.15 kg CO2 saved per travel minute
  return (route.totalTime * 0.14).toFixed(1);
}

function RouteCard({ route, lineMap, isBest, isSelected, onSelectRoute }) {
  const legs = useMemo(() => toLegs(route.steps), [route]);
  const estimatedFare = useMemo(() => calculateFare(route), [route]);
  const carbonSaved = useMemo(() => calculateCarbonSavings(route), [route]);

  return (
    <article
      className={`route-card ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelectRoute && onSelectRoute(route)}
    >
      <div className="route-header-row">
        <div className="route-time-block">
          <span className="route-time">~{route.totalTime} min</span>
          <span className="route-time-sub">total travel time</span>
        </div>
        <div className="route-metrics">
          <span className="metric-tag fare-tag">💰 ~₹{estimatedFare} fare</span>
          <span className="metric-tag eco-tag">🌱 {carbonSaved} kg CO₂ saved</span>
        </div>
      </div>

      <div className="route-summary-chips">
        <span className="chip">{route.steps.length} total stops</span>
        <span className="chip">
          {route.transfers === 0
            ? 'Direct — no transfers'
            : `${route.transfers} transfer${route.transfers > 1 ? 's' : ''}`}
        </span>
        {isBest && <span className="chip best">★ Recommended Route</span>}
      </div>

      <div className="route-legs-timeline">
        {legs.map((leg, i) => {
          const line = lineMap[leg.lineId];
          const color = line?.color ?? 'var(--accent)';
          const lastStop = leg.stops[leg.stops.length - 1];
          return (
            <div className="leg-item" key={`${leg.lineId}-${i}`}>
              <div className="leg-rail">
                <div className="leg-node-dot" style={{ borderColor: color, backgroundColor: color }} />
                <div className="leg-line-bar" style={{ backgroundColor: color }} />
                {i === legs.length - 1 && (
                  <div className="leg-node-dot end" style={{ borderColor: color, backgroundColor: '#ffffff' }} />
                )}
              </div>
              <div className="leg-content">
                <div className="leg-station-title">{leg.from.name}</div>
                <div className="leg-badge-row">
                  <LineBadge line={line} />
                  <span className="leg-meta">
                    {leg.stops.length} stop{leg.stops.length > 1 ? 's' : ''} ({leg.timeMin} min) →{' '}
                    <strong>{lastStop.name}</strong>
                  </span>
                </div>
                {i < legs.length - 1 && (
                  <div className="transfer-callout">
                    <span>⇄</span> Transfer at <strong>{lastStop.name}</strong>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

const PRESET_ROUTES = [
  { label: 'Vanaz ➔ Airport', from: 'vanaz', to: 'pune-airport', desc: 'Metro + Bus' },
  { label: 'PCMC ➔ Swargate', from: 'pcmc', to: 'swargate', desc: 'Purple Line Direct' },
  { label: 'Shivajinagar ➔ Hinjawadi', from: 'shivajinagar', to: 'hinjawadi', desc: 'IT Park Corridor' },
  { label: 'Swargate ➔ Katraj', from: 'swargate', to: 'katraj', desc: 'BRT Express' },
];

export default function JourneyPlanner({
  stations = [],
  lines = [],
  from = 'vanaz',
  to = 'pune-airport',
  avoid = '',
  onUpdateParams,
  activeRoute,
  onSelectRoute,
}) {
  const [search, setSearch] = useState({ status: 'idle', routes: [], error: null });

  const lineMap = useMemo(() => Object.fromEntries(lines.map((l) => [l.id, l])), [lines]);
  const sameStation = from && to && from === to;

  const findRoutes = async (fromId = from, toId = to, avoidId = avoid) => {
    if (!fromId || !toId || fromId === toId) return;
    setSearch({ status: 'loading', routes: [], error: null });
    try {
      const { routes } = await api.route(fromId, toId, avoidId || undefined);
      setSearch({ status: 'done', routes, error: null });
      if (routes && routes.length > 0 && onSelectRoute) {
        onSelectRoute(routes[0]);
      }
    } catch (err) {
      setSearch({ status: 'error', routes: [], error: err.message });
    }
  };

  const swap = () => {
    if (onUpdateParams) {
      onUpdateParams({ from: to, to: from });
    }
  };

  const handlePresetClick = (preset) => {
    if (onUpdateParams) {
      onUpdateParams({ from: preset.from, to: preset.to });
    }
    findRoutes(preset.from, preset.to, avoid);
  };

  return (
    <>
      <section className="panel planner-panel">
        <div className="panel-header">
          <h2>🚇 Plan Journey</h2>
          <p className="sub">
            Fastest multi-modal routing engine powered by openCypher graph traversals in CognoDB.
          </p>
        </div>

        {/* Quick Route Presets */}
        <div className="presets-wrapper">
          <span className="presets-label">Popular routes:</span>
          <div className="presets-chips">
            {PRESET_ROUTES.map((p, idx) => (
              <button
                key={idx}
                type="button"
                className={`preset-chip ${from === p.from && to === p.to ? 'active' : ''}`}
                onClick={() => handlePresetClick(p)}
              >
                <span>{p.label}</span>
                <small>{p.desc}</small>
              </button>
            ))}
          </div>
        </div>

        {/* Form controls */}
        <div className="planner-form-grid">
          <StationSearchInput
            id="from-search"
            label="Origin Station"
            stations={stations}
            value={from}
            onChange={(val) => onUpdateParams && onUpdateParams({ from: val })}
            placeholder="Search starting station..."
            badgeText="Origin"
          />

          <button className="swap-action-btn" aria-label="Swap origin and destination" onClick={swap} type="button">
            ⇄
          </button>

          <StationSearchInput
            id="to-search"
            label="Destination Station"
            stations={stations}
            value={to}
            excludeId={from}
            onChange={(val) => onUpdateParams && onUpdateParams({ to: val })}
            placeholder="Search destination station..."
            badgeText="Destination"
          />

          <StationSearchInput
            id="avoid-search"
            label="Simulate Closed Station"
            stations={stations}
            value={avoid}
            excludeId={from}
            onChange={(val) => onUpdateParams && onUpdateParams({ avoid: val })}
            placeholder="— Select optional station closure —"
            badgeText="Disruption"
          />

          <div className="form-submit-container">
            <button
              className="btn primary-btn find-btn"
              onClick={() => findRoutes(from, to, avoid)}
              disabled={search.status === 'loading' || !from || !to || sameStation}
              type="button"
            >
              {search.status === 'loading' ? (
                <>
                  <span className="mini-spinner" /> Finding...
                </>
              ) : (
                'Find Fastest Routes'
              )}
            </button>
          </div>
        </div>

        {sameStation && (
          <div className="banner warning-banner">
            ⚠️ Origin and destination are the same — please select two distinct stations.
          </div>
        )}

        {avoid && (
          <div className="banner info-banner">
            🚧 Simulating closed station: <strong>{stations.find((s) => s.id === avoid)?.name || avoid}</strong>. Graph traversal will reroute around this station.
          </div>
        )}
      </section>

      {search.status === 'idle' && (
        <section className="panel empty-panel">
          <EmptyState
            icon="🧭"
            title="Ready to navigate Pune"
            hint="Select your origin and destination above or click any station on the interactive map."
          />
        </section>
      )}

      {search.status === 'loading' && (
        <section className="panel loading-panel">
          <Loading text="Executing multi-hop graph pathfinding query in CognoDB…" />
        </section>
      )}

      {search.status === 'error' && (
        <section className="panel error-panel">
          <ErrorState message={search.error} onRetry={() => findRoutes(from, to, avoid)} />
        </section>
      )}

      {search.status === 'done' && search.routes.length === 0 && (
        <section className="panel no-route-panel">
          <EmptyState
            icon="🚧"
            title="No connecting route found"
            hint={
              avoid
                ? 'Closing this station breaks network connectivity between origin and destination. Try clearing the closed station.'
                : 'No path connects these two stations in the transit network.'
            }
          />
        </section>
      )}

      {search.routes.length > 0 && (
        <section className="panel results-panel">
          <div className="results-header">
            <h3>{search.routes.length} Optimal Route Option{search.routes.length > 1 ? 's' : ''}</h3>
            <span className="results-subtitle">
              Ranked by travel time + 4 min transfer penalty. Click a route to view on map.
            </span>
          </div>

          <div className="routes-list">
            {search.routes.map((route, i) => (
              <RouteCard
                key={i}
                route={route}
                lineMap={lineMap}
                isBest={i === 0}
                isSelected={activeRoute === route}
                onSelectRoute={onSelectRoute}
              />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
