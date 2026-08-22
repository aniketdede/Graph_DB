import React, { useMemo, useState } from 'react';

// Static station coordinate mapping (800x600 SVG canvas viewbox)
export const STATION_COORDS = {
  // Purple Line (Metro - North -> South)
  'pcmc': { x: 320, y: 40 },
  'sant-tukaram-nagar': { x: 330, y: 75 },
  'bhosari': { x: 340, y: 110 },
  'kasarwadi': { x: 350, y: 145 },
  'phugewadi': { x: 360, y: 180 },
  'dapodi': { x: 370, y: 210 },
  'bopodi': { x: 380, y: 235 },
  'khadki': { x: 388, y: 255 },
  'range-hills': { x: 392, y: 275 },
  'shivajinagar': { x: 396, y: 288 },
  'civil-court': { x: 400, y: 300 }, // Key Interchange
  'budhwar-peth': { x: 395, y: 345 },
  'mandai': { x: 390, y: 385 },
  'swargate': { x: 380, y: 430 }, // Bus Interchange

  // Aqua Line (Metro - West -> East)
  'vanaz': { x: 60, y: 320 },
  'anand-nagar': { x: 100, y: 318 },
  'ideal-colony': { x: 140, y: 315 },
  'nal-stop': { x: 180, y: 312 },
  'garware-college': { x: 220, y: 310 },
  'deccan': { x: 265, y: 308 },
  'sambhaji-udyan': { x: 310, y: 305 },
  'pmc': { x: 355, y: 302 },
  // civil-court: { x: 400, y: 300 },
  'mangalwar-peth': { x: 445, y: 298 },
  'pune-station': { x: 490, y: 295 }, // Bus + Metro Interchange
  'ruby-hall': { x: 535, y: 290 },
  'bund-garden': { x: 580, y: 285 },
  'yerawada': { x: 630, y: 275 },
  'kalyani-nagar': { x: 680, y: 265 },
  'ramwadi': { x: 730, y: 250 },

  // Bus: Katraj BRT (South from Swargate)
  'market-yard': { x: 400, y: 470 },
  'bibwewadi': { x: 415, y: 510 },
  'katraj': { x: 430, y: 550 },

  // Bus: Airport Shuttle (East/North-East)
  'koregaon-park': { x: 550, y: 230 },
  'viman-nagar': { x: 710, y: 195 },
  'pune-airport': { x: 740, y: 135 },

  // Bus: Hinjawadi Express (North-West from Shivajinagar)
  'university-circle': { x: 310, y: 235 },
  'aundh': { x: 250, y: 190 },
  'baner': { x: 190, y: 150 },
  'wakad': { x: 130, y: 110 },
  'hinjawadi': { x: 70, y: 70 },

  // Bus: Hadapsar Corridor (South-East from Swargate)
  'fatima-nagar': { x: 470, y: 450 },
  'magarpatta': { x: 550, y: 470 },
  'hadapsar': { x: 630, y: 490 },
};

// Line definitions with color, mode and ordered station paths
const LINE_TRACKS = [
  {
    id: 'purple',
    name: 'Purple Line (Metro)',
    color: '#8b5cf6',
    width: 6,
    dash: null,
    stops: [
      'pcmc', 'sant-tukaram-nagar', 'bhosari', 'kasarwadi', 'phugewadi',
      'dapodi', 'bopodi', 'khadki', 'range-hills', 'shivajinagar',
      'civil-court', 'budhwar-peth', 'mandai', 'swargate',
    ],
  },
  {
    id: 'aqua',
    name: 'Aqua Line (Metro)',
    color: '#06b6d4',
    width: 6,
    dash: null,
    stops: [
      'vanaz', 'anand-nagar', 'ideal-colony', 'nal-stop', 'garware-college',
      'deccan', 'sambhaji-udyan', 'pmc', 'civil-court', 'mangalwar-peth',
      'pune-station', 'ruby-hall', 'bund-garden', 'yerawada',
      'kalyani-nagar', 'ramwadi',
    ],
  },
  {
    id: 'bus-katraj',
    name: 'Rainbow BRT — Katraj',
    color: '#f59e0b',
    width: 4,
    dash: '6,4',
    stops: ['swargate', 'market-yard', 'bibwewadi', 'katraj'],
  },
  {
    id: 'bus-airport',
    name: 'PMPML — Airport Shuttle',
    color: '#ef4444',
    width: 4,
    dash: '6,4',
    stops: ['pune-station', 'koregaon-park', 'kalyani-nagar', 'viman-nagar', 'pune-airport'],
  },
  {
    id: 'bus-hinjawadi',
    name: 'PMPML — Hinjawadi Express',
    color: '#22c55e',
    width: 4,
    dash: '6,4',
    stops: ['shivajinagar', 'university-circle', 'aundh', 'baner', 'wakad', 'hinjawadi'],
  },
  {
    id: 'bus-hadapsar',
    name: 'PMPML — Hadapsar Corridor',
    color: '#f472b6',
    width: 4,
    dash: '6,4',
    stops: ['swargate', 'fatima-nagar', 'magarpatta', 'hadapsar'],
  },
];

