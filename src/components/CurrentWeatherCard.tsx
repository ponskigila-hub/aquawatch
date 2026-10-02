import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { WeatherSummary } from '@/components/WeatherSummary';
import { fetchCityWeather, type CitySearchResult } from '@/lib/openMeteo';
import { ArrowRight, Loader2 } from 'lucide-react';

const JAKARTA = { lat: -6.2088, lng: 106.8456 };

interface CurrentWeatherCardProps {
  city?: CitySearchResult | null;
  regionLabel: string;
}

export const CurrentWeatherCard = ({ city, regionLabel }: CurrentWeatherCardProps) => {
  const lat = city?.lat ?? JAKARTA.lat;
  const lng = city?.lng ?? JAKARTA.lng;
  const query = useQuery({
    queryKey: ['dashboard-current-weather', city?.id ?? 'jakarta', lat, lng],
    queryFn: () => fetchCityWeather(lat, lng),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  });

  return <Card className="overflow-hidden border-sky-500/15 bg-gradient-to-br from-sky-500/[0.07] via-card to-indigo-500/[0.06]">
    <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
      <div className="min-w-0"><CardTitle className="text-base">Today’s weather</CardTitle><CardDescription className="truncate">{regionLabel} · temperatures in °C</CardDescription></div>
      <Button variant="ghost" size="sm" className="shrink-0 gap-1 text-xs" asChild><Link to={city ? `/forecast?${new URLSearchParams({ id: String(city.id), name: city.name, country: city.country, lat: String(city.lat), lng: String(city.lng), admin1: city.admin1 ?? '' }).toString()}` : '/forecast'}>7-day outlook<ArrowRight className="h-3.5 w-3.5" /></Link></Button>
    </CardHeader>
    <CardContent className="pt-1">
      {query.isLoading ? <div className="flex min-h-28 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading local weather…</div>
        : query.data ? <WeatherSummary weather={query.data} compact />
          : <p className="py-5 text-sm text-muted-foreground">Weather details are temporarily unavailable. Try again in a moment.</p>}
    </CardContent>
  </Card>;
};
