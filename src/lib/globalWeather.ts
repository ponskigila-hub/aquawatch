import { jakartaDistricts } from '@/data/mockData';
import { worldCities } from '@/data/worldCities';
import type { CitySearchResult } from '@/lib/openMeteo';
import type { RiskLevel } from '@/types/flood';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const FLOOD_URL = 'https://flood-api.open-meteo.com/v1/flood';

export interface WeatherLocation {
  id: string;
  name: string;
  country: string;
  admin1?: string;
  lat: number;
  lng: number;
  kind: 'jakarta_district' | 'selected_city' | 'nearby_city' | 'nearby_grid';
  distanceKm?: number;
}

export interface DailyValue {
  date: string;
  value: number | null;
}

export interface LiveAreaWeather extends WeatherLocation {
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidityPercent: number | null;
  windKph: number | null;
  todayHighC: number | null;
  todayLowC: number | null;
  rainChancePercent: number | null;
  observedAt: string | null;
  currentPrecipitationMm: number | null;
  latestDailyRainfallMm: number | null;
  weatherCode: number | null;
  riskLevel: RiskLevel;
  rainHistory: DailyValue[];
  dischargeHistory: DailyValue[];
  latestDischargeM3s: number | null;
}

export interface LiveRegionWeather {
  areas: LiveAreaWeather[];
  rainfallTrend: DailyValue[];
  dischargeTrend: DailyValue[];
  fetchedAt: string;
  rainfallSource: string;
  dischargeSource: string;
  dischargeAvailable: boolean;
}

export type FloodRiskEstimate = 'Low' | 'Watch' | 'High' | 'Unavailable';

export interface RegionalOutlookDay {
  date: string;
  rainfallMm: number | null;
  rainChancePercent: number | null;
  temperatureHighC: number | null;
  temperatureLowC: number | null;
  riverDischargeM3s: number | null;
  weatherCode: number | null;
  floodRisk: FloodRiskEstimate;
}

export interface RegionalOutlook {
  days: RegionalOutlookDay[];
  fetchedAt: string;
  dischargeAvailable: boolean;
}

export interface GlobalCityWeather {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  lat: number;
  lng: number;
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidityPercent: number | null;
  windKph: number | null;
  todayHighC: number | null;
  todayLowC: number | null;
  rainChancePercent: number | null;
  precipitationMm: number | null;
  dailyRainfallMm: number | null;
  weatherCode: number | null;
  fetchedAt: string;
  riskLevel: RiskLevel;
}

interface WeatherApiResult {
  current?: {
    time?: string;
    temperature_2m?: number | null;
    apparent_temperature?: number | null;
    relative_humidity_2m?: number | null;
    wind_speed_10m?: number | null;
    precipitation?: number | null;
    weather_code?: number | null;
  };
  daily?: {
    time?: string[];
    rain_sum?: Array<number | null>;
    precipitation_sum?: Array<number | null>;
    temperature_2m_max?: Array<number | null>;
    temperature_2m_min?: Array<number | null>;
    precipitation_probability_max?: Array<number | null>;
    weather_code?: Array<number | null>;
    river_discharge?: Array<number | null>;
  };
}

const toNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const riskFromRainfall = (rainfall: number | null): RiskLevel => {
  if (rainfall === null) return 'safe';
  if (rainfall >= 50) return 'high';
  if (rainfall >= 20) return 'medium';
  return 'safe';
};

