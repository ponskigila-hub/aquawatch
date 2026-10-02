import { worldCities } from '@/data/worldCities';

export interface EarthquakePoint {
  id: string;
  lat: number;
  lng: number;
  magnitude: number;
  place: string;
  time: string;
  depthKm: number;
  url: string;
  tsunamiFlag: boolean;
  alertLevel: string | null;
  feltReports: number | null;
}
export interface AirQualityPoint {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  usAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  so2: number | null;
  time: string | null;
}
export interface MarinePoint {
  id: string;
  name: string;
  lat: number;
  lng: number;
  waveHeightM: number | null;
  swellHeightM: number | null;
  wavePeriodS: number | null;
  currentKmh: number | null;
  currentDirectionDeg: number | null;
  time: string | null;
}
export interface OisstPoint {
  id: string;
  lat: number;
  lng: number;
  seaSurfaceC: number | null;
  anomalyC: number | null;
  time: string | null;
}
export interface DailyHistoricalWeather { date: string; temperatureMeanC: number | null; rainMm: number | null; }

const fetchJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Data source returned ${response.status}.`);
  return response.json();
};
const asNumber = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const numberAt = (object: Record<string, unknown>, key: string, index = 0) => {
  const values = object[key];
  return Array.isArray(values) ? asNumber(values[index]) : null;
};
const parseMulti = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : typeof value === 'object' && value !== null ? [value as Record<string, unknown>] : [];
const geoPoints = [
  ...worldCities.filter((city) => ['Indonesia', 'Singapore', 'India', 'Japan', 'Australia', 'United Kingdom', 'France', 'Nigeria', 'South Africa', 'United States', 'Canada', 'Brazil', 'Argentina', 'Chile', 'Mexico', 'New Zealand'].includes(city.country)),
].filter((city, index, all) => all.findIndex((item) => item.country === city.country) === index).slice(0, 24);

export async function fetchRecentEarthquakes(window: 'hour' | 'day' | 'week' = 'day'): Promise<EarthquakePoint[]> {
  const feed = window === 'hour' ? 'all_hour' : window === 'week' ? 'all_week' : 'all_day';
  const payload = await fetchJson(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`);
  const features = (payload as { features?: unknown[] })?.features ?? [];
  return features.flatMap((raw) => {
    if (typeof raw !== 'object' || raw === null) return [];
    const feature = raw as { id?: unknown; geometry?: { coordinates?: unknown }; properties?: Record<string, unknown> };
    const coordinates = feature.geometry?.coordinates;
    const properties = feature.properties ?? {};
    if (!Array.isArray(coordinates)) return [];
    const lng = asNumber(coordinates[0]), lat = asNumber(coordinates[1]), depthKm = asNumber(coordinates[2]);
    const magnitude = asNumber(properties.mag), time = asNumber(properties.time);
    if (lat === null || lng === null || magnitude === null || time === null) return [];
    return [{ id: String(feature.id ?? properties.code ?? `${lat}-${lng}-${time}`), lat, lng, magnitude, place: String(properties.place ?? 'Location not reported'), time: new Date(time).toISOString(), depthKm: depthKm ?? 0, url: String(properties.url ?? 'https://earthquake.usgs.gov/earthquakes/map/'), tsunamiFlag: properties.tsunami === 1, alertLevel: typeof properties.alert === 'string' ? properties.alert : null, feltReports: asNumber(properties.felt) }];
  }).sort((a, b) => b.magnitude - a.magnitude);
}

