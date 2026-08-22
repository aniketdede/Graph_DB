import React, { useEffect, useState, useMemo } from 'react';
import { api } from '../api.js';
import { Loading, EmptyState, ErrorState, LineBadge } from './common.jsx';

export default function InsightsPanel({ onPlanJourneyTo }) {
  const [result, setResult] = useState({ status: 'loading', data: null, error: null });
  const [landmarkCategory, setLandmarkCategory] = useState('All');

  const load = async () => {
    setResult({ status: 'loading', data: null, error: null });
    try {
      const [stats, interchanges, lines, landmarks] = await Promise.all([
        api.stats(),
        api.interchanges(),
        api.lines(),
        api.landmarks(),
      ]);
      setResult({ status: 'done', data: { stats, interchanges, lines, landmarks }, error: null });
    } catch (err) {
      setResult({ status: 'error', data: null, error: err.message });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const categories = useMemo(() => {
    if (!result.data?.landmarks) return ['All'];
    const cats = new Set(result.data.landmarks.map((l) => l.category));
    return ['All', ...Array.from(cats)];
  }, [result.data]);

  const filteredLandmarks = useMemo(() => {
    if (!result.data?.landmarks) return [];
    if (landmarkCategory === 'All') return result.data.landmarks;
    return result.data.landmarks.filter((l) => l.category === landmarkCategory);
  }, [result.data, landmarkCategory]);

  if (result.status === 'loading') {
    return (
      <section className="panel">
        <Loading text="Executing live aggregation queries across CognoDB graph database…" />
      </section>
    );
  }

  if (result.status === 'error') {
    return (
      <section className="panel">
        <ErrorState message={result.error} onRetry={load} />
      </section>
    );
  }

  const { stats, interchanges, lines } = result.data;

  return (
    <>
      {/* Network Overview Stats */}
      <section className="panel insights-overview-panel">
        <div className="panel-header">
          <h2>📊 Network Overview</h2>
          <p className="sub">Real-time graph metrics & degree centrality computed on CognoDB.</p>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon">🚇</div>
            <div className="kpi-value">{stats.stations}</div>
            <div className="kpi-label">Total Stations</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">🔀</div>
            <div className="kpi-value">{stats.lines}</div>
            <div className="kpi-label">Transit Lines</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">🛤️</div>
            <div className="kpi-value">{stats.segments}</div>
            <div className="kpi-label">Track Segments</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon">🏛️</div>
            <div className="kpi-value">{stats.landmarks}</div>
            <div className="kpi-label">City Landmarks</div>
          </div>
        </div>

        <div className="banner highlight-banner">
          🏆 <strong>Busiest Central Hub:</strong> {stats.busiestStation} with <strong>{stats.busiestDegree} direct line connections</strong>.
        </div>
      </section>

      {/* Interchanges Section */}
      <section className="panel interchanges-panel">
        <div className="panel-header">
          <h2>🔀 Key Interchange Hubs</h2>
          <p className="sub">Multi-line transfer hubs connecting Metro & Bus corridors.</p>
        </div>

        {interchanges.length === 0 ? (
          <EmptyState icon="🔀" title="No interchanges found" />
        ) : (
          <div className="interchange-grid">
            {interchanges.map((s) => (
              <div className="interchange-card" key={s.id}>
                <div className="ic-header">
                  <span className="ic-title">{s.name}</span>
                  <span className="ic-zone">{s.zone}</span>
                </div>
                <div className="ic-lines">
                  {s.lines.map((line) => (
                    <LineBadge key={line.id} line={line} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Dual Column Layout: Lines & Landmarks */}
      <div className="insights-split-grid">
        {/* Transit Lines */}
        <section className="panel lines-panel">
          <div className="panel-header">
            <h2>🚇 Lines Directory</h2>
            <p className="sub">Corridor details & stop counts.</p>
          </div>
          <div className="lines-list">
            {lines.map((line) => (
              <div className="line-item-row" key={line.id}>
                <LineBadge line={line} />
                <span className="line-stations-count">{line.stationCount} stations</span>
              </div>
            ))}
          </div>
        </section>

        {/* Landmarks */}
        <section className="panel landmarks-panel">
          <div className="panel-header">
            <h2>🏛️ City Landmarks</h2>
            <p className="sub">Points of interest & nearest transit access.</p>
          </div>

          <div className="category-filter-bar">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`cat-filter-btn ${landmarkCategory === cat ? 'active' : ''}`}
                onClick={() => setLandmarkCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="landmarks-list">
            {filteredLandmarks.map((lm) => {
              const nearestStation = lm.stations && lm.stations[0];
              return (
                <div className="landmark-card" key={lm.id}>
                  <div className="lm-main">
                    <span className="lm-name">{lm.name}</span>
                    <span className="lm-cat-tag">{lm.category}</span>
                  </div>
                  <div className="lm-sub">
                    📍 Near: {lm.stations.map((s) => s.name).join(', ')}
                  </div>
                  {nearestStation && onPlanJourneyTo && (
                    <button
                      type="button"
                      className="btn ghost-btn mini-btn lm-plan-btn"
                      onClick={() => onPlanJourneyTo('vanaz', nearestStation.id)}
                    >
                      Plan Route Here ➔
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
}
