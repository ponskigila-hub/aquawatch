import axios from 'axios';
import { api } from './api';
import type { AirQualitySnapshot, Coordinates, Earthquake, MarineSnapshot, NearbyEonetEvent, WeatherDay, WeatherHour, WeatherSnapshot } from '../theme';

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
interface UsgsFeature {
  id?: string;
  properties?: { place?: string | null; mag?: number | null; time?: number | null; url?: string | null; tsunami?: number | null };
  geometry?: { coordinates?: unknown };
}
interface UsgsResponse { features?: UsgsFeature[]; }
interface EonetGeometry { date?: string; type?: string; coordinates?: unknown; }
interface EonetFeature {
  id?: string; title?: string; link?: string; geometry?: EonetGeometry[];
  categories?: Array<{ id?: string; title?: string }>;
  sources?: Array<{ url?: string }>;
}
interface EonetResponse { events?: EonetFeature[]; }

export async function searchLocation(query: string): Promise<Coordinates & { name: string }> {
  const { data } = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params: { name: query.trim(), count: 1, language: 'en', format: 'json' },
    timeout: 12_000,
  });
  const result = Array.isArray(data.results) ? data.results[0] : null;
  if (!result || typeof result.latitude !== 'number' || typeof result.longitude !== 'number') throw new Error('No matching place was found.');
  return { latitude: result.latitude, longitude: result.longitude, name: [result.name, result.admin1, result.country].filter(Boolean).join(', ') };
}

export function weatherDescription(code: number | null) {
  if (code === 0) return 'Clear skies';
  if (code === 1 || code === 2) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code ?? -1)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code ?? -1)) return 'Rain showers';
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) return 'Snow';
  if ([95, 96, 99].includes(code ?? -1)) return 'Thunderstorms';
  return 'Changing conditions';
}

export function weatherGlyph(code: number | null) {
  if (code === 0) return '☀';
  if (code === 1 || code === 2) return '⛅';
  if (code === 3 || code === 45 || code === 48) return '☁';
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) return '❄';
  if ([95, 96, 99].includes(code ?? -1)) return '⛈';
  return '🌧';
}

export function compassDirection(degrees: number | null | undefined): string | null {
  if (degrees === null || degrees === undefined || !Number.isFinite(degrees)) return null;
  const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return directions[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}

export function uvDescription(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Unavailable';
  if (value <= 2) return 'Low';
  if (value <= 5) return 'Moderate';
  if (value <= 7) return 'High';
  if (value <= 10) return 'Very high';
  return 'Extreme';
}

export function aqiDescription(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'Unavailable';
  if (value <= 50) return 'Good';
  if (value <= 100) return 'Moderate';
  if (value <= 150) return 'Unhealthy for sensitive groups';
  if (value <= 200) return 'Unhealthy';
  if (value <= 300) return 'Very unhealthy';
  return 'Hazardous';
}

const pair = (array: unknown): [number, number] | null => {
  if (!Array.isArray(array) || typeof array[0] !== 'number' || typeof array[1] !== 'number') return null;
  return [array[0], array[1]];
};

function haversineKm(a: Coordinates, b: Coordinates): number {
  const radians = (degree: number) => degree * Math.PI / 180;
  const dLat = radians(b.latitude - a.latitude);
  const dLng = radians(b.longitude - a.longitude);
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export async function fetchWeather(point: Coordinates): Promise<WeatherSnapshot> {
  const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: point.latitude,
      longitude: point.longitude,
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,cloud_cover,visibility,pressure_msl,uv_index,dew_point_2m',
      hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m,cloud_cover,uv_index',
      daily: 'rain_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset,daylight_duration,sunshine_duration,uv_index_max',
      forecast_days: 7,
      timezone: 'auto',
      wind_speed_unit: 'kmh',
    },
    timeout: 18_000,
  });
  const current = data.current ?? {};
  const hourly = data.hourly ?? {};
  const daily = data.daily ?? {};
  const times: string[] = Array.isArray(hourly.time) ? hourly.time : [];
  const now = text(current.time);
  const found = times.findIndex((time) => time >= now);
  const first = found < 0 ? 0 : found;
  const hourlyForecast: WeatherHour[] = times.slice(first, first + 12).map((time: string, offset: number) => {
    const index = first + offset;
    return {
      time,
      temperatureC: finite(hourly.temperature_2m?.[index]),
      rainChance: finite(hourly.precipitation_probability?.[index]),
      weatherCode: finite(hourly.weather_code?.[index]),
      windKph: finite(hourly.wind_speed_10m?.[index]),
      humidity: finite(hourly.relative_humidity_2m?.[index]),
      cloudCoverPct: finite(hourly.cloud_cover?.[index]),
      uvIndex: finite(hourly.uv_index?.[index]),
    };
  });
  const days: string[] = Array.isArray(daily.time) ? daily.time : [];
  const dailyForecast: WeatherDay[] = days.map((date: string, index: number) => ({
    date,
    highC: finite(daily.temperature_2m_max?.[index]),
    lowC: finite(daily.temperature_2m_min?.[index]),
    rainMm: finite(daily.rain_sum?.[index]),
    rainChance: finite(daily.precipitation_probability_max?.[index]),
    weatherCode: finite(daily.weather_code?.[index]),
    sunrise: text(daily.sunrise?.[index]) || null,
    sunset: text(daily.sunset?.[index]) || null,
    daylightSeconds: finite(daily.daylight_duration?.[index]),
    sunshineSeconds: finite(daily.sunshine_duration?.[index]),
    uvMax: finite(daily.uv_index_max?.[index]),
  }));
  const visibilityMeters = finite(current.visibility);
  return {
    time: text(current.time) || null,
    temperatureC: finite(current.temperature_2m),
    feelsLikeC: finite(current.apparent_temperature),
    humidity: finite(current.relative_humidity_2m),
    windKph: finite(current.wind_speed_10m),
    windDirectionDeg: finite(current.wind_direction_10m),
    windGustKph: finite(current.wind_gusts_10m),
    cloudCoverPct: finite(current.cloud_cover),
    visibilityKm: visibilityMeters === null ? null : visibilityMeters / 1000,
    pressureMb: finite(current.pressure_msl),
    uvIndex: finite(current.uv_index),
    dewPointC: finite(current.dew_point_2m),
    precipitationMm: finite(current.precipitation),
    weatherCode: finite(current.weather_code),
    highC: finite(daily.temperature_2m_max?.[0]),
    lowC: finite(daily.temperature_2m_min?.[0]),
    rainChance: finite(daily.precipitation_probability_max?.[0]),
    rainTodayMm: finite(daily.rain_sum?.[0]),
    hourly: hourlyForecast,
    daily: dailyForecast,
  };
}

