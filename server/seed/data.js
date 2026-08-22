// ---------------------------------------------------------------------------
// PuneRoutes seed dataset
// Realistic model of Pune's transit network:
//  - Pune Metro Purple Line (PCMC <-> Swargate)
//  - Pune Metro Aqua Line   (Vanaz <-> Ramwadi)
//  - Four key PMPML / Rainbow BRT bus corridors
//  - City landmarks linked to their nearest stations
// Travel times are minutes between adjacent stops (approximate, realistic).
// ---------------------------------------------------------------------------

export const lines = [
  { id: 'purple', name: 'Purple Line (Metro)', mode: 'metro', color: '#8b5cf6' },
  { id: 'aqua', name: 'Aqua Line (Metro)', mode: 'metro', color: '#06b6d4' },
  { id: 'bus-katraj', name: 'Rainbow BRT — Katraj', mode: 'bus', color: '#f59e0b' },
  { id: 'bus-airport', name: 'PMPML — Airport Shuttle', mode: 'bus', color: '#ef4444' },
  { id: 'bus-hinjawadi', name: 'PMPML — Hinjawadi Express', mode: 'bus', color: '#22c55e' },
  { id: 'bus-hadapsar', name: 'PMPML — Hadapsar Corridor', mode: 'bus', color: '#f472b6' },
];

export const stations = [
  // Purple Line (north -> south)
  { id: 'pcmc', name: 'PCMC Bhavan', zone: 'Pimpri-Chinchwad' },
  { id: 'sant-tukaram-nagar', name: 'Sant Tukaram Nagar', zone: 'Pimpri-Chinchwad' },
  { id: 'bhosari', name: 'Bhosari (Nashik Phata)', zone: 'Pimpri-Chinchwad' },
  { id: 'kasarwadi', name: 'Kasarwadi', zone: 'Pimpri-Chinchwad' },
  { id: 'phugewadi', name: 'Phugewadi', zone: 'Pimpri-Chinchwad' },
  { id: 'dapodi', name: 'Dapodi', zone: 'North Pune' },
  { id: 'bopodi', name: 'Bopodi', zone: 'North Pune' },
  { id: 'khadki', name: 'Khadki', zone: 'North Pune' },
  { id: 'range-hills', name: 'Range Hills', zone: 'North Pune' },
  { id: 'shivajinagar', name: 'Shivajinagar', zone: 'Central Pune' },
  { id: 'civil-court', name: 'Civil Court (Interchange)', zone: 'Central Pune' },
  { id: 'budhwar-peth', name: 'Budhwar Peth', zone: 'Old City' },
  { id: 'mandai', name: 'Mandai', zone: 'Old City' },
  { id: 'swargate', name: 'Swargate', zone: 'South Pune' },

  // Aqua Line (west -> east), Civil Court shared
  { id: 'vanaz', name: 'Vanaz', zone: 'Kothrud' },
  { id: 'anand-nagar', name: 'Anand Nagar', zone: 'Kothrud' },
  { id: 'ideal-colony', name: 'Ideal Colony', zone: 'Kothrud' },
  { id: 'nal-stop', name: 'Nal Stop', zone: 'Erandwane' },
  { id: 'garware-college', name: 'Garware College', zone: 'Deccan' },
  { id: 'deccan', name: 'Deccan Gymkhana', zone: 'Deccan' },
  { id: 'sambhaji-udyan', name: 'Chh. Sambhaji Udyan', zone: 'Deccan' },
  { id: 'pmc', name: 'PMC Bhavan', zone: 'Central Pune' },
  { id: 'mangalwar-peth', name: 'Mangalwar Peth', zone: 'Old City' },
  { id: 'pune-station', name: 'Pune Railway Station', zone: 'Central Pune' },
  { id: 'ruby-hall', name: 'Ruby Hall Clinic', zone: 'Central Pune' },
  { id: 'bund-garden', name: 'Bund Garden', zone: 'East Pune' },
  { id: 'yerawada', name: 'Yerawada', zone: 'East Pune' },
  { id: 'kalyani-nagar', name: 'Kalyani Nagar', zone: 'East Pune' },
  { id: 'ramwadi', name: 'Ramwadi', zone: 'East Pune' },

  // Bus-only stops
  { id: 'market-yard', name: 'Market Yard', zone: 'South Pune' },
  { id: 'bibwewadi', name: 'Bibwewadi', zone: 'South Pune' },
  { id: 'katraj', name: 'Katraj', zone: 'South Pune' },
  { id: 'koregaon-park', name: 'Koregaon Park', zone: 'East Pune' },
  { id: 'viman-nagar', name: 'Viman Nagar', zone: 'East Pune' },
  { id: 'pune-airport', name: 'Pune Airport (Lohegaon)', zone: 'East Pune' },
  { id: 'university-circle', name: 'University Circle', zone: 'North-West Pune' },
  { id: 'aundh', name: 'Aundh', zone: 'North-West Pune' },
  { id: 'baner', name: 'Baner', zone: 'North-West Pune' },
  { id: 'wakad', name: 'Wakad', zone: 'North-West Pune' },
  { id: 'hinjawadi', name: 'Hinjawadi Phase 1', zone: 'IT Corridor' },
  { id: 'fatima-nagar', name: 'Fatima Nagar', zone: 'East Pune' },
  { id: 'magarpatta', name: 'Magarpatta City', zone: 'East Pune' },
  { id: 'hadapsar', name: 'Hadapsar', zone: 'East Pune' },
];

