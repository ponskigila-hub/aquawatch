import axios from 'axios';
import { api } from './api';
import type { Coordinates, Earthquake, MarineSnapshot, WeatherHour, WeatherSnapshot } from '../theme';

const finite = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback;
interface UsgsFeature {
  id?: string;
  properties?: { place?: string | null; mag?: number | null; time?: number | null; url?: string | null };
  geometry?: { coordinates?: unknown };
}
interface UsgsResponse { features?: UsgsFeature[]; }

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

export async function fetchWeather(point: Coordinates): Promise<WeatherSnapshot> {
  const { data } = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude: point.latitude,
      longitude: point.longitude,
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
      hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m',
      daily: 'rain_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
      forecast_days: 7,
      timezone: 'auto',
    },
    timeout: 18_000,
  });
  const current = data.current ?? {};
  const hourly = data.hourly ?? {};
  const daily = data.daily ?? {};
  const times: string[] = Array.isArray(hourly.time) ? hourly.time : [];
  const now = text(current.time);
  const first = Math.max(0, times.findIndex((time) => time >= now));
  const hourlyForecast: WeatherHour[] = times.slice(first, first + 12).map((time: string, offset: number) => {
    const index = first + offset;
    return {
      time,
      temperatureC: finite(hourly.temperature_2m?.[index]),
      rainChance: finite(hourly.precipitation_probability?.[index]),
      weatherCode: finite(hourly.weather_code?.[index]),
      windKph: finite(hourly.wind_speed_10m?.[index]),
      humidity: finite(hourly.relative_humidity_2m?.[index]),
    };
  });
  const days: string[] = Array.isArray(daily.time) ? daily.time : [];
  return {
    temperatureC: finite(current.temperature_2m),
    feelsLikeC: finite(current.apparent_temperature),
    humidity: finite(current.relative_humidity_2m),
    windKph: finite(current.wind_speed_10m),
    precipitationMm: finite(current.precipitation),
    weatherCode: finite(current.weather_code),
    highC: finite(daily.temperature_2m_max?.[0]),
    lowC: finite(daily.temperature_2m_min?.[0]),
    rainChance: finite(daily.precipitation_probability_max?.[0]),
    rainTodayMm: finite(daily.rain_sum?.[0]),
    hourly: hourlyForecast,
    daily: days.map((date: string, index: number) => ({
      date,
      highC: finite(daily.temperature_2m_max?.[index]),
      lowC: finite(daily.temperature_2m_min?.[index]),
      rainMm: finite(daily.rain_sum?.[index]),
      rainChance: finite(daily.precipitation_probability_max?.[index]),
      weatherCode: finite(daily.weather_code?.[index]),
    })),
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
