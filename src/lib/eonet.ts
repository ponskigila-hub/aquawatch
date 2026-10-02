// Client for NASA's EONET (Earth Observatory Natural Event Tracker) API.
// Public, no API key required, CORS-enabled for browser fetches.
// Docs: https://eonet.gsfc.nasa.gov/docs/v3

export interface EonetEvent {
  id: string;
  title: string;
  category: string;
  lat: number;
  lng: number;
  date: string;
  link: string;
  track?: Array<{ date: string; lat: number; lng: number }>;
}

const EONET_URL =
  'https://eonet.gsfc.nasa.gov/api/v3/events?category=floods,severeStorms&status=open&limit=75';
const EONET_HISTORY_URL =
  'https://eonet.gsfc.nasa.gov/api/v3/events?category=floods,severeStorms&status=all&days=365&limit=50';

interface RawGeometry {
  date: string;
  type: 'Point' | 'Polygon' | string;
  coordinates: unknown;
}

interface RawEvent {
  id: string;
  title: string;
  link: string;
  categories?: { id: string; title: string }[];
  sources?: { id: string; url: string }[];
  geometry?: RawGeometry[];
}

interface RawEonetResponse {
  events?: RawEvent[];
}

// Pull a representative [lng, lat] pair out of whatever geometry shape EONET
// gives us (most events are Points; some storms are Polygons).
const extractLngLat = (geometry: RawGeometry): [number, number] | null => {
  if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    return typeof lng === 'number' && typeof lat === 'number' ? [lng, lat] : null;
  }
  if (geometry.type === 'Polygon') {
    if (!Array.isArray(geometry.coordinates)) return null;
    const ring = geometry.coordinates[0];
    const first = Array.isArray(ring) ? ring[0] : null;
    if (Array.isArray(first) && typeof first[0] === 'number' && typeof first[1] === 'number') {
      return [first[0], first[1]];
    }
  }
  return null;
};

export const fetchFloodStormEvents = async (): Promise<EonetEvent[]> => {
  const res = await fetch(EONET_URL);
  if (!res.ok) throw new Error(`EONET request failed: ${res.status}`);
  const data = await res.json() as RawEonetResponse;
  const rawEvents = Array.isArray(data?.events) ? data.events : [];

  const events: EonetEvent[] = [];
  for (const ev of rawEvents) {
    const geometry = ev.geometry?.[ev.geometry.length - 1]; // most recent reading
    if (!geometry) continue;
    const coords = extractLngLat(geometry);
    if (!coords) continue;
    const [lng, lat] = coords;

    events.push({
      id: ev.id,
      title: ev.title,
      category: ev.categories?.[0]?.title ?? 'Event',
      lat,
      lng,
      date: geometry.date,
      link: ev.sources?.[0]?.url || ev.link,
    });
  }
  return events;
};

// Recent historical flood/severe-storm records include dated geometries. Keep
// only actual point sequences as tracks; polygon outlines are not trajectories.
export const fetchFloodStormArchive = async (): Promise<EonetEvent[]> => {
  const res = await fetch(EONET_HISTORY_URL);
  if (!res.ok) throw new Error(`EONET archive request failed: ${res.status}`);
  const data = await res.json() as RawEonetResponse;
  const rawEvents = Array.isArray(data?.events) ? data.events : [];
  const events: EonetEvent[] = [];
  for (const ev of rawEvents) {
    const geometries = ev.geometry ?? [];
    const track = geometries.flatMap((geometry) => {
      if (geometry.type !== 'Point') return [];
      const coords = extractLngLat(geometry);
      if (!coords) return [];
      return [{ date: geometry.date, lng: coords[0], lat: coords[1] }];
    }).sort((a, b) => a.date.localeCompare(b.date));
    const latestGeometry = geometries.at(-1);
    const fallbackCoords = latestGeometry ? extractLngLat(latestGeometry) : null;
    const latest = track.at(-1);
    const coords = latest ? [latest.lng, latest.lat] as [number, number] : fallbackCoords;
    if (!coords) continue;
    events.push({
      id: ev.id,
      title: ev.title,
      category: ev.categories?.[0]?.title ?? 'Event',
      lat: coords[1],
      lng: coords[0],
      date: latest?.date ?? latestGeometry?.date ?? '',
      link: ev.sources?.[0]?.url || ev.link,
      track,
    });
  }
  return events.sort((a, b) => b.date.localeCompare(a.date));
};
