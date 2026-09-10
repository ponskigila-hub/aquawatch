import { lazy, Suspense, useState } from 'react';
import { RainfallChart } from '@/components/RainfallChart';
import { WaterLevelChart } from '@/components/WaterLevelChart';
import { AlertList } from '@/components/AlertList';
import { DistrictStats } from '@/components/DistrictStats';
import { StatsOverview } from '@/components/StatsOverview';
import { InsightsPanel } from '@/components/InsightsPanel';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CitySearch } from '@/components/CitySearch';
import { Button } from '@/components/ui/button';
import { recentAlerts } from '@/data/mockData';
import { CitySearchResult } from '@/lib/openMeteo';
import { Waves, Loader2, Globe as GlobeIcon, Map as MapIcon } from 'lucide-react';

// The globe pulls in three.js, so both views are lazy-loaded to keep the initial bundle light.
const RiskGlobe = lazy(() => import('@/components/RiskGlobe').then((m) => ({ default: m.RiskGlobe })));
const RiskMap2D = lazy(() => import('@/components/RiskMap2D').then((m) => ({ default: m.RiskMap2D })));

const MapFallback = () => (
  <div className="w-full h-[340px] sm:h-[420px] lg:h-[500px] rounded-lg border bg-muted flex flex-col items-center justify-center gap-2 text-muted-foreground">
    <Loader2 className="w-6 h-6 animate-spin" />
    <p className="text-xs">Loading map…</p>
  </div>
);

const Index = () => {
  const [viewMode, setViewMode] = useState<'globe' | 'map'>('globe');
  const [searchedCity, setSearchedCity] = useState<CitySearchResult | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number } | null>(null);

  const handleDeepZoom = (lat: number, lng: number) => {
    setMapCenter({ lat, lng });
    setViewMode('map');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/70 backdrop-blur-md sticky top-0 z-20 supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 shadow-sm">
                <Waves className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-2xl font-bold leading-tight truncate">AquaWatch</h1>
                <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">
                  Global flood &amp; rainfall risk monitoring
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <div className="hidden sm:flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground border rounded-full px-3 py-1.5 bg-background/50">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-risk-safe opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-risk-safe" />
                </span>
                <span>Live · Updated just now</span>
              </div>
              <div className="sm:hidden flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-risk-safe opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-risk-safe" />
                </span>
                Live
              </div>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-5 sm:py-6 lg:py-8 space-y-6 sm:space-y-8 lg:space-y-10">
        {/* Stats Overview */}
        <StatsOverview />

        {/* Insights */}
        <InsightsPanel />

        {/* Map/Globe Section */}
        <section>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-3 sm:mb-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">Interactive Risk {viewMode === 'globe' ? 'Globe' : 'Map'}</h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Now tracking Jakarta, Indonesia, plus live global flood &amp; storm activity. Search any city for live weather.
              </p>
            </div>
            <div className="flex items-center gap-1 border rounded-lg p-1 bg-muted/40 shrink-0">
              <Button
                size="sm"
                variant={viewMode === 'globe' ? 'default' : 'ghost'}
                className="h-7 px-2.5 gap-1.5 text-xs"
                onClick={() => {
                  setViewMode('globe');
                  setMapCenter(null);
                }}
              >
                <GlobeIcon className="w-3.5 h-3.5" />
                Globe
              </Button>
              <Button
                size="sm"
                variant={viewMode === 'map' ? 'default' : 'ghost'}
                className="h-7 px-2.5 gap-1.5 text-xs"
                onClick={() => {
                  setViewMode('map');
                  setMapCenter(null);
                }}
              >
                <MapIcon className="w-3.5 h-3.5" />
                Map
              </Button>
            </div>
          </div>

          <div className="mb-3">
            <CitySearch onSelect={setSearchedCity} />
          </div>

          <Suspense fallback={<MapFallback />}>
            {viewMode === 'globe' ? (
              <RiskGlobe searchedCity={searchedCity} onDeepZoom={handleDeepZoom} />
            ) : (
              <RiskMap2D searchedCity={searchedCity} initialCenter={mapCenter} />
            )}
          </Suspense>
        </section>

        {/* Charts Grid */}
        <section>
          <div className="mb-3 sm:mb-4">
            <h2 className="text-lg sm:text-xl font-semibold">Trends</h2>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Rainfall and water level over the past week
            </p>
          </div>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            <RainfallChart />
            <WaterLevelChart />
          </div>
        </section>

        {/* Alerts and District Stats */}
        <section>
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 items-start">
            <AlertList alerts={recentAlerts} />
            <DistrictStats />
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-8 sm:mt-12 py-5 sm:py-6 bg-muted/30">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2 text-center text-xs sm:text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Waves className="w-3.5 h-3.5" />
            AquaWatch
          </span>
          <span className="hidden sm:inline">•</span>
          <span>Climate Action Initiative</span>
        </div>
      </footer>
    </div>
  );
};

export default Index;
