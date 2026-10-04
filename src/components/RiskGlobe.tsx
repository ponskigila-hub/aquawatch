import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RiskBadge } from '@/components/RiskBadge';
import { useGlobalCityWeather } from '@/hooks/useGlobalCityWeather';
import { fetchFloodStormEvents, type EonetEvent } from '@/lib/eonet';
import { fetchCityWeather, weatherDescription, type CitySearchResult } from '@/lib/openMeteo';
import { getRegionLabel } from '@/lib/globalWeather';
import type { GlobalCityWeather, LiveAreaWeather, LiveRegionWeather } from '@/lib/globalWeather';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { X, Loader2, RotateCcw, Radio, ExternalLink } from 'lucide-react';
import { WeatherSummary } from '@/components/WeatherSummary';
import { GlobeSearch, type GlobeSearchKind } from '@/components/GlobeSearch';

const riskColors: Record<string, string> = {
  safe: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
};
const disasterColors: Record<string, string> = {
  Floods: '#38bdf8',
  'Severe Storms': '#a855f7',
};
const disasterColor = (category: string) => disasterColors[category] ?? '#fb923c';
const JAKARTA_VIEW = { lat: -6.2, lng: 106.85, altitude: 1.7 };
const DEEP_ZOOM_ALTITUDE_THRESHOLD = 0.45;

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] ?? character));

 type GlobePoint =
  | { kind: 'area'; lat: number; lng: number; area: LiveAreaWeather }
  | { kind: 'global-city'; lat: number; lng: number; city: GlobalCityWeather }
  | { kind: 'disaster'; lat: number; lng: number; event: EonetEvent }
  | { kind: 'searched'; lat: number; lng: number; city: CitySearchResult };

interface RiskGlobeProps {
  searchedCity?: CitySearchResult | null;
  searchedIsCountry?: boolean;
  defaultCenter?: { lat: number; lng: number } | null;
  regionWeather?: LiveRegionWeather;
  regionLabel?: string;
  onSelectLocation: (city: CitySearchResult, kind: GlobeSearchKind) => void;
  onResetSearch: () => void;
  onDeepZoom?: (lat: number, lng: number) => void;
}