export async function fetchAirQuality(point: Coordinates): Promise<AirQualitySnapshot> {
  const { data } = await axios.get('https://air-quality-api.open-meteo.com/v1/air-quality', {
    params: {
      latitude: point.latitude,
      longitude: point.longitude,
      current: 'us_aqi,european_aqi,pm2_5,pm10,nitrogen_dioxide',
      timezone: 'auto',
    },
    timeout: 18_000,
  });
  const current = data.current ?? {};
  return {
    time: text(current.time) || null,
    usAqi: finite(current.us_aqi),
    europeanAqi: finite(current.european_aqi),
    pm25: finite(current.pm2_5),
    pm10: finite(current.pm10),
    nitrogenDioxide: finite(current.nitrogen_dioxide),
  };
}

export async function fetchEarthquakes(): Promise<Earthquake[]> {
  const { data } = await axios.get<UsgsResponse>('https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson', { timeout: 18_000 });
  return (data.features ?? []).map((feature) => ({
    id: String(feature.id ?? 'usgs-event'),
    place: text(feature.properties?.place, 'Location not reported'),
    magnitude: finite(feature.properties?.mag) ?? 0,
    depthKm: finite(Array.isArray(feature.geometry?.coordinates) ? feature.geometry.coordinates[2] : undefined) ?? 0,
    occurredAt: new Date(Number(feature.properties?.time ?? Date.now())).toISOString(),
    url: text(feature.properties?.url, 'https://earthquake.usgs.gov/earthquakes/map/'),
  })).sort((a: Earthquake, b: Earthquake) => b.magnitude - a.magnitude).slice(0, 30);
}

export async function fetchNearbyEarthquakes(point: Coordinates, radiusKm = 500): Promise<Earthquake[]> {
  const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await axios.get<UsgsResponse>('https://earthquake.usgs.gov/fdsnws/event/1/query', {
    params: { format: 'geojson', starttime: start, latitude: point.latitude, longitude: point.longitude, maxradiuskm: radiusKm, limit: 100, orderby: 'time' },
    timeout: 18_000,
  });
  return (data.features ?? []).flatMap((feature) => {
    const rawCoordinates = feature.geometry?.coordinates;
    if (!Array.isArray(rawCoordinates) || typeof rawCoordinates[0] !== 'number' || typeof rawCoordinates[1] !== 'number') return [];
    const longitude = rawCoordinates[0];
    const latitude = rawCoordinates[1];
    const depth = finite(rawCoordinates[2]) ?? 0;
    const distanceKm = haversineKm(point, { latitude, longitude });
    if (distanceKm > radiusKm) return [];
    const properties = feature.properties ?? {};
    return [{
      id: String(feature.id ?? `${latitude},${longitude},${properties.time ?? 0}`),
      place: text(properties.place, 'Location not reported'),
      magnitude: finite(properties.mag) ?? 0,
      depthKm: depth,
      occurredAt: new Date(Number(properties.time ?? Date.now())).toISOString(),
      url: text(properties.url, 'https://earthquake.usgs.gov/earthquakes/map/'),
      latitude,
      longitude,
      distanceKm,
      tsunamiRelated: properties.tsunami === 1,
    }];
  }).sort((a, b) => a.distanceKm! - b.distanceKm!).slice(0, 30);
}

