// Open-Meteo provides global city search and weather forecasts without an API key
// for non-commercial use. See https://open-meteo.com/en/docs.

export interface CitySearchResult {
  id: number;
  name: string;
  country: string;
  admin1?: string;
  lat: number;
  lng: number;
  population?: number;
}

export interface HourlyWeather {
  time: string;
  temperatureC: number | null;
  rainChancePercent: number | null;
  weatherCode: number | null;
}

export interface CityWeather {
  rainfallTodayMm: number | null;
  currentPrecipitationMm: number | null;
  temperatureC: number | null;
  feelsLikeC: number | null;
  highC: number | null;
  lowC: number | null;
  rainChancePercent: number | null;
  windKph: number | null;
  humidityPercent: number | null;
  weatherCode: number | null;
  hourlyForecast: HourlyWeather[];
  fetchedAt: string;
}

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export const searchCities = async (query: string): Promise<CitySearchResult[]> => {
  if (!query.trim()) return [];
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`City search failed (${res.status}).`);
  const data = await res.json();
  return (data?.results ?? []).map((result: Record<string, unknown>) => ({
    id: Number(result.id),
    name: String(result.name ?? ''),
    country: String(result.country ?? ''),
    admin1: typeof result.admin1 === 'string' ? result.admin1 : undefined,
    lat: Number(result.latitude),
    lng: Number(result.longitude),
    population: typeof result.population === 'number' ? result.population : undefined,
  }));
};

export const weatherDescription = (code: number | null | undefined): string => {
  if (code === null || code === undefined) return 'Weather unavailable';
  if (code === 0) return 'Clear';
  if (code === 1) return 'Mostly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([80, 81, 82].includes(code)) return 'Rain showers';
  if ([95, 96, 99].includes(code)) return 'Thunderstorms';
  return 'Changing conditions';
};

const numberOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

export const fetchCityWeather = async (lat: number, lng: number): Promise<CityWeather> => {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    hourly: 'temperature_2m,precipitation_probability,weather_code',
    daily: 'rain_sum,temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    forecast_days: '2',
    timezone: 'auto',
  });
  const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
  if (!res.ok) throw new Error(`Weather forecast failed (${res.status}).`);
  const data = await res.json();
  const currentTime = String(data?.current?.time ?? '');
  const hourlyTimes: string[] = data?.hourly?.time ?? [];
  const startHour = Math.max(0, hourlyTimes.findIndex((time) => time >= currentTime));
  const hourlyForecast: HourlyWeather[] = hourlyTimes.slice(startHour, startHour + 6).map((time, index) => {
    const sourceIndex = startHour + index;
    return {
      time,
      temperatureC: numberOrNull(data?.hourly?.temperature_2m?.[sourceIndex]),
      rainChancePercent: numberOrNull(data?.hourly?.precipitation_probability?.[sourceIndex]),
      weatherCode: numberOrNull(data?.hourly?.weather_code?.[sourceIndex]),
    };
  });

  return {
    rainfallTodayMm: numberOrNull(data?.daily?.rain_sum?.[0]),
    currentPrecipitationMm: numberOrNull(data?.current?.precipitation),
    temperatureC: numberOrNull(data?.current?.temperature_2m),
    feelsLikeC: numberOrNull(data?.current?.apparent_temperature),
    highC: numberOrNull(data?.daily?.temperature_2m_max?.[0]),
    lowC: numberOrNull(data?.daily?.temperature_2m_min?.[0]),
    rainChancePercent: numberOrNull(data?.daily?.precipitation_probability_max?.[0]),
    windKph: numberOrNull(data?.current?.wind_speed_10m),
    humidityPercent: numberOrNull(data?.current?.relative_humidity_2m),
    weatherCode: numberOrNull(data?.current?.weather_code),
    hourlyForecast,
    fetchedAt: currentTime || new Date().toISOString(),
  };
};
