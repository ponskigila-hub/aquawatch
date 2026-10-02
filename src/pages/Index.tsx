import { lazy, Suspense, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { RainfallChart } from '@/components/RainfallChart';
import { WaterLevelChart } from '@/components/WaterLevelChart';
import { AlertList } from '@/components/AlertList';
import { DistrictStats } from '@/components/DistrictStats';
import { StatsOverview } from '@/components/StatsOverview';
import { InsightsPanel } from '@/components/InsightsPanel';
import { CurrentWeatherCard } from '@/components/CurrentWeatherCard';
import type { GlobeSearchKind } from '@/components/GlobeSearch';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CitySearch } from '@/components/CitySearch';
import { Button } from '@/components/ui/button';
import { useRegionalWeather } from '@/hooks/useRegionalWeather';
import { buildRegionAlerts } from '@/lib/liveAlerts';
import { getRegionLabel } from '@/lib/globalWeather';
import { fetchFloodStormEvents } from '@/lib/eonet';
import type { CitySearchResult } from '@/lib/openMeteo';
import { Waves, Loader2, Globe as GlobeIcon, Map as MapIcon, CloudRain, RotateCcw } from 'lucide-react';

const RiskGlobe = lazy(() => import('@/components/RiskGlobe').then((module) => ({ default: module.RiskGlobe })));
const RiskMap2D = lazy(() => import('@/components/RiskMap2D').then((module) => ({ default: module.RiskMap2D })));
const MapFallback = () => <div className="w-full h-[340px] sm:h-[420px] lg:h-[500px] rounded-lg border bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /><p className="text-xs">Loading map…</p></div>;

const forecastHref = (city: CitySearchResult | null, isCountry = false) => {
  if (!city) return '/forecast';
  const query = new URLSearchParams({
    id: String(city.id), name: city.name, country: city.country,
    lat: String(city.lat), lng: String(city.lng), admin1: city.admin1 ?? '', isCountry: String(isCountry),
  });
  return `/forecast?${query.toString()}`;
};

