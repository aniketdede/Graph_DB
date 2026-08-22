import React, { useEffect, useState } from 'react';
import { api } from './api.js';
import JourneyPlanner from './components/JourneyPlanner.jsx';
import ExplorePanel from './components/ExplorePanel.jsx';
import InsightsPanel from './components/InsightsPanel.jsx';
import NetworkGraphMap from './components/NetworkGraphMap.jsx';
import { Loading, ErrorState } from './components/common.jsx';

const TABS = [
  { id: 'plan', label: '🚇 Plan Journey', sub: 'Multi-modal route finder' },
  { id: 'explore', label: '🧭 Reachability', sub: 'Network hop explorer' },
  { id: 'insights', label: '📊 Insights', sub: 'Topology & landmarks' },
];

function statusFor(boot, health) {
  if (boot.status === 'error') return { dot: 'down', text: 'Database unreachable' };
  if (health?.mode === 'cognodb') return { dot: 'live', text: `Live · CognoDB Graph · ${health.nodes} nodes` };
  return { dot: 'demo', text: 'Demo mode · in-memory graph' };
}

export default function App() {
  const [tab, setTab] = useState('plan');
  const [theme, setTheme] = useState('dark'); // dark mode by default for premium transit vibe
  const [viewMode, setViewMode] = useState('split'); // 'split' | 'map' | 'panel'
  const [boot, setBoot] = useState({ status: 'loading', error: null });
  const [health, setHealth] = useState(null);
  const [stations, setStations] = useState([]);
  const [lines, setLines] = useState([]);

  // Active journey planner parameters
  const [plannerParams, setPlannerParams] = useState({
    from: 'vanaz',
    to: 'pune-airport',
    avoid: '',
  });

  // Active highlighted route on the graph map
  const [activeRoute, setActiveRoute] = useState(null);

  // Reachable stations list from Explore panel
  const [reachableStations, setReachableStations] = useState([]);

  const bootstrap = async () => {
    setBoot({ status: 'loading', error: null });
    try {
      const [h, s, l] = await Promise.all([api.health(), api.stations(), api.lines()]);
      setHealth(h);
      setStations(s);
      setLines(l);
      setBoot({ status: 'done', error: null });
    } catch (err) {
      setBoot({ status: 'error', error: err.message });
    }
  };

  useEffect(() => {
    bootstrap();
  }, []);

  const status = statusFor(boot, health);

  // Handle station click inside graph popover
  const handleSelectStationFromMap = (role, stationId) => {
    setPlannerParams((prev) => ({
      ...prev,
      [role]: stationId,
    }));
    setTab('plan');
  };

  const handlePlanJourneyTo = (fromId, toId) => {
    setPlannerParams({ from: fromId, to: toId, avoid: '' });
    setTab('plan');
  };

  return (
    <div className={`app-root theme-${theme}`}>
      {/* Header Bar */}
      <header className="app-header">
        <div className="header-container">
          <div className="brand-logo">
            <div className="logo-badge">🚇</div>
            <div className="brand-text">
              <span className="brand-title">PuneRoutes</span>
              <span className="brand-subtitle">Pune Metro + PMPML Bus Graph Platform</span>
            </div>
          </div>

          <div className="header-actions">
            <div className="view-mode-toggle" aria-label="Layout view mode">
              <button
                type="button"
                className={`view-btn ${viewMode === 'split' ? 'active' : ''}`}
                onClick={() => setViewMode('split')}
                title="Split View"
              >
                📊 Split
              </button>
              <button
                type="button"
                className={`view-btn ${viewMode === 'map' ? 'active' : ''}`}
                onClick={() => setViewMode('map')}
                title="Map View Only"
              >
                🗺️ Map
              </button>
              <button
                type="button"
                className={`view-btn ${viewMode === 'panel' ? 'active' : ''}`}
                onClick={() => setViewMode('panel')}
                title="Controls View Only"
              >
                📋 Controls
              </button>
            </div>

            <button
              type="button"
              className="theme-toggle-btn"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title="Toggle Theme"
            >
              {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
            </button>

            <span className="status-indicator">
              <span className={`status-dot ${status.dot}`} /> {status.text}
            </span>
          </div>
        </div>
      </header>

      {/* Main Layout Area */}
      <main className="app-main-layout">
        {boot.status === 'loading' && (
          <div className="boot-loading-container">
            <Loading text="Initializing Pune Transit Graph Network & CognoDB Connection..." />
          </div>
        )}

        {boot.status === 'error' && (
          <div className="boot-error-container">
            <ErrorState
              message={`${boot.error} — Automatically retrying when database recovers.`}
              onRetry={bootstrap}
            />
          </div>
        )}

        {boot.status === 'done' && (
          <div className={`workspace-split-container mode-${viewMode}`}>
            {/* Left Control Panel */}
            {viewMode !== 'map' && (
              <div className="control-panel-wrapper">
                <nav className="tab-navigation" aria-label="Navigation Tabs">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      className={`tab-item ${tab === t.id ? 'active' : ''}`}
                      onClick={() => setTab(t.id)}
                      type="button"
                    >
                      <span className="tab-label">{t.label}</span>
                      <span className="tab-sub">{t.sub}</span>
                    </button>
                  ))}
                </nav>

                <div className="tab-content-area">
                  {tab === 'plan' && (
                    <JourneyPlanner
                      stations={stations}
                      lines={lines}
                      from={plannerParams.from}
                      to={plannerParams.to}
                      avoid={plannerParams.avoid}
                      onUpdateParams={(updates) =>
                        setPlannerParams((prev) => ({ ...prev, ...updates }))
                      }
                      activeRoute={activeRoute}
                      onSelectRoute={(rt) => setActiveRoute(rt)}
                    />
                  )}
                  {tab === 'explore' && (
                    <ExplorePanel
                      stations={stations}
                      onSetReachableStations={(list) => setReachableStations(list)}
                      onPlanJourneyTo={handlePlanJourneyTo}
                    />
                  )}
                  {tab === 'insights' && (
                    <InsightsPanel onPlanJourneyTo={handlePlanJourneyTo} />
                  )}
                </div>
              </div>
            )}

            {/* Right Interactive Graph Map Visualizer */}
            {viewMode !== 'panel' && (
              <div className="graph-map-panel-wrapper">
                <NetworkGraphMap
                  stations={stations}
                  lines={lines}
                  activeRoute={activeRoute}
                  reachableStations={reachableStations}
                  fromStationId={plannerParams.from}
                  toStationId={plannerParams.to}
                  avoidStationId={plannerParams.avoid}
                  onSelectStation={handleSelectStationFromMap}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-left">
            <h4>PuneRoutes — Multi-Modal Transit Engine</h4>
            <p>
              High-performance transit graph pathfinding over CognoDB (openCypher / Bolt 5.x) & Express + React.
            </p>
          </div>
          <div className="footer-right">
            <span>Powered by <strong>CognoDB</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