export default function NetworkGraphMap({
  stations = [],
  lines = [],
  activeRoute = null,
  reachableStations = [],
  fromStationId = null,
  toStationId = null,
  avoidStationId = null,
  onSelectStation = null,
}) {
  const [hoveredStation, setHoveredStation] = useState(null);
  const [selectedPopStation, setSelectedPopStation] = useState(null);

  // Map station details by ID
  const stationMap = useMemo(() => {
    return Object.fromEntries(stations.map((s) => [s.id, s]));
  }, [stations]);

  // Set of reachable station IDs for fast lookup
  const reachableSet = useMemo(() => {
    const map = new Map();
    reachableStations.forEach((item) => {
      map.set(item.id, item.hops);
    });
    return map;
  }, [reachableStations]);

  // Extract path edges for the active selected route
  const activeRouteSegments = useMemo(() => {
    if (!activeRoute || !activeRoute.steps) return [];
    return activeRoute.steps.map((step) => {
      const fromPos = STATION_COORDS[step.from.id] || { x: 0, y: 0 };
      const toPos = STATION_COORDS[step.to.id] || { x: 0, y: 0 };
      return {
        fromId: step.from.id,
        toId: step.to.id,
        lineId: step.lineId,
        x1: fromPos.x,
        y1: fromPos.y,
        x2: toPos.x,
        y2: toPos.y,
      };
    });
  }, [activeRoute]);

  const handleStationClick = (stId) => {
    const st = stationMap[stId];
    if (st) {
      setSelectedPopStation(st);
    }
  };

  return (
    <div className="graph-map-wrapper">
      <div className="graph-map-header">
        <div className="graph-title">
          <span>🚇</span> Pune Multi-Modal Transit Graph Map
        </div>
        <div className="graph-legend">
          <span className="legend-item"><span className="legend-line metro-purple" /> Metro Purple</span>
          <span className="legend-item"><span className="legend-line metro-aqua" /> Metro Aqua</span>
          <span className="legend-item"><span className="legend-line bus-brt" /> PMPML Buses</span>
          <span className="legend-item"><span className="legend-node interchange" /> Interchange</span>
        </div>
      </div>

      <div className="graph-canvas-container">
        <svg viewBox="0 0 800 600" className="graph-svg" aria-label="Pune Transit Network Map">
          <defs>
            {/* Glow Filter for Active Routes */}
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Pulse animation keyframe in style */}
          </defs>

          {/* Background grid pattern */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
          </pattern>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Render Transit Lines / Tracks */}
          <g className="tracks-layer">
            {LINE_TRACKS.map((lineTrack) => {
              const points = lineTrack.stops
                .map((id) => STATION_COORDS[id])
                .filter(Boolean);
              if (points.length < 2) return null;
              const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

              return (
                <g key={lineTrack.id} className="line-group">
                  {/* Outer casing */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={lineTrack.color}
                    strokeWidth={lineTrack.width + 4}
                    strokeOpacity="0.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {/* Inner line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={lineTrack.color}
                    strokeWidth={lineTrack.width}
                    strokeDasharray={lineTrack.dash}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
              );
            })}
          </g>

          {/* Active Highlighted Route Path Layer */}
          {activeRouteSegments.length > 0 && (
            <g className="active-route-layer">
              {activeRouteSegments.map((seg, idx) => (
                <g key={`route-seg-${idx}`}>
                  {/* Glowing background line */}
                  <line
                    x1={seg.x1}
                    y1={seg.y1}
                    x2={seg.x2}
                    y2={seg.y2}
                    stroke="#ec4899"
                    strokeWidth="10"
                    strokeOpacity="0.6"
                    strokeLinecap="round"
                    filter="url(#glow)"
                  />
                  {/* Animated dash line */}
                  <line
                    x1={seg.x1}
                    y1={seg.y1}
                    x2={seg.x2}
                    y2={seg.y2}
                    stroke="#ffffff"
                    strokeWidth="5"
                    strokeDasharray="8 6"
                    className="animated-route-dash"
                    strokeLinecap="round"
                  />
                </g>
              ))}
            </g>
          )}

          {/* Render Station Nodes */}
          <g className="stations-layer">
            {Object.entries(STATION_COORDS).map(([stId, coords]) => {
              const st = stationMap[stId] || { id: stId, name: stId, zone: '' };
              const isOrigin = fromStationId === stId;
              const isDestination = toStationId === stId;
              const isAvoid = avoidStationId === stId;
              const isReachable = reachableSet.has(stId);
              const hopDist = reachableSet.get(stId);
              const isHovered = hoveredStation === stId;
              const isInterchange = stId === 'civil-court' || stId === 'swargate' || stId === 'pune-station' || stId === 'kalyani-nagar' || stId === 'shivajinagar';

              // Check if part of active route
              const isRouteNode = activeRoute?.steps?.some(
                (s) => s.from.id === stId || s.to.id === stId
              );

              return (
                <g
                  key={stId}
                  transform={`translate(${coords.x}, ${coords.y})`}
                  className={`station-node ${isHovered ? 'hovered' : ''} ${isAvoid ? 'disabled' : ''}`}
                  onClick={() => handleStationClick(stId)}
                  onMouseEnter={() => setHoveredStation(stId)}
                  onMouseLeave={() => setHoveredStation(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Reachability Hop Halo */}
                  {isReachable && (
                    <circle
                      r={16 + (6 - Math.min(hopDist, 5)) * 3}
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                      opacity="0.75"
                    >
                      <animate attributeName="r" values="14;24;14" dur="3s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Avoided / Closed Station Red Strike Halo */}
                  {isAvoid && (
                    <g>
                      <circle r="14" fill="rgba(239, 68, 68, 0.2)" stroke="#ef4444" strokeWidth="2" />
                      <line x1="-10" y1="-10" x2="10" y2="10" stroke="#ef4444" strokeWidth="3" />
                    </g>
                  )}

                  {/* Origin / Destination Pin Halo */}
                  {isOrigin && (
                    <circle r="18" fill="rgba(34, 197, 94, 0.25)" stroke="#22c55e" strokeWidth="2.5">
                      <animate attributeName="r" values="16;22;16" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {isDestination && (
                    <circle r="18" fill="rgba(168, 85, 247, 0.25)" stroke="#a855f7" strokeWidth="2.5">
                      <animate attributeName="r" values="16;22;16" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {/* Main Node Circle */}
                  <circle
                    r={isInterchange ? 9 : 6}
                    fill={
                      isAvoid
                        ? '#ef4444'
                        : isOrigin
                        ? '#22c55e'
                        : isDestination
                        ? '#a855f7'
                        : isRouteNode
                        ? '#ec4899'
                        : isInterchange
                        ? '#ffffff'
                        : '#1e293b'
                    }
                    stroke={
                      isAvoid
                        ? '#991b1b'
                        : isOrigin
                        ? '#ffffff'
                        : isDestination
                        ? '#ffffff'
                        : isRouteNode
                        ? '#ffffff'
                        : isInterchange
                        ? '#0f172a'
                        : '#64748b'
                    }
                    strokeWidth={isInterchange || isRouteNode ? 3 : 2}
                  />

                  {/* Hop Count Badge */}
                  {isReachable && (
                    <text
                      y="-14"
                      textAnchor="middle"
                      fill="#06b6d4"
                      fontSize="10"
                      fontWeight="bold"
                      className="hop-text"
                    >
                      {hopDist}h
                    </text>
                  )}

                  {/* Station Label */}
                  <text
                    x={coords.x > 400 ? 12 : -12}
                    y={4}
                    textAnchor={coords.x > 400 ? 'start' : 'end'}
                    fill={isHovered || isRouteNode || isOrigin || isDestination ? '#f8fafc' : '#94a3b8'}
                    fontSize={isInterchange || isOrigin || isDestination ? '11' : '9.5'}
                    fontWeight={isInterchange || isRouteNode || isOrigin || isDestination ? '700' : '400'}
                    className="station-label"
                  >
                    {st.name}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {/* Selected Station Mini Action Popover */}
      {selectedPopStation && (
        <div className="graph-popover">
          <div className="popover-header">
            <div>
              <strong>{selectedPopStation.name}</strong>
              <small>{selectedPopStation.zone}</small>
            </div>
            <button className="popover-close" onClick={() => setSelectedPopStation(null)}>✕</button>
          </div>
          <div className="popover-actions">
            <button
              className="popover-btn origin-btn"
              onClick={() => {
                if (onSelectStation) onSelectStation('from', selectedPopStation.id);
                setSelectedPopStation(null);
              }}
            >
              🚩 Set as Origin
            </button>
            <button
              className="popover-btn dest-btn"
              onClick={() => {
                if (onSelectStation) onSelectStation('to', selectedPopStation.id);
                setSelectedPopStation(null);
              }}
            >
              🏁 Set Destination
            </button>
            <button
              className="popover-btn avoid-btn"
              onClick={() => {
                if (onSelectStation) onSelectStation('avoid', selectedPopStation.id);
                setSelectedPopStation(null);
              }}
            >
              🚧 Close Station
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