const Index = () => {
  const [viewMode, setViewMode] = useState<'globe' | 'map'>('globe');
  const [searchedCity, setSearchedCity] = useState<CitySearchResult | null>(null);
  const [searchedIsCountry, setSearchedIsCountry] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);
  const mapInitialCenter = useMemo(() => mapCenter ?? (searchedCity ? { lat: searchedCity.lat, lng: searchedCity.lng } : null), [mapCenter, searchedCity]);
  const regionLabel = searchedIsCountry && searchedCity ? searchedCity.country : getRegionLabel(searchedCity);
  const { data: regionWeather, isLoading: regionLoading, isError: regionErrored } = useRegionalWeather(searchedCity);
  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['eonet-flood-storm-events'], queryFn: fetchFloodStormEvents, staleTime: 15 * 60 * 1000, retry: 1,
  });
  const center = searchedCity ? { lat: searchedCity.lat, lng: searchedCity.lng } : { lat: -6.2088, lng: 106.8456 };
  const alerts = buildRegionAlerts(regionWeather?.areas ?? [], events, center);

  const handleDeepZoom = (lat: number, lng: number) => { setMapCenter({ lat, lng }); setViewMode('map'); };
  const handleLocationSelect = (location: CitySearchResult, kind: GlobeSearchKind) => {
    setSearchedCity(location);
    setSearchedIsCountry(kind === 'country');
  };
  const handleCityReset = () => {
    setSearchedCity(null);
    setSearchedIsCountry(false);
    setMapCenter(null);
  };

  return (
      <div className="weather-shell">
      <header className="border-b bg-card/70 backdrop-blur-md sticky top-0 z-20 supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-sm"><Waves className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" /></div>
              <div className="min-w-0"><h1 className="text-base sm:text-2xl font-bold leading-tight truncate">AquaWatch</h1><p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">Global flood &amp; rainfall risk monitoring</p></div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground border rounded-full px-3 py-1.5 bg-background/50"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-risk-safe opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-risk-safe" /></span><span>{regionErrored ? 'Weather unavailable' : regionLoading ? 'Loading weather' : 'Live weather · updates every 15 min'}</span></div>
              <Button asChild size="sm" className="gap-1.5"><Link to={forecastHref(searchedCity, searchedIsCountry)}><CloudRain className="w-4 h-4" /><span>Forecast</span></Link></Button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-5 sm:py-6 lg:py-8 space-y-6 sm:space-y-8 lg:space-y-10">
        <div className="flex flex-col gap-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Local weather</p><h2 className="text-lg font-semibold">{regionLabel}</h2></div>
        <CurrentWeatherCard city={searchedCity} regionLabel={regionLabel} onSelectCity={(location) => handleLocationSelect(location, 'city')} />
        <section aria-labelledby="overview-heading">
          <div className="mb-3"><h2 id="overview-heading" className="text-lg font-semibold sm:text-xl">Rain &amp; flood overview</h2><p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">The key conditions for {regionLabel} at a glance.</p></div>
          <StatsOverview data={regionWeather} isLoading={regionLoading} regionLabel={regionLabel} />
        </section>
        <section aria-labelledby="watch-heading">
          <div className="mb-3"><h2 id="watch-heading" className="text-lg font-semibold sm:text-xl">What to watch</h2></div>
          <InsightsPanel data={regionWeather} isLoading={regionLoading} regionLabel={regionLabel} />
        </section>

        <section>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3 sm:mb-4">
            <div><h2 className="text-lg sm:text-xl font-semibold">Explore the world</h2><p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Search for a city or country, or select a glowing weather dot.</p></div>
            <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/40 shrink-0">
              <Button size="sm" variant={viewMode === 'globe' ? 'default' : 'ghost'} className="h-7 px-2.5 gap-1.5 text-xs" onClick={() => { setViewMode('globe'); setMapCenter(null); }}><GlobeIcon className="w-3.5 h-3.5" />Globe</Button>
              <Button size="sm" variant={viewMode === 'map' ? 'default' : 'ghost'} className="h-7 px-2.5 gap-1.5 text-xs" onClick={() => { setViewMode('map'); setMapCenter(null); }}><MapIcon className="w-3.5 h-3.5" />Map</Button>
            </div>
          </div>
          {viewMode === 'map' && <div className="mb-3 flex flex-wrap items-center gap-2">
            <CitySearch onSelect={(location) => handleLocationSelect(location, 'city')} onReset={handleCityReset} placeholder="Search a city on the map…" />
            {searchedCity && <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleCityReset}><RotateCcw className="w-3.5 h-3.5" />Back to Jakarta</Button>}
          </div>}
          {regionErrored && !regionWeather && <div className="mb-3 rounded-lg border border-risk-medium/30 bg-risk-medium/5 px-3 py-2 text-sm text-muted-foreground">Live regional weather could not be loaded; the dashboard will refresh and retry. It will not substitute mock measurements.</div>}
          <Suspense fallback={<MapFallback />}>
            {viewMode === 'globe'
              ? <RiskGlobe searchedCity={searchedCity} searchedIsCountry={searchedIsCountry} regionWeather={regionWeather} regionLabel={regionLabel} onSelectLocation={handleLocationSelect} onResetSearch={handleCityReset} onDeepZoom={handleDeepZoom} />
              : <RiskMap2D searchedCity={searchedCity} initialCenter={mapInitialCenter} regionWeather={regionWeather} regionLabel={regionLabel} />}
          </Suspense>
        </section>

        <section>
          <div className="mb-3 sm:mb-4"><h2 className="text-lg sm:text-xl font-semibold">Rain &amp; river trends</h2><p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Daily estimates for {regionLabel}.</p></div>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2"><RainfallChart data={regionWeather} regionLabel={regionLabel} /><WaterLevelChart data={regionWeather} regionLabel={regionLabel} /></div>
        </section>

        <section><div className="grid gap-4 sm:gap-6 lg:grid-cols-2 items-start"><AlertList alerts={alerts} regionLabel={regionLabel} isLoading={regionLoading || eventsLoading} /><DistrictStats data={regionWeather} isLoading={regionLoading} regionLabel={regionLabel} /></div></section>
      </main>

      <footer className="border-t mt-8 sm:mt-12 py-5 sm:py-6 bg-muted/30"><div className="container mx-auto px-4 flex flex-col items-center justify-center gap-1.5 text-center text-xs sm:text-sm text-muted-foreground"><span className="flex items-center gap-1.5"><Waves className="w-3.5 h-3.5" />AquaWatch</span><span>Live weather estimates · Nearby river-flow estimates · Reported events</span></div></footer>
    </div>
  );
};

export default Index;
