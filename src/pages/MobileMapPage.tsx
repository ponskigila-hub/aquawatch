import { lazy, Suspense, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { GlobeSearchKind } from '@/components/GlobeSearch';
import type { CitySearchResult } from '@/lib/openMeteo';

const RiskGlobe = lazy(() => import('@/components/RiskGlobe').then((module) => ({ default: module.RiskGlobe })));
const RiskMap2D = lazy(() => import('@/components/RiskMap2D').then((module) => ({ default: module.RiskMap2D })));

const validNumber = (value: string | null, min: number, max: number) => {
  const number = value === null ? NaN : Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
};

export default function MobileMapPage() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialLatitude = validNumber(params.get('lat'), -90, 90) ?? -6.2088;
  const initialLongitude = validNumber(params.get('lng'), -180, 180) ?? 106.8456;
  const mode = params.get('mode') === '2d' ? '2d' : '3d';
  const [searchedCity, setSearchedCity] = useState<CitySearchResult | null>(null);
  const center = searchedCity ? { lat: searchedCity.lat, lng: searchedCity.lng } : { lat: initialLatitude, lng: initialLongitude };
  const onSelectLocation = (city: CitySearchResult, _kind: GlobeSearchKind) => setSearchedCity(city);

  return <main className="mobile-map-host" style={{ width: '100vw', height: '100dvh', minHeight: '100vh', overflow: 'hidden', background: '#102E4A' }}>
    <Suspense fallback={<div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#B7C6DA' }}><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      {mode === '2d'
        ? <RiskMap2D searchedCity={searchedCity} initialCenter={center} regionLabel={searchedCity?.name ?? 'Your location'} fullHeight />
        : <RiskGlobe searchedCity={searchedCity} defaultCenter={center} regionLabel={searchedCity?.name ?? 'Your location'} onSelectLocation={onSelectLocation} onResetSearch={() => setSearchedCity(null)} fullHeight />}
    </Suspense>
  </main>;
}
