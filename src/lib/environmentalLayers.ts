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
  waveDirectionDeg: number | null;
  swellHeightM: number | null;
  swellDirectionDeg: number | null;
  wavePeriodS: number | null;
  currentKmh: number | null;
  currentDirectionDeg: number | null;
  time: string | null;
  forecast: MarineHour[];
}
export interface MarineHour {
  time: string;
  waveHeightM: number | null;
  waveDirectionDeg: number | null;
  swellHeightM: number | null;
  swellDirectionDeg: number | null;
  wavePeriodS: number | null;
  currentKmh: number | null;
  currentDirectionDeg: number | null;
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

const oceanNames = [
  'North Pacific', 'Equatorial Pacific', 'South Pacific', 'North Atlantic', 'South Atlantic',
  'Indian Ocean', 'Arabian Sea', 'Bay of Bengal', 'South China Sea', 'Coral Sea',
  'Southern Ocean', 'North Sea',
];
const marineCoordinates: Array<[number, number]> = [
  [35, -150], [0, -140], [-35, -120], [35, -45], [-25, -15], [-20, 80], [15, 65], [12, 88], [12, 115], [-18, 155], [-55, 30], [56, 3],
  [45, -170], [25, -170], [10, -170], [-10, -170], [-30, -160], [-45, -150],
  [45, -130], [25, -130], [10, -130], [-10, -130], [-30, -130], [-50, -130],
  [50, -50], [30, -50], [10, -50], [-10, -45], [-30, -35], [-50, -25],
  [50, -30], [30, -30], [10, -30], [-10, -30], [-30, -20], [-50, -20],
  [20, 45], [5, 45], [-10, 45], [-25, 45], [-40, 45],
  [20, 60], [5, 60], [-10, 60], [-25, 60], [-40, 60],
  [15, 100], [0, 100], [-15, 100], [-30, 100], [-45, 100],
  [-55, -100], [-55, -30], [-55, 40], [-55, 110],
];

const oceanPoints = marineCoordinates.map(([lat, lng], index) => ({
  lat,
  lng,
  name: oceanNames[index] ?? `${lng < -90 || lng > 120 ? 'Pacific' : lng < 0 ? 'Atlantic' : 'Indian'} Ocean · ${Math.abs(lat)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lng)}°${lng >= 0 ? 'E' : 'W'}`,
}));

const marineHourlyVariables = 'wave_height,wave_direction,swell_wave_height,swell_wave_direction,wave_period,ocean_current_velocity,ocean_current_direction';

function parseMarineRow(row: Record<string, unknown>, point: { name: string; lat: number; lng: number }, index: number): MarinePoint {
  const hourly = typeof row.hourly === 'object' && row.hourly !== null ? row.hourly as Record<string, unknown> : {};
  const times = Array.isArray(hourly.time) ? hourly.time.filter((time): time is string => typeof time === 'string') : [];
  const forecast: MarineHour[] = times.map((time, hour) => ({
    time,
    waveHeightM: numberAt(hourly, 'wave_height', hour),
    waveDirectionDeg: numberAt(hourly, 'wave_direction', hour),
    swellHeightM: numberAt(hourly, 'swell_wave_height', hour),
    swellDirectionDeg: numberAt(hourly, 'swell_wave_direction', hour),
    wavePeriodS: numberAt(hourly, 'wave_period', hour),
    currentKmh: numberAt(hourly, 'ocean_current_velocity', hour),
    currentDirectionDeg: numberAt(hourly, 'ocean_current_direction', hour),
  }));
  const first = forecast[0];
  return {
    id: `ocean-${index}`,
    name: point.name,
    lat: asNumber(row.latitude) ?? point.lat,
    lng: asNumber(row.longitude) ?? point.lng,
    waveHeightM: first?.waveHeightM ?? null,
    waveDirectionDeg: first?.waveDirectionDeg ?? null,
    swellHeightM: first?.swellHeightM ?? null,
    swellDirectionDeg: first?.swellDirectionDeg ?? null,
    wavePeriodS: first?.wavePeriodS ?? null,
    currentKmh: first?.currentKmh ?? null,
    currentDirectionDeg: first?.currentDirectionDeg ?? null,
    time: first?.time ?? null,
    forecast,
  };
}

export async function fetchGlobalMarineConditions(): Promise<MarinePoint[]> {
  const params = new URLSearchParams({
    latitude: oceanPoints.map((point) => point.lat).join(','),
    longitude: oceanPoints.map((point) => point.lng).join(','),
    hourly: marineHourlyVariables,
    forecast_hours: '169', timezone: 'UTC', cell_selection: 'sea',
  });
  const payload = parseMulti(await fetchJson(`https://marine-api.open-meteo.com/v1/marine?${params}`));
  if (!payload.length) throw new Error('Ocean conditions are temporarily unavailable.');
  return payload.map((row, index) => {
    const latitude = asNumber(row.latitude);
    const longitude = asNumber(row.longitude);
    const matchedIndex = latitude === null || longitude === null ? -1 : oceanPoints.findIndex((point) => Math.abs(point.lat - latitude) < 0.01 && Math.abs(point.lng - longitude) < 0.01);
    const sourceIndex = matchedIndex >= 0 ? matchedIndex : index;
    const point = oceanPoints[sourceIndex] ?? { name: `Ocean point ${index + 1}`, lat: latitude ?? 0, lng: longitude ?? 0 };
    return parseMarineRow(row, point, sourceIndex);
  });
}

export async function fetchMarinePointForecast(lat: number, lng: number, name = 'Pinned location'): Promise<MarinePoint> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -89.8 || lat > 89.8 || lng < -180 || lng > 180) {
    throw new Error('Enter a valid latitude and longitude.');
  }
  const params = new URLSearchParams({
    latitude: String(lat), longitude: String(lng), hourly: marineHourlyVariables,
    forecast_hours: '169', timezone: 'UTC', cell_selection: 'sea',
  });
  const payload = parseMulti(await fetchJson(`https://marine-api.open-meteo.com/v1/marine?${params}`));
  if (!payload[0]) throw new Error('Marine forecast is unavailable for this location.');
  return { ...parseMarineRow(payload[0], { name, lat, lng }, 0), id: 'ocean-pinned' };
}

export async function fetchGlobalOisstPoints(): Promise<OisstPoint[]> {
  const params = new URLSearchParams({ points: oceanPoints.slice(0, 24).map((point) => `${point.lat},${point.lng}`).join(';') });
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

export async function fetchOisstAt(lat: number, lng: number): Promise<OisstPoint | null> {
  const params = new URLSearchParams({ points: `${lat},${lng}` });
  const payload = await fetchJson(`/api/ocean/oisst?${params}`) as { points?: Array<Record<string, unknown>> };
  const row = payload.points?.[0];
  if (!row) return null;
  return {
    id: `oisst-${lat.toFixed(3)}-${lng.toFixed(3)}`,
    lat: asNumber(row.latitude) ?? lat,
    lng: asNumber(row.longitude) ?? lng,
    seaSurfaceC: asNumber(row.sst_c),
    anomalyC: asNumber(row.anomaly_c),
    time: typeof row.time === 'string' ? row.time : null,
  };
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
