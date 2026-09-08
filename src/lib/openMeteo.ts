// Client for Open-Meteo (https://open-meteo.com). Unlike most weather APIs,
// Open-Meteo's geocoding + forecast endpoints are free for non-commercial use
// and need NO API key or signup — great fit for a demo like this one.
// Docs: https://open-meteo.com/en/docs/geocoding-api & https://open-meteo.com/en/docs

export interface CitySearchResult {
  id: number;
  name: string;
  country: string;
  admin1?: string; // state/province, when available
  lat: number;
  lng: number;
  population?: number;
}

export interface CityWeather {
  rainfallTodayMm: number;
  rainfallLast24hMm: number;
  tempC: number;
  weatherCode: number;
  fetchedAt: string;
}

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export const searchCities = async (query: string): Promise<CitySearchResult[]> => {
  if (!query.trim()) return [];
  const url = `${GEOCODE_URL}?name=${encodeURIComponent(query)}&count=6&language=en&format=json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Geocoding request failed: ${res.status}`);
  const data = await res.json();
  return (data?.results ?? []).map((r: any) => ({
    id: r.id,
    name: r.name,
    country: r.country,
    admin1: r.admin1,
    lat: r.latitude,
    lng: r.longitude,
    population: r.population,
  }));
};

export const fetchCityWeather = async (lat: number, lng: number): Promise<CityWeather> => {
  const url = `${FORECAST_URL}?latitude=${lat}&longitude=${lng}&current=temperature_2m,precipitation,weather_code&daily=precipitation_sum&timezone=auto`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Forecast request failed: ${res.status}`);
  const data = await res.json();
  return {
    rainfallTodayMm: data?.daily?.precipitation_sum?.[0] ?? 0,
    rainfallLast24hMm: data?.current?.precipitation ?? 0,
    tempC: data?.current?.temperature_2m ?? 0,
    weatherCode: data?.current?.weather_code ?? 0,
    fetchedAt: data?.current?.time ?? new Date().toISOString(),
  };
};
