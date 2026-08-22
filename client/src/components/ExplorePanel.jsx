import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { Loading, EmptyState, ErrorState, LineBadge } from './common.jsx';
import StationSearchInput from './StationSearchInput.jsx';

const HOP_OPTIONS = [1, 2, 3, 4, 5];

export default function ExplorePanel({ stations = [], onSetReachableStations, onPlanJourneyTo }) {
  const [station, setStation] = useState('civil-court');
  const [hops, setHops] = useState(2);
  const [result, setResult] = useState({ status: 'loading', data: [], error: null });

  const load = useCallback(async () => {
    if (!station) return;
    setResult({ status: 'loading', data: [], error: null });
    try {
      const data = await api.nearby(station, hops);
      setResult({ status: 'done', data, error: null });
      if (onSetReachableStations) {
        onSetReachableStations(data);
      }
    } catch (err) {
      setResult({ status: 'error', data: [], error: err.message });
      if (onSetReachableStations) {
        onSetReachableStations([]);
      }
    }
  }, [station, hops, onSetReachableStations]);

  useEffect(() => {
    load();
  }, [load]);

  // Clean up reachable highlight when unmounting component
  useEffect(() => {
    return () => {
      if (onSetReachableStations) onSetReachableStations([]);
    };
  }, [onSetReachableStations]);

  return (
    <section className="panel explore-panel">
      <div className="panel-header">
        <h2>🧭 Reachability Explorer</h2>
        <p className="sub">
          Variable-length graph traversal query (shortestPath): computes all network nodes reachable within N stop transfers.
        </p>
      </div>

      <div className="explore-form-grid">
        <StationSearchInput
          id="explore-station-input"
          label="Center Station"
          stations={stations}
          value={station}
          onChange={(val) => setStation(val)}
          placeholder="Search starting station..."
        />

        <div className="hops-selector-container">
          <label className="field-label">Maximum Transfer Hops</label>
          <div className="hops-btn-group">
            {HOP_OPTIONS.map((h) => (
              <button
                key={h}
                type="button"
                className={`hop-btn ${hops === h ? 'active' : ''}`}
                onClick={() => setHops(h)}
              >
                {h} Hop{h > 1 ? 's' : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {result.status === 'loading' && (
        <Loading text="Traversing variable-length shortest paths in CognoDB..." />
      )}

      {result.status === 'error' && (
        <ErrorState message={result.error} onRetry={load} />
      )}

      {result.status === 'done' && result.data.length === 0 && (
        <EmptyState icon="🔍" title="No stations reachable" hint="Try increasing the hop limit." />
      )}

      {result.status === 'done' && result.data.length > 0 && (
        <div className="explore-results">
          <div className="banner info-banner">
            ✨ <strong>{result.data.length} stations</strong> reachable within <strong>{hops} hop{hops > 1 ? 's' : ''}</strong> from {stations.find((s) => s.id === station)?.name || station}.
          </div>

          <div className="explore-list">
            {result.data.map((s) => (
              <div className="explore-item-card" key={s.id}>
                <div className="hop-pill">{s.hops} hop{s.hops > 1 ? 's' : ''}</div>
                <div className="item-info">
                  <div className="item-title">{s.name}</div>
                  <div className="item-zone">{s.zone}</div>
                </div>
                <div className="item-lines">
                  {s.lines.map((line) => (
                    <LineBadge key={line.id} line={line} />
                  ))}
                </div>
                {onPlanJourneyTo && (
                  <button
                    type="button"
                    className="btn ghost-btn mini-btn"
                    onClick={() => onPlanJourneyTo(station, s.id)}
                  >
                    Plan Journey ➔
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