const haversineKm = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLat = toRadians(bLat - aLat);
  const dLng = toRadians(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(aLat)) * Math.cos(toRadians(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

export const getRegionLabel = (city?: CitySearchResult | null) =>
  city ? `${city.name}${city.admin1 ? `, ${city.admin1}` : ''}, ${city.country}` : 'Jakarta, Indonesia';

export const getRegionalLocations = (city?: CitySearchResult | null): WeatherLocation[] => {
  if (!city || (city.name.toLowerCase() === 'jakarta' && city.country.toLowerCase() === 'indonesia')) {
    return jakartaDistricts.map((district) => ({
      id: district.id,
      name: district.name,
      country: 'Indonesia',
      admin1: 'Jakarta',
      lat: district.coordinates[0],
      lng: district.coordinates[1],
      kind: 'jakarta_district',
    }));
  }

  const selected: WeatherLocation = {
    id: `selected-${city.id}`,
    name: city.name,
    country: city.country,
    admin1: city.admin1,
    lat: city.lat,
    lng: city.lng,
    kind: 'selected_city',
  };
  const nearby = worldCities
    .map((candidate) => ({
      candidate,
      distanceKm: haversineKm(city.lat, city.lng, candidate.lat, candidate.lng),
    }))
    .filter(({ candidate, distanceKm }) => candidate.id !== city.id && distanceKm >= 25 && distanceKm <= 450)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 4)
    .map(({ candidate, distanceKm }) => ({
      id: `city-${candidate.id}`,
      name: candidate.name,
      country: candidate.country,
      admin1: candidate.admin1,
      lat: candidate.lat,
      lng: candidate.lng,
      kind: 'nearby_city' as const,
      distanceKm: Math.round(distanceKm),
    }));

  // For remote locations where the curated city index has fewer than four
  // nearby named cities, use clearly-labelled local weather grid points.
  const directions = [
    { label: 'North local grid', dLat: 0.35, dLng: 0 },
    { label: 'East local grid', dLat: 0, dLng: 0.35 },
    { label: 'South local grid', dLat: -0.35, dLng: 0 },
    { label: 'West local grid', dLat: 0, dLng: -0.35 },
  ];
  const grid = directions
    .filter((direction) => !nearby.some((area) => area.name.startsWith(direction.label.split(' ')[0])))
    .slice(0, Math.max(0, 4 - nearby.length))
    .map((direction, index) => ({
      id: `grid-${city.id}-${index}`,
      name: `${direction.label} · ${city.name}`,
      country: city.country,
      admin1: city.admin1,
      lat: Math.max(-89.8, Math.min(89.8, city.lat + direction.dLat)),
      lng: Math.max(-179.8, Math.min(179.8, city.lng + direction.dLng / Math.max(0.2, Math.cos((city.lat * Math.PI) / 180)))),
      kind: 'nearby_grid' as const,
      distanceKm: Math.round(Math.abs(direction.dLat || direction.dLng) * 111),
    }));

  return [selected, ...nearby, ...grid].slice(0, 5);
};

const fetchMultiPointJson = async (
  baseUrl: string,
  locations: WeatherLocation[],
  extra: Record<string, string>,
): Promise<WeatherApiResult[]> => {
  const params = new URLSearchParams(extra);
  params.set('latitude', locations.map((location) => String(location.lat)).join(','));
  params.set('longitude', locations.map((location) => String(location.lng)).join(','));
  const response = await fetch(`${baseUrl}?${params.toString()}`);
  if (!response.ok) throw new Error(`Weather service failed (${response.status})`);
  const data = await response.json();
  return (Array.isArray(data) ? data : [data]) as WeatherApiResult[];
};

const makeDailySeries = (record?: WeatherApiResult, key: 'rain_sum' | 'river_discharge' = 'rain_sum'): DailyValue[] => {
  const times = record?.daily?.time ?? [];
  const values = record?.daily?.[key] ?? [];
  return times.map((date, index) => ({ date, value: toNumber(values[index]) }));
};

const meanSeries = (areas: LiveAreaWeather[], property: 'rainHistory' | 'dischargeHistory'): DailyValue[] => {
  const first = areas.find((area) => area[property].length > 0)?.[property] ?? [];
  return first.map((entry, index) => {
    const values = areas.map((area) => area[property][index]?.value).filter((value): value is number => value !== null && value !== undefined);
    return { date: entry.date, value: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
  });
};

export async function fetchRegionalWeather(locations: WeatherLocation[]): Promise<LiveRegionWeather> {
  const [weatherRecords, floodRecords] = await Promise.all([
    fetchMultiPointJson(FORECAST_URL, locations, {
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code',
      daily: 'rain_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
      past_days: '13',
      forecast_days: '1',
      timezone: 'GMT',
    }),
    fetchMultiPointJson(FLOOD_URL, locations, {
      daily: 'river_discharge',
      past_days: '7',
      forecast_days: '0',
      timezone: 'GMT',
    }).catch(() => [] as WeatherApiResult[]),
  ]);

  const areas = locations.map((location, index): LiveAreaWeather => {
    const weather = weatherRecords[index];
    const flood = floodRecords[index];
    const rainHistory = makeDailySeries(weather, 'rain_sum').slice(-14);
    const dischargeHistory = makeDailySeries(flood, 'river_discharge').slice(-7);
    const latestDailyRainfallMm = rainHistory.at(-1)?.value ?? null;
    const today = weather?.current?.time?.slice(0, 10);
    const foundTodayIndex = today ? weather?.daily?.time?.indexOf(today) ?? -1 : -1;
    const todayIndex = foundTodayIndex >= 0 ? foundTodayIndex : Math.max(0, (weather?.daily?.time?.length ?? 1) - 1);
    return {
      ...location,
      temperatureC: toNumber(weather?.current?.temperature_2m),
      feelsLikeC: toNumber(weather?.current?.apparent_temperature),
      humidityPercent: toNumber(weather?.current?.relative_humidity_2m),
      windKph: toNumber(weather?.current?.wind_speed_10m),
      todayHighC: toNumber(weather?.daily?.temperature_2m_max?.[todayIndex]),
      todayLowC: toNumber(weather?.daily?.temperature_2m_min?.[todayIndex]),
      rainChancePercent: toNumber(weather?.daily?.precipitation_probability_max?.[todayIndex]),
      observedAt: weather?.current?.time ? `${weather.current.time}Z` : null,
      currentPrecipitationMm: toNumber(weather?.current?.precipitation),
      weatherCode: toNumber(weather?.current?.weather_code),
      latestDailyRainfallMm,
      riskLevel: riskFromRainfall(latestDailyRainfallMm),
      rainHistory,
      dischargeHistory,
      latestDischargeM3s: dischargeHistory.at(-1)?.value ?? null,
    };
  });

  return {
    areas,
    rainfallTrend: meanSeries(areas, 'rainHistory'),
    dischargeTrend: meanSeries(areas, 'dischargeHistory'),
    fetchedAt: new Date().toISOString(),
    rainfallSource: 'Open-Meteo global weather models',
    dischargeSource: 'Open-Meteo Global Flood API · GloFAS modeled river discharge',
    dischargeAvailable: floodRecords.length > 0 && areas.some((area) => area.dischargeHistory.some((value) => value.value !== null)),
  };
}

export async function fetchGlobalCityWeather(): Promise<GlobalCityWeather[]> {
  const locations: WeatherLocation[] = worldCities.map((city) => ({
    id: `world-${city.id}`,
    name: city.name,
    country: city.country,
    lat: city.lat,
    lng: city.lng,
    kind: 'nearby_city',
  }));
  const records = await fetchMultiPointJson(FORECAST_URL, locations, {
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code',
    daily: 'rain_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    forecast_days: '1',
    timezone: 'GMT',
  });
  return worldCities.map((city, index) => {
    const record = records[index];
    const dailyRainfallMm = toNumber(record?.daily?.rain_sum?.[0]);
    return {
      id: city.id,
      name: city.name,
      country: city.country,
      admin1: city.admin1,
      lat: city.lat,
      lng: city.lng,
      temperatureC: toNumber(record?.current?.temperature_2m),
      feelsLikeC: toNumber(record?.current?.apparent_temperature),
      humidityPercent: toNumber(record?.current?.relative_humidity_2m),
      windKph: toNumber(record?.current?.wind_speed_10m),
      todayHighC: toNumber(record?.daily?.temperature_2m_max?.[0]),
      todayLowC: toNumber(record?.daily?.temperature_2m_min?.[0]),
      rainChancePercent: toNumber(record?.daily?.precipitation_probability_max?.[0]),
      precipitationMm: toNumber(record?.current?.precipitation),
      dailyRainfallMm,
      weatherCode: toNumber(record?.current?.weather_code),
      fetchedAt: record?.current?.time ?? new Date().toISOString(),
      riskLevel: riskFromRainfall(dailyRainfallMm),
    };
  });
}

export function estimateFloodRisk(rainfallMm: number | null, rainChancePercent: number | null): FloodRiskEstimate {
  if (rainfallMm === null) return 'Unavailable';
  if (rainfallMm >= 50 || (rainfallMm >= 25 && (rainChancePercent ?? 0) >= 70)) return 'High';
  if (rainfallMm >= 20 || (rainfallMm >= 10 && (rainChancePercent ?? 0) >= 70)) return 'Watch';
  return 'Low';
}

export async function fetchRegionalOutlook(locations: WeatherLocation[]): Promise<RegionalOutlook> {
  const [weatherRecords, floodRecords] = await Promise.all([
    fetchMultiPointJson(FORECAST_URL, locations, {
      daily: 'rain_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
      forecast_days: '7',
      timezone: 'GMT',
    }),
    fetchMultiPointJson(FLOOD_URL, locations, {
      daily: 'river_discharge',
      forecast_days: '7',
      timezone: 'GMT',
    }).catch(() => [] as WeatherApiResult[]),
  ]);

  const dates = weatherRecords[0]?.daily?.time ?? [];
  const days: RegionalOutlookDay[] = dates.map((date, dateIndex) => {
    const averageFor = (records: WeatherApiResult[], key: keyof NonNullable<WeatherApiResult['daily']>) => {
      const values = records.map((record) => {
        const index = record.daily?.time?.indexOf(date) ?? dateIndex;
        return toNumber(record.daily?.[key]?.[index]);
      });
      return averageValues(values);
    };
    const rainfallMm = averageFor(weatherRecords, 'rain_sum');
    const rainChancePercent = averageFor(weatherRecords, 'precipitation_probability_max');
    const codes = weatherRecords.map((record) => {
      const index = record.daily?.time?.indexOf(date) ?? dateIndex;
      return toNumber(record.daily?.weather_code?.[index]);
    }).filter((value): value is number => value !== null);
    const codeCounts = new Map<number, number>();
    codes.forEach((code) => codeCounts.set(code, (codeCounts.get(code) ?? 0) + 1));
    const weatherCode = [...codeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      date,
      rainfallMm,
      rainChancePercent,
      temperatureHighC: averageFor(weatherRecords, 'temperature_2m_max'),
      temperatureLowC: averageFor(weatherRecords, 'temperature_2m_min'),
      riverDischargeM3s: averageFor(floodRecords, 'river_discharge'),
      weatherCode,
      floodRisk: estimateFloodRisk(rainfallMm, rainChancePercent),
    };
  });

  return {
    days,
    fetchedAt: new Date().toISOString(),
    dischargeAvailable: floodRecords.some((record) => (record.daily?.river_discharge ?? []).some((value) => value !== null)),
  };
}

export const averageValues = (values: Array<number | null | undefined>) => {
  const valid = values.filter((value): value is number => value !== null && value !== undefined && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};