function geometryCenter(geometry: EonetGeometry | undefined): [number, number] | null {
  if (!geometry) return null;
  const point = pair(geometry.coordinates);
  if (geometry.type === 'Point' && point) return point;
  const points: Array<[number, number]> = [];
  const visit = (value: unknown) => {
    if (!Array.isArray(value)) return;
    const candidate = pair(value);
    if (candidate) points.push(candidate);
    else value.forEach(visit);
  };
  visit(geometry.coordinates);
  if (!points.length) return null;
  const unique = points.slice(0, -1).length > 1 && points[0][0] === points.at(-1)?.[0] && points[0][1] === points.at(-1)?.[1] ? points.slice(0, -1) : points;
  return [unique.reduce((sum, item) => sum + item[0], 0) / unique.length, unique.reduce((sum, item) => sum + item[1], 0) / unique.length];
}

export async function fetchNearbyEonetEvents(point: Coordinates, radiusKm = 1000): Promise<NearbyEonetEvent[]> {
  const { data } = await axios.get<EonetResponse>('https://eonet.gsfc.nasa.gov/api/v3/events', {
    params: { status: 'open', category: 'floods,severeStorms,volcanoes,wildfires,landslides', limit: 200 },
    timeout: 20_000,
  });
  return (data.events ?? []).flatMap((event) => {
    const geometries = event.geometry ?? [];
    const latest = geometries.at(-1);
    const center = geometryCenter(latest);
    if (!center) return [];
    const [longitude, latitude] = center;
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return [];
    const distanceKm = haversineKm(point, { latitude, longitude });
    if (distanceKm > radiusKm) return [];
    return [{
      id: String(event.id ?? `${latitude},${longitude}`),
      title: text(event.title, 'Natural event'),
      category: text(event.categories?.[0]?.title, 'Environmental event'),
      latitude,
      longitude,
      distanceKm,
      occurredAt: text(latest?.date, ''),
      url: text(event.sources?.[0]?.url, text(event.link, 'https://eonet.gsfc.nasa.gov/')),
    }];
  }).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 50);
}

export async function fetchMarine(point: Coordinates): Promise<MarineSnapshot> {
  const { data } = await axios.get('https://marine-api.open-meteo.com/v1/marine', {
    params: {
      latitude: point.latitude,
      longitude: point.longitude,
      hourly: 'wave_height,wave_direction,swell_wave_height,swell_wave_direction,ocean_current_velocity,ocean_current_direction',
      forecast_hours: 72,
      timezone: 'auto',
      cell_selection: 'sea',
    },
    timeout: 18_000,
  });
  const h = data.hourly ?? {};
  const times: string[] = Array.isArray(h.time) ? h.time : [];
  if (!times.length) throw new Error('Marine forecast is not available at this location.');
  return {
    time: times[0],
    waveHeightM: finite(h.wave_height?.[0]),
    swellHeightM: finite(h.swell_wave_height?.[0]),
    currentKmh: finite(h.ocean_current_velocity?.[0]),
    waveDirection: finite(h.wave_direction?.[0]),
    swellDirection: finite(h.swell_wave_direction?.[0]),
    currentDirection: finite(h.ocean_current_direction?.[0]),
  };
}

export async function fetchOisst(point: Coordinates): Promise<MarineSnapshot | null> {
  if (!api.defaults.baseURL) return null;
  const { data } = await api.get('/api/ocean/oisst', {
    params: { points: `${point.latitude},${point.longitude}` },
  });
  const row = data.points?.[0];
  if (!row) return null;
  return {
    time: text(row.time),
    waveHeightM: null,
    swellHeightM: null,
    currentKmh: null,
    waveDirection: null,
    swellDirection: null,
    currentDirection: null,
    seaSurfaceC: finite(row.sst_c),
    anomalyC: finite(row.anomaly_c),
    sstDate: text(row.time),
  };
}

export async function checkBackend() {
  if (!api.defaults.baseURL) return { online: false, message: 'Set an API URL in More → Backend settings.' };
  try {
    const { data } = await api.get('/health');
    return { online: data.status === 'ok', message: data.status === 'ok' ? 'Connected to AquaWatch API' : 'API responded unexpectedly' };
  } catch (error) {
    const message = axios.isAxiosError(error) && error.response?.status
      ? `API returned HTTP ${error.response.status}`
      : 'Could not reach the API. Check the URL and network.';
    return { online: false, message };
  }
}
