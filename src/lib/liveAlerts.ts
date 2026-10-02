import type { LiveAreaWeather } from '@/lib/globalWeather';
import type { EonetEvent } from '@/lib/eonet';
import type { RiskLevel } from '@/types/flood';

export interface LiveAlert {
  id: string;
  location: string;
  level: RiskLevel;
  message: string;
  timestamp: string;
  source: string;
  url?: string;
}

const distanceKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(lat1)) * Math.cos(radians(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

export function buildRegionAlerts(
  areas: LiveAreaWeather[],
  events: EonetEvent[],
  center: { lat: number; lng: number },
): LiveAlert[] {
  const rainSignals: LiveAlert[] = areas
    .filter((area) => area.latestDailyRainfallMm !== null && area.latestDailyRainfallMm >= 20)
    .map((area) => ({
      id: `rain-${area.id}`,
      location: area.name,
      level: area.latestDailyRainfallMm! >= 50 ? 'high' : 'medium',
      message: `Expected rain today: ${area.latestDailyRainfallMm!.toFixed(1)} mm. This is an estimate, not an official warning.`,
      timestamp: area.observedAt ?? new Date().toISOString(),
      source: 'Weather estimate',
    }));

  const eventSignals: LiveAlert[] = events
    .map((event) => ({ event, distance: distanceKm(center.lat, center.lng, event.lat, event.lng) }))
    .filter(({ distance }) => distance <= 500)
    .map(({ event, distance }) => ({
      id: `eonet-${event.id}`,
      location: event.title,
      level: event.category.toLowerCase().includes('flood') ? 'high' : 'medium',
      message: `${event.category} reported about ${Math.round(distance)} km from your area.`,
      timestamp: event.date,
      source: 'NASA report',
      url: event.link,
    }));

  return [...eventSignals, ...rainSignals]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 12);
}