// Each route = ordered stops along a line; segTimes[i] = minutes between stop i and i+1
export const routes = [
  {
    lineId: 'purple',
    stops: [
      'pcmc', 'sant-tukaram-nagar', 'bhosari', 'kasarwadi', 'phugewadi',
      'dapodi', 'bopodi', 'khadki', 'range-hills', 'shivajinagar',
      'civil-court', 'budhwar-peth', 'mandai', 'swargate',
    ],
    segTimes: [3, 2, 2, 2, 2, 2, 2, 2, 3, 2, 2, 2, 2],
  },
  {
    lineId: 'aqua',
    stops: [
      'vanaz', 'anand-nagar', 'ideal-colony', 'nal-stop', 'garware-college',
      'deccan', 'sambhaji-udyan', 'pmc', 'civil-court', 'mangalwar-peth',
      'pune-station', 'ruby-hall', 'bund-garden', 'yerawada',
      'kalyani-nagar', 'ramwadi',
    ],
    segTimes: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 2],
  },
  {
    lineId: 'bus-katraj',
    stops: ['swargate', 'market-yard', 'bibwewadi', 'katraj'],
    segTimes: [7, 6, 8],
  },
  {
    lineId: 'bus-airport',
    stops: ['pune-station', 'koregaon-park', 'kalyani-nagar', 'viman-nagar', 'pune-airport'],
    segTimes: [9, 7, 6, 8],
  },
  {
    lineId: 'bus-hinjawadi',
    stops: ['shivajinagar', 'university-circle', 'aundh', 'baner', 'wakad', 'hinjawadi'],
    segTimes: [8, 7, 6, 7, 9],
  },
  {
    lineId: 'bus-hadapsar',
    stops: ['swargate', 'fatima-nagar', 'magarpatta', 'hadapsar'],
    segTimes: [10, 8, 6],
  },
];

export const landmarks = [
  { id: 'shaniwar-wada', name: 'Shaniwar Wada', category: 'Heritage', near: ['budhwar-peth', 'pmc'] },
  { id: 'dagadusheth', name: 'Dagadusheth Halwai Ganpati', category: 'Temple', near: ['mandai', 'budhwar-peth'] },
  { id: 'aga-khan-palace', name: 'Aga Khan Palace', category: 'Heritage', near: ['kalyani-nagar', 'yerawada'] },
  { id: 'osho-garden', name: 'Osho Teerth Garden', category: 'Park', near: ['koregaon-park'] },
  { id: 'sarasbaug', name: 'Sarasbaug', category: 'Park', near: ['swargate'] },
  { id: 'phoenix-mall', name: 'Phoenix Marketcity', category: 'Shopping', near: ['viman-nagar'] },
  { id: 'airport-terminal', name: 'Airport Terminal', category: 'Transport', near: ['pune-airport'] },
  { id: 'rajiv-gandhi-it-park', name: 'Rajiv Gandhi IT Park', category: 'Business', near: ['hinjawadi'] },
  { id: 'sppu', name: 'Savitribai Phule Pune University', category: 'Education', near: ['university-circle'] },
  { id: 'fc-road', name: 'FC Road', category: 'Shopping', near: ['deccan', 'sambhaji-udyan'] },
  { id: 'sinhagad-base', name: 'Sinhagad Fort Base', category: 'Heritage', near: ['katraj'] },
  { id: 'amanora-mall', name: 'Amanora Mall', category: 'Shopping', near: ['magarpatta', 'hadapsar'] },
];

// Flat edge list derived from routes — used by both the seed script and demo mode.
export function buildEdges() {
  const edges = [];
  for (const r of routes) {
    for (let i = 0; i < r.stops.length - 1; i++) {
      edges.push({
        from: r.stops[i],
        to: r.stops[i + 1],
        lineId: r.lineId,
        timeMin: r.segTimes[i],
      });
    }
  }
  return edges;
}