export const RiskGlobe = ({ searchedCity, searchedIsCountry = false, defaultCenter, regionWeather, regionLabel = 'Jakarta, Indonesia', onSelectLocation, onResetSearch, onDeepZoom }: RiskGlobeProps) => {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const defaultCenterLat = defaultCenter?.lat;
  const defaultCenterLng = defaultCenter?.lng;
  const [dimensions, setDimensions] = useState({ width: 300, height: 460 });
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<GlobePoint | null>(null);
  const hasTriggeredDeepZoom = useRef(false);

  const { data: disasterEvents = [], isError: eventsErrored } = useQuery({
    queryKey: ['eonet-flood-storm-events'],
    queryFn: fetchFloodStormEvents,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });
  const { data: globalCities = [], isLoading: globalCitiesLoading } = useGlobalCityWeather();
  const selectedWeatherLocation = selected && selected.kind !== 'disaster' ? selected : null;
  const { data: selectedWeather, isLoading: selectedWeatherLoading, isError: selectedWeatherErrored } = useQuery({
    queryKey: ['selected-globe-weather', selectedWeatherLocation?.lat, selectedWeatherLocation?.lng],
    queryFn: () => fetchCityWeather(selectedWeatherLocation!.lat, selectedWeatherLocation!.lng),
    enabled: !!selectedWeatherLocation,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const areaPoints: GlobePoint[] = (regionWeather?.areas ?? []).map((area) => ({
    kind: 'area', lat: area.lat, lng: area.lng, area,
  }));
  const globalPoints: GlobePoint[] = globalCities
    .filter((city) => city.temperatureC !== null || city.dailyRainfallMm !== null)
    .map((city) => ({ kind: 'global-city', lat: city.lat, lng: city.lng, city }));
  const disasterPoints: GlobePoint[] = disasterEvents.map((event) => ({
    kind: 'disaster', lat: event.lat, lng: event.lng, event,
  }));
  const searchedPoint: GlobePoint | null = searchedCity
    ? { kind: 'searched', lat: searchedCity.lat, lng: searchedCity.lng, city: searchedCity }
    : null;
  const allPoints = useMemo(
    () => [...globalPoints, ...areaPoints, ...disasterPoints, ...(searchedPoint ? [searchedPoint] : [])],
    // Source arrays are derived directly from the query values above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [globalCities, regionWeather, disasterEvents, searchedCity],
  );

  useEffect(() => {
    const fallback = setTimeout(() => setReady(true), 3500);
    return () => clearTimeout(fallback);
  }, []);

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const { width } = containerRef.current.getBoundingClientRect();
      const height = window.innerWidth < 640 ? 340 : window.innerWidth < 1024 ? 420 : 500;
      setDimensions({ width, height });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (!globeRef.current) return;
    globeRef.current.pointOfView(JAKARTA_VIEW, 0);
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.enableZoom = true;
    const stopRotation = () => { controls.autoRotate = false; };
    controls.addEventListener('start', stopRotation);
    return () => controls.removeEventListener('start', stopRotation);
  }, []);

  useEffect(() => {
    if (!globeRef.current || defaultCenterLat === undefined || defaultCenterLng === undefined || searchedCity) return;
    globeRef.current.pointOfView({ lat: defaultCenterLat, lng: defaultCenterLng, altitude: JAKARTA_VIEW.altitude }, 800);
  }, [defaultCenterLat, defaultCenterLng, searchedCity]);

  useEffect(() => {
    if (!searchedCity || !globeRef.current) return;
    globeRef.current.pointOfView({ lat: searchedCity.lat, lng: searchedCity.lng, altitude: searchedIsCountry ? 0.98 : 0.58 }, 1450);
    globeRef.current.controls().autoRotate = false;
    setSelected({ kind: 'searched', lat: searchedCity.lat, lng: searchedCity.lng, city: searchedCity });
  }, [searchedCity, searchedIsCountry]);

  const handleRecenter = useCallback(() => {
    if (!globeRef.current) return;
    const center = searchedCity
      ? { lat: searchedCity.lat, lng: searchedCity.lng, altitude: searchedIsCountry ? 0.98 : 0.58 }
      : { lat: defaultCenterLat ?? JAKARTA_VIEW.lat, lng: defaultCenterLng ?? JAKARTA_VIEW.lng, altitude: JAKARTA_VIEW.altitude };
    globeRef.current.pointOfView(center, 1000);
    const controls = globeRef.current.controls();
    controls.autoRotate = !searchedCity;
    controls.autoRotateSpeed = 0.6;
  }, [searchedCity, searchedIsCountry, defaultCenterLat, defaultCenterLng]);

  const handleZoom = useCallback((pov: { lat: number; lng: number; altitude: number }) => {
    if (!onDeepZoom || hasTriggeredDeepZoom.current) return;
    if (pov.altitude < DEEP_ZOOM_ALTITUDE_THRESHOLD) {
      hasTriggeredDeepZoom.current = true;
      toast('Zoomed in close — switching to map view for a clearer look', { duration: 2500 });
      onDeepZoom(pov.lat, pov.lng);
    }
  }, [onDeepZoom]);

  return (
    <Card className="weather-panel overflow-hidden rounded-2xl">
      <div ref={containerRef} className="relative w-full bg-[#102E4A]" style={{ height: dimensions.height }}>
        {!ready && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#102E4A] text-white/70">
            <Loader2 className="w-6 h-6 animate-spin" /><p className="text-xs">Loading globe…</p>
          </div>
        )}
        <Globe
          ref={globeRef}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#102E4A"
          globeImageUrl="/globe/earth-day.jpg"
          bumpImageUrl="/globe/earth-topology.png"
          atmosphereColor="#55C1FF"
          atmosphereAltitude={0.28}
          onGlobeReady={() => setReady(true)}
          onZoom={handleZoom}
          pointsData={allPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor={(raw: object) => {
            const point = raw as GlobePoint;
            if (point.kind === 'area') return riskColors[point.area.riskLevel];
            if (point.kind === 'global-city') return riskColors[point.city.riskLevel];
            if (point.kind === 'disaster') return disasterColor(point.event.category);
            return '#eab308';
          }}
          pointAltitude={(raw: object) => (raw as GlobePoint).kind === 'searched' ? 0.03 : 0.015}
          pointRadius={(raw: object) => {
            const point = raw as GlobePoint;
            if (point.kind === 'area') return 0.11;
            if (point.kind === 'global-city') return 0.085;
            if (point.kind === 'searched') return 0.4;
            return 0.22;
          }}
          pointLabel={(raw: object) => {
            const point = raw as GlobePoint;
            if (point.kind === 'area' || point.kind === 'global-city') {
              const name = point.kind === 'area' ? point.area.name : point.city.name;
              const country = point.kind === 'area' ? point.area.country : point.city.country;
              const temperature = point.kind === 'area' ? point.area.temperatureC : point.city.temperatureC;
              const rainfall = point.kind === 'area' ? point.area.latestDailyRainfallMm : point.city.dailyRainfallMm;
              const discharge = point.kind === 'area' ? point.area.latestDischargeM3s : null;
              const high = point.kind === 'area' ? point.area.todayHighC : point.city.todayHighC;
              const low = point.kind === 'area' ? point.area.todayLowC : point.city.todayLowC;
              const condition = point.kind === 'area' ? point.area.weatherCode : point.city.weatherCode;
              const rainChance = point.kind === 'area' ? point.area.rainChancePercent : point.city.rainChancePercent;
              const wind = point.kind === 'area' ? point.area.windKph : point.city.windKph;
              const humidity = point.kind === 'area' ? point.area.humidityPercent : point.city.humidityPercent;
              return `<div style="font-family:inherit;background:rgba(15,23,42,.94);color:white;padding:7px 10px;border-radius:7px;font-size:12px;">
                <b>${escapeHtml(name)}</b><br/>${escapeHtml(country)}<br/>
                ${temperature === null ? '—' : `${Math.round(temperature)}°C`} · ${escapeHtml(weatherDescription(condition))}<br/>
                High ${high === null ? '—' : `${Math.round(high)}°C`} · Low ${low === null ? '—' : `${Math.round(low)}°C`}<br/>
                Rain today ${rainfall === null ? '—' : `${rainfall.toFixed(1)} mm`} · Chance ${rainChance === null ? '—' : `${Math.round(rainChance)}%`}<br/>
                Wind ${wind === null ? '—' : `${Math.round(wind)} km/h`} · Humidity ${humidity === null ? '—' : `${Math.round(humidity)}%`}
                ${discharge === null ? '' : `<br/>Nearby river flow ${discharge.toFixed(1)} m³/s`}
              </div>`;
            }
            if (point.kind === 'searched') {
              return `<div style="font-family:inherit;background:rgba(15,23,42,.94);color:white;padding:7px 10px;border-radius:7px;font-size:12px;"><b>${escapeHtml(point.city.name)}</b><br/>${escapeHtml(point.city.country)}</div>`;
            }
            return `<div style="font-family:inherit;background:rgba(15,23,42,.94);color:white;padding:7px 10px;border-radius:7px;font-size:12px;max-width:220px;"><b>${escapeHtml(point.event.title)}</b><br/>${escapeHtml(point.event.category)} · reported event</div>`;
          }}
          onPointClick={(raw: object) => setSelected(raw as GlobePoint)}
          ringsData={[...disasterPoints, ...(searchedPoint ? [searchedPoint] : [])]}
          ringLat="lat"
          ringLng="lng"
          ringColor={(raw: object) => {
            const point = raw as GlobePoint;
            const color = point.kind === 'searched' ? '#eab308' : point.kind === 'disaster' ? disasterColor(point.event.category) : '#ffffff';
            return (t: number) => {
              const hex = color.replace('#', '');
              const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
              return `rgba(${r},${g},${b},${1 - t})`;
            };
          }}
          ringMaxRadius={2.2}
          ringPropagationSpeed={1.8}
          ringRepeatPeriod={1400}
        />

        <Button size="icon" variant="secondary" className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 w-8 h-8 sm:w-9 sm:h-9 shadow-md" onClick={handleRecenter} aria-label="Recenter globe">
          <RotateCcw className="w-4 h-4" />
        </Button>
        <div className="absolute left-3 top-3 z-30 w-[min(24rem,calc(100%-5.5rem))]">
          <GlobeSearch selectedCity={searchedCity} selectedIsCountry={searchedIsCountry} onSelect={onSelectLocation} onReset={onResetSearch} />
        </div>
        <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-10 flex flex-col items-end gap-1">
          <div className="flex items-center gap-1.5 bg-black/55 backdrop-blur-sm border border-white/10 rounded-full px-2.5 py-1 text-[10px] sm:text-xs text-white/80">
            <Radio className="w-3 h-3 text-sky-300" />{globalCitiesLoading ? 'Loading cities around the world…' : `Weather in ${globalCities.length} cities`}
          </div>
          {!eventsErrored && disasterEvents.length > 0 && (
            <div className="flex items-center gap-1.5 bg-black/55 backdrop-blur-sm border border-white/10 rounded-full px-2.5 py-1 text-[10px] sm:text-xs text-white/80">
            <Radio className="w-3 h-3 text-purple-400" />{disasterEvents.length} reported events worldwide
            </div>
          )}
        </div>

        {selected && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-3 sm:right-auto sm:w-80 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Card className="border-2 shadow-xl"><CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <h3 className="font-semibold text-sm sm:text-base text-foreground leading-snug">{selected.kind === 'area' ? selected.area.name : selected.kind === 'global-city' ? selected.city.name : selected.kind === 'searched' ? selected.city.name : selected.event.title}</h3>
                  {(selected.kind === 'area' || selected.kind === 'global-city') && <p className="text-xs text-muted-foreground">{selected.kind === 'area' ? `${selected.area.admin1 ? `${selected.area.admin1}, ` : ''}${selected.area.country}` : `${selected.city.admin1 ? `${selected.city.admin1}, ` : ''}${selected.city.country}`}</p>}
                  {selected.kind === 'searched' && <p className="text-xs text-muted-foreground">{selected.city.name.toLowerCase() === selected.city.country.toLowerCase() ? 'Country overview' : getRegionLabel(selected.city)}</p>}
                </div>
                {(selected.kind === 'area' || selected.kind === 'global-city') && <RiskBadge level={selected.kind === 'area' ? selected.area.riskLevel : selected.city.riskLevel} showIcon={false} />}
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground transition-colors shrink-0" aria-label="Close"><X className="w-4 h-4" /></button>
              </div>
              {(selected.kind === 'area' || selected.kind === 'global-city' || selected.kind === 'searched') && (
                <div className="mt-2">
                  {selectedWeatherLoading ? <div className="flex items-center gap-2 py-3 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading local weather…</div>
                    : selectedWeather ? <WeatherSummary weather={selectedWeather} compact />
                      : <p className="py-2 text-xs text-muted-foreground">{selectedWeatherErrored ? 'Weather details are temporarily unavailable.' : 'Weather details unavailable.'}</p>}
                  {selected.kind === 'area' && selected.area.latestDischargeM3s !== null && <p className="mt-2 text-xs text-muted-foreground">Nearby river flow: <strong className="text-foreground">{selected.area.latestDischargeM3s.toFixed(1)} m³/s</strong></p>}
                </div>
              )}
              {selected.kind === 'disaster' && <>
                <div className="flex items-center gap-2 mb-2"><span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: disasterColor(selected.event.category) }}>{selected.event.category}</span><span className="text-xs text-foreground/60">{formatDistanceToNow(new Date(selected.event.date), { addSuffix: true })}</span></div>
                {selected.event.link && <Button size="sm" variant="outline" className="w-full gap-1.5" asChild><a href={selected.event.link} target="_blank" rel="noopener noreferrer">View event report <ExternalLink className="w-3.5 h-3.5" /></a></Button>}
              </>}
            </CardContent></Card>
          </div>
        )}
      </div>

      <CardContent className="p-3 sm:p-4 bg-muted/40 border-t">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs sm:text-sm">
          {([['safe', 'Low rain · under 20 mm'], ['medium', 'Rain watch · 20–49 mm'], ['high', 'Heavy rain · 50 mm or more']] as const).map(([risk, label]) => (
            <div key={risk} className="flex items-center gap-2"><div className="w-3 h-3 rounded-full ring-4" style={{ backgroundColor: riskColors[risk], boxShadow: `0 0 0 4px ${riskColors[risk]}25` }} /><span className="text-muted-foreground">{label}</span></div>
          ))}
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-purple-500 ring-4 ring-purple-500/15" /><span className="text-muted-foreground">Reported floods and storms</span></div>
        </div>
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground mt-3">
          Weather values are estimates · Events are reported · Local area: {regionLabel}.
        </p>
      </CardContent>
    </Card>
  );
};
