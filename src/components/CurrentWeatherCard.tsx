import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WeatherSummary } from '@/components/WeatherSummary';
import { fetchCityWeather, type CitySearchResult } from '@/lib/openMeteo';
import { useGlobalCityWeather } from '@/hooks/useGlobalCityWeather';
import { weatherDescription } from '@/lib/openMeteo';
import type { GlobalCityWeather } from '@/lib/globalWeather';
import { ArrowRight, Cloud, CloudRain, CloudSun, Loader2, MapPin, Sun } from 'lucide-react';

const JAKARTA = { lat: -6.2088, lng: 106.8456 };

interface CurrentWeatherCardProps {
  city?: CitySearchResult | null;
  regionLabel: string;
  onSelectCity?: (city: CitySearchResult) => void;
}

const cityIcon = (code: number | null) => {
  if (code === 0) return Sun;
  if (code === 1 || code === 2) return CloudSun;
  if (code !== null && code >= 51) return CloudRain;
  return Cloud;
};

export const CurrentWeatherCard = ({ city, regionLabel, onSelectCity }: CurrentWeatherCardProps) => {
  const lat = city?.lat ?? JAKARTA.lat;
  const lng = city?.lng ?? JAKARTA.lng;
  const globalWeather = useGlobalCityWeather();
  const query = useQuery({
    queryKey: ['dashboard-current-weather', city?.id ?? 'jakarta', lat, lng],
    queryFn: () => fetchCityWeather(lat, lng),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  });
  const favoriteOrder = [1006, 1019, 1027, 1036, 1041, 1025, 1007];
  const otherCities = (globalWeather.data ?? [])
    .filter((item) => item.name.toLowerCase() !== city?.name.toLowerCase() || item.country.toLowerCase() !== city?.country.toLowerCase())
    .sort((a, b) => {
      const aRank = favoriteOrder.indexOf(a.id);
      const bRank = favoriteOrder.indexOf(b.id);
      return (aRank < 0 ? 99 : aRank) - (bRank < 0 ? 99 : bRank);
    })
    .slice(0, 6);

  const selectCity = (item: GlobalCityWeather) => onSelectCity?.({
    id: item.id,
    name: item.name,
    country: item.country,
    admin1: item.admin1,
    lat: item.lat,
    lng: item.lng,
  });

  return <Card className="weather-panel overflow-hidden rounded-2xl">
    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
      <div className="min-w-0"><CardTitle className="text-base sm:text-lg">Today’s weather</CardTitle><CardDescription className="flex items-center gap-1 truncate"><MapPin className="h-3 w-3 shrink-0 text-sky-300" />{regionLabel} · °C</CardDescription></div>
      <Button variant="secondary" size="sm" className="shrink-0 gap-1 text-xs" asChild><Link to={city ? `/forecast?${new URLSearchParams({ id: String(city.id), name: city.name, country: city.country, lat: String(city.lat), lng: String(city.lng), admin1: city.admin1 ?? '' }).toString()}` : '/forecast'}>7-day outlook<ArrowRight className="h-3.5 w-3.5" /></Link></Button>
    </CardHeader>
    <CardContent className="pt-1">
      {query.isLoading ? <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading local weather…</div>
        : query.data ? <WeatherSummary weather={query.data} compact />
          : <p className="py-5 text-sm text-muted-foreground">Weather details are temporarily unavailable. Try again in a moment.</p>}
      {otherCities.length > 0 && <section className="mt-4 border-t border-primary/15 pt-3">
        <div className="mb-2 flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">Other cities</h3><p className="text-[11px] text-muted-foreground">Tap a city to see its weather</p></div><span className="text-[11px] text-sky-300">Around the world</span></div>
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {otherCities.map((item) => {
            const CityIcon = cityIcon(item.weatherCode);
            return <button key={item.id} type="button" onClick={() => selectCity(item)} className="weather-city-tile flex min-w-[190px] items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition hover:-translate-y-0.5 hover:border-sky-300/70 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <CityIcon className={`h-8 w-8 shrink-0 ${item.weatherCode !== null && item.weatherCode <= 2 ? 'text-amber-300' : 'text-sky-300'}`} strokeWidth={1.6} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{item.name}</span><span className="block truncate text-[11px] text-muted-foreground">{weatherDescription(item.weatherCode)} · {item.country}</span></span>
              <span className="shrink-0 text-lg font-light">{item.temperatureC === null ? '—' : `${Math.round(item.temperatureC)}°`}</span>
            </button>;
          })}
        </div>
      </section>}
    </CardContent>
  </Card>;
};