export async function fetchGlobalAirQuality(): Promise<AirQualityPoint[]> {
  const params = new URLSearchParams({
    latitude: geoPoints.map((city) => city.lat).join(','),
    longitude: geoPoints.map((city) => city.lng).join(','),
    hourly: 'us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide',
    forecast_hours: '2', timezone: 'UTC',
  });
  const payload = parseMulti(await fetchJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${params}`));
  if (!payload.length) throw new Error('Air quality data is temporarily unavailable.');
  return payload.map((row, index) => {
    const city = geoPoints[index];
    const hourly = typeof row.hourly === 'object' && row.hourly !== null ? row.hourly as Record<string, unknown> : {};
    const timeValues = hourly.time;
    const time = Array.isArray(timeValues) && typeof timeValues[0] === 'string' ? timeValues[0] : null;
    return {
      id: `air-${city?.id ?? index}`, name: city?.name ?? `Weather point ${index + 1}`, country: city?.country ?? '',
      lat: asNumber(row.latitude) ?? city?.lat ?? 0, lng: asNumber(row.longitude) ?? city?.lng ?? 0,
      usAqi: numberAt(hourly, 'us_aqi'), pm25: numberAt(hourly, 'pm2_5'), pm10: numberAt(hourly, 'pm10'),
      no2: numberAt(hourly, 'nitrogen_dioxide'), so2: numberAt(hourly, 'sulphur_dioxide'), time,
    };
  });
}

const oceanPoints = [
  { name: 'North Pacific', lat: 35, lng: -150 }, { name: 'Equatorial Pacific', lat: 0, lng: -140 },
  { name: 'South Pacific', lat: -35, lng: -120 }, { name: 'North Atlantic', lat: 35, lng: -45 },
  { name: 'South Atlantic', lat: -25, lng: -15 }, { name: 'Indian Ocean', lat: -20, lng: 80 },
  { name: 'Arabian Sea', lat: 15, lng: 65 }, { name: 'Bay of Bengal', lat: 12, lng: 88 },
  { name: 'South China Sea', lat: 12, lng: 115 }, { name: 'Coral Sea', lat: -18, lng: 155 },
  { name: 'Southern Ocean', lat: -55, lng: 30 }, { name: 'North Sea', lat: 56, lng: 3 },
];

export async function fetchGlobalMarineConditions(): Promise<MarinePoint[]> {
  const params = new URLSearchParams({
    latitude: oceanPoints.map((point) => point.lat).join(','),
    longitude: oceanPoints.map((point) => point.lng).join(','),
    hourly: 'wave_height,swell_wave_height,wave_period,ocean_current_velocity,ocean_current_direction',
    forecast_hours: '2', timezone: 'UTC',
  });
  const payload = parseMulti(await fetchJson(`https://marine-api.open-meteo.com/v1/marine?${params}`));
  if (!payload.length) throw new Error('Ocean conditions are temporarily unavailable.');
  return payload.map((row, index) => {
    const point = oceanPoints[index];
    const hourly = typeof row.hourly === 'object' && row.hourly !== null ? row.hourly as Record<string, unknown> : {};
    const times = hourly.time;
    return { id: `ocean-${index}`, name: point?.name ?? 'Ocean point', lat: asNumber(row.latitude) ?? point.lat, lng: asNumber(row.longitude) ?? point.lng, waveHeightM: numberAt(hourly, 'wave_height'), swellHeightM: numberAt(hourly, 'swell_wave_height'), wavePeriodS: numberAt(hourly, 'wave_period'), currentKmh: numberAt(hourly, 'ocean_current_velocity'), currentDirectionDeg: numberAt(hourly, 'ocean_current_direction'), time: Array.isArray(times) && typeof times[0] === 'string' ? times[0] : null };
  });
}

export async function fetchGlobalOisstPoints(): Promise<OisstPoint[]> {
  const params = new URLSearchParams({ points: oceanPoints.map((point) => `${point.lat},${point.lng}`).join(';') });
  const payload = await fetchJson(`/api/ocean/oisst?${params}`) as { points?: Array<Record<string, unknown>> };
  return (payload.points ?? []).map((row, index) => ({
    id: `ocean-${index}`,
    lat: asNumber(row.latitude) ?? oceanPoints[index]?.lat ?? 0,
    lng: asNumber(row.longitude) ?? oceanPoints[index]?.lng ?? 0,
    seaSurfaceC: asNumber(row.sst_c),
    anomalyC: asNumber(row.anomaly_c),
    time: typeof row.time === 'string' ? row.time : null,
  }));
}

export async function fetchHistoricalDailyWeather(lat: number, lng: number, startDate: string, endDate: string): Promise<DailyHistoricalWeather[]> {
  const params = new URLSearchParams({ latitude: String(lat), longitude: String(lng), start_date: startDate, end_date: endDate, daily: 'temperature_2m_mean,precipitation_sum', timezone: 'auto' });
  const payload = await fetchJson(`https://archive-api.open-meteo.com/v1/archive?${params}`) as { daily?: { time?: unknown[]; temperature_2m_mean?: unknown[]; precipitation_sum?: unknown[] } };
  const daily = payload.daily;
  if (!daily || !Array.isArray(daily.time)) throw new Error('Past daily weather is unavailable for this date.');
  return daily.time.flatMap((date, index) => typeof date === 'string' ? [{ date, temperatureMeanC: asNumber(daily.temperature_2m_mean?.[index]), rainMm: asNumber(daily.precipitation_sum?.[index]) }] : []);
}

export async function fetchThirtyYearMonthlyBaseline(lat: number, lng: number, month: number): Promise<{ temperatureC: number | null; rainMmPerDay: number | null; years: string }> {
  const params = new URLSearchParams({ latitude: String(lat), longitude: String(lng), start_date: '1991-01-01', end_date: '2020-12-31', daily: 'temperature_2m_mean,precipitation_sum', timezone: 'UTC' });
  const payload = await fetchJson(`https://archive-api.open-meteo.com/v1/archive?${params}`) as { daily?: { time?: unknown[]; temperature_2m_mean?: unknown[]; precipitation_sum?: unknown[] } };
  const times = payload.daily?.time ?? [];
  const temps = payload.daily?.temperature_2m_mean ?? [];
  const rains = payload.daily?.precipitation_sum ?? [];
  const matchingTemps: number[] = [], matchingRains: number[] = [];
  times.forEach((date, index) => {
    if (typeof date !== 'string' || Number(date.slice(5, 7)) !== month) return;
    const temp = asNumber(temps[index]), rain = asNumber(rains[index]);
    if (temp !== null) matchingTemps.push(temp);
    if (rain !== null) matchingRains.push(rain);
  });
  return {
    temperatureC: matchingTemps.length ? matchingTemps.reduce((sum, value) => sum + value, 0) / matchingTemps.length : null,
    rainMmPerDay: matchingRains.length ? matchingRains.reduce((sum, value) => sum + value, 0) / matchingRains.length : null,
    years: '1991–2020',
  };
}


export interface ThermalDetection {
  id: string;
  lat: number;
  lng: number;
  brightness: number | null;
  confidence: string | null;
  fireRadiativePower: number | null;
  observedAt: string | null;
  satellite: string | null;
}

export async function fetchThermalDetections(days = 1): Promise<ThermalDetection[]> {
  const response = await fetch(`/api/hazards/fires?days=${Math.max(1, Math.min(5, Math.floor(days)))}`, { headers: { Accept: 'application/geo+json, application/json' } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { detail?: string };
    throw new Error(body.detail || (response.status === 503 ? 'NASA fire data is not configured on this server.' : `Thermal data request failed (${response.status}).`));
  }
  const data = await response.json() as { features?: Array<{ id?: string | number; geometry?: { type?: string; coordinates?: unknown }; properties?: Record<string, unknown> }> };
  return (data.features ?? []).flatMap((feature, index) => {
    const coordinates = feature.geometry?.coordinates;
    if (!Array.isArray(coordinates)) return [];
    const lng = asNumber(coordinates[0]), lat = asNumber(coordinates[1]);
    if (lat === null || lng === null) return [];
    const p = feature.properties ?? {};
    const date = typeof p.acq_date === 'string' ? p.acq_date : '';
    const time = typeof p.acq_time === 'string' ? p.acq_time.padStart(4, '0') : '';
    return [{ id: String(feature.id ?? `${lat}-${lng}-${index}`), lat, lng, brightness: asNumber(p.brightness) ?? asNumber(p.bright_ti4), confidence: p.confidence === undefined ? null : String(p.confidence), fireRadiativePower: asNumber(p.frp), observedAt: date ? `${date} ${time}`.trim() : null, satellite: typeof p.satellite === 'string' ? p.satellite : null }];
  });
}


export interface DownwindEstimate { id: string; lat: number; lng: number; endLat: number; endLng: number; windKph: number; windFromDegrees: number; }
export async function fetchDownwindEstimates(detections: ThermalDetection[]): Promise<DownwindEstimate[]> {
  const sample = [...detections].sort((a, b) => (b.fireRadiativePower ?? 0) - (a.fireRadiativePower ?? 0)).slice(0, 40);
  if (!sample.length) return [];
  const params = new URLSearchParams({ latitude: sample.map((item) => item.lat).join(','), longitude: sample.map((item) => item.lng).join(','), current: 'wind_speed_10m,wind_direction_10m', wind_speed_unit: 'kmh', timezone: 'UTC' });
  const payload = parseMulti(await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`));
  return sample.flatMap((item, index) => {
    const row = payload[index];
    const current = typeof row?.current === 'object' && row.current !== null ? row.current as Record<string, unknown> : {};
    const speed = asNumber(current.wind_speed_10m), from = asNumber(current.wind_direction_10m);
    if (speed === null || from === null) return [];
    const toward = (from + 180) % 360;
    const distanceKm = Math.min(120, Math.max(8, speed));
    const bearing = toward * Math.PI / 180;
    const endLat = Math.max(-89.9, Math.min(89.9, item.lat + distanceKm * Math.cos(bearing) / 111));
    const longitudeScale = Math.max(0.08, Math.cos(item.lat * Math.PI / 180));
    const endLng = ((item.lng + distanceKm * Math.sin(bearing) / (111 * longitudeScale) + 540) % 360) - 180;
    return [{ id: item.id, lat: item.lat, lng: item.lng, endLat, endLng, windKph: speed, windFromDegrees: from }];
  });
}
