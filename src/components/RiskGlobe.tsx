import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Globe, { GlobeMethods } from 'react-globe.gl';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RiskBadge } from '@/components/RiskBadge';
import { jakartaDistricts } from '@/data/mockData';
import { fetchFloodStormEvents, EonetEvent } from '@/lib/eonet';
import { fetchCityWeather, CitySearchResult } from '@/lib/openMeteo';
import { DistrictData } from '@/types/flood';
import { formatDistanceToNow } from 'date-fns';
import { X, Droplets, Waves, Loader2, RotateCcw, Radio, ExternalLink, Thermometer } from 'lucide-react';

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

const hexToRgba = (hex: string, alpha: number) => {
  const bigint = parseInt(hex.replace('#', ''), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const JAKARTA_VIEW = { lat: -6.2, lng: 106.85, altitude: 1.7 };

type GlobePoint =
  | { kind: 'district'; lat: number; lng: number; district: DistrictData }
  | { kind: 'disaster'; lat: number; lng: number; event: EonetEvent }
  | { kind: 'searched'; lat: number; lng: number; city: CitySearchResult };

interface RiskGlobeProps {
  searchedCity?: CitySearchResult | null;
}

export const RiskGlobe = ({ searchedCity }: RiskGlobeProps) => {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [dimensions, setDimensions] = useState({ width: 300, height: 460 });
  const [ready, setReady] = useState(false);
  const [selected, setSelected] = useState<GlobePoint | null>(null);

  const { data: disasterEvents = [], isError: eventsErrored } = useQuery({
    queryKey: ['eonet-flood-storm-events'],
    queryFn: fetchFloodStormEvents,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });

  const { data: searchedWeather, isLoading: weatherLoading } = useQuery({
    queryKey: ['city-weather', searchedCity?.id],
    queryFn: () => fetchCityWeather(searchedCity!.lat, searchedCity!.lng),
    enabled: !!searchedCity,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  const districtPoints: GlobePoint[] = jakartaDistricts.map((d) => ({
    kind: 'district',
    lat: d.coordinates[0],
    lng: d.coordinates[1],
    district: d,
  }));

  const disasterPoints: GlobePoint[] = disasterEvents.map((e) => ({
    kind: 'disaster',
    lat: e.lat,
    lng: e.lng,
    event: e,
  }));

  const searchedPoint: GlobePoint | null = searchedCity
    ? { kind: 'searched', lat: searchedCity.lat, lng: searchedCity.lng, city: searchedCity }
    : null;

  const allPoints = useMemo(
    () => [...districtPoints, ...disasterPoints, ...(searchedPoint ? [searchedPoint] : [])],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [disasterEvents, searchedCity]
  );

  // Fallback: three-globe's texture loader has no error handler, so if the
  // globe/bump image ever fails to load (flaky network, ad-blocker, CDN
  // hiccup), onGlobeReady never fires. Don't let the UI hang forever —
  // reveal the (still-interactive) globe after a short wait regardless.
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

  // Initial camera position + gentle auto-rotate until the user interacts
  useEffect(() => {
    if (!ready || !globeRef.current) return;
    globeRef.current.pointOfView(JAKARTA_VIEW, 0);
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.enableZoom = true;

    const stopRotation = () => {
      controls.autoRotate = false;
    };
    controls.addEventListener('start', stopRotation);
    return () => controls.removeEventListener('start', stopRotation);
  }, [ready]);

  // Fly to a searched city and open its info panel automatically
  useEffect(() => {
    if (!searchedCity || !ready || !globeRef.current) return;
    globeRef.current.pointOfView({ lat: searchedCity.lat, lng: searchedCity.lng, altitude: 1.4 }, 1200);
    const controls = globeRef.current.controls();
    controls.autoRotate = false;
    setSelected({ kind: 'searched', lat: searchedCity.lat, lng: searchedCity.lng, city: searchedCity });
  }, [searchedCity, ready]);

  const handleRecenter = useCallback(() => {
    if (!globeRef.current) return;
    globeRef.current.pointOfView(JAKARTA_VIEW, 1000);
    const controls = globeRef.current.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
  }, []);

  return (
    <Card className="overflow-hidden">
      <div ref={containerRef} className="relative w-full bg-[#0a1128]" style={{ height: dimensions.height }}>
        {!ready && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#0a1128] text-white/70">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-xs">Loading globe…</p>
          </div>
        )}

        <Globe
          ref={globeRef as any}
          width={dimensions.width}
          height={dimensions.height}
          backgroundColor="#0a1128"
          globeImageUrl="/globe/earth-day.jpg"
          bumpImageUrl="/globe/earth-topology.png"
          atmosphereColor="#7dd3fc"
          atmosphereAltitude={0.28}
          onGlobeReady={() => setReady(true)}
          pointsData={allPoints}
          pointLat="lat"
          pointLng="lng"
          pointColor={(p: any) => {
            const point = p as GlobePoint;
            if (point.kind === 'district') return riskColors[point.district.riskLevel];
            if (point.kind === 'disaster') return disasterColor(point.event.category);
            return '#eab308'; // searched city marker
          }}
          pointAltitude={(p: any) => ((p as GlobePoint).kind === 'searched' ? 0.03 : 0.02)}
          pointRadius={(p: any) => {
            const point = p as GlobePoint;
            if (point.kind === 'district') return 0.35 + point.district.rainfall / 150;
            if (point.kind === 'searched') return 0.55;
            return 0.3;
          }}
          pointLabel={(p: any) => {
            const point = p as GlobePoint;
            if (point.kind === 'district') {
              const d = point.district;
              return `<div style="font-family:inherit;background:rgba(15,23,42,0.9);color:white;padding:6px 10px;border-radius:6px;font-size:12px;">
                <b>${d.name}</b><br/>${d.rainfall}mm rainfall · ${d.waterLevel}cm water
              </div>`;
            }
            if (point.kind === 'searched') {
              return `<div style="font-family:inherit;background:rgba(15,23,42,0.9);color:white;padding:6px 10px;border-radius:6px;font-size:12px;">
                <b>${point.city.name}</b><br/>${point.city.country}
              </div>`;
            }
            const e = point.event;
            return `<div style="font-family:inherit;background:rgba(15,23,42,0.9);color:white;padding:6px 10px;border-radius:6px;font-size:12px;max-width:220px;">
              <b>${e.title}</b><br/>${e.category} · NASA EONET
            </div>`;
          }}
          onPointClick={(p: any) => setSelected(p as GlobePoint)}
          ringsData={[...disasterPoints, ...(searchedPoint ? [searchedPoint] : [])]}
          ringLat="lat"
          ringLng="lng"
          ringColor={(p: any) => {
            const point = p as GlobePoint;
            const color = point.kind === 'searched' ? '#eab308' : disasterColor((point as any).event.category);
            return (t: number) => hexToRgba(color, 1 - t);
          }}
          ringMaxRadius={2.2}
          ringPropagationSpeed={1.8}
          ringRepeatPeriod={1400}
        />

        {/* Recenter control */}
        <Button
          size="icon"
          variant="secondary"
          className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 w-8 h-8 sm:w-9 sm:h-9 shadow-md"
          onClick={handleRecenter}
          aria-label="Recenter globe on Jakarta"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>

        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10 bg-black/50 backdrop-blur-sm border border-white/10 rounded-lg px-2.5 py-1 text-[11px] sm:text-xs text-white/80">
          Drag to rotate · Scroll to zoom · Click a point for details
        </div>

        {!eventsErrored && disasterEvents.length > 0 && (
          <div className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3 z-10 flex items-center gap-1.5 bg-black/50 backdrop-blur-sm border border-white/10 rounded-full px-2.5 py-1 text-[11px] sm:text-xs text-white/80">
            <Radio className="w-3 h-3 text-purple-400" />
            {disasterEvents.length} live events · NASA EONET
          </div>
        )}

        {/* Selected point info panel */}
        {selected && (
          <div className="absolute bottom-3 left-3 right-3 sm:left-3 sm:right-auto sm:w-80 z-20 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <Card className="border-2 shadow-xl">
              <CardContent className="p-4">
                {selected.kind === 'district' && (
                  <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm sm:text-base text-foreground">{selected.district.name}</h3>
                      <div className="flex items-center gap-1.5">
                        <RiskBadge level={selected.district.riskLevel} showIcon={false} />
                        <button
                          onClick={() => setSelected(null)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Close"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs sm:text-sm text-foreground/70 mb-3">
                      <span className="flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5" />
                        {selected.district.rainfall}mm
                      </span>
                      <span className="flex items-center gap-1">
                        <Waves className="w-3.5 h-3.5" />
                        {selected.district.waterLevel}cm
                      </span>
                    </div>
                    <Button size="sm" className="w-full" onClick={() => navigate(`/district/${selected.district.id}`)}>
                      View full details →
                    </Button>
                  </>
                )}

                {selected.kind === 'disaster' && (
                  <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-sm sm:text-base text-foreground leading-snug pr-2">
                        {selected.event.title}
                      </h3>
                      <button
                        onClick={() => setSelected(null)}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        aria-label="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: disasterColor(selected.event.category) }}
                      >
                        {selected.event.category}
                      </span>
                      <span className="text-xs text-foreground/60">
                        {formatDistanceToNow(new Date(selected.event.date), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/60 mb-3">Live event data from NASA EONET</p>
                    {selected.event.link && (
                      <Button size="sm" variant="outline" className="w-full gap-1.5" asChild>
                        <a href={selected.event.link} target="_blank" rel="noopener noreferrer">
                          View source on NASA <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </Button>
                    )}
                  </>
                )}

                {selected.kind === 'searched' && (
                  <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="font-semibold text-sm sm:text-base text-foreground">{selected.city.name}</h3>
                        <p className="text-xs text-foreground/60">
                          {selected.city.admin1 ? `${selected.city.admin1}, ` : ''}
                          {selected.city.country}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelected(null)}
                        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        aria-label="Close"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {weatherLoading ? (
                      <div className="flex items-center gap-2 text-xs text-foreground/60 py-2">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Fetching live weather…
                      </div>
                    ) : searchedWeather ? (
                      <div className="flex items-center gap-4 text-xs sm:text-sm text-foreground/70 mb-3">
                        <span className="flex items-center gap-1">
                          <Droplets className="w-3.5 h-3.5" />
                          {searchedWeather.rainfallTodayMm}mm today
                        </span>
                        <span className="flex items-center gap-1">
                          <Thermometer className="w-3.5 h-3.5" />
                          {Math.round(searchedWeather.tempC)}°C
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-foreground/60 mb-3">Live weather unavailable right now.</p>
                    )}
                    <p className="text-[11px] text-foreground/50">Live data from Open-Meteo</p>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      <CardContent className="p-3 sm:p-4 bg-muted/40 border-t">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:gap-x-6 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-risk-safe ring-4 ring-risk-safe/15" />
            <span className="whitespace-nowrap text-muted-foreground">Low <span className="text-foreground/70">(&lt;20mm)</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-risk-medium ring-4 ring-risk-medium/15" />
            <span className="whitespace-nowrap text-muted-foreground">Medium <span className="text-foreground/70">(20–50mm)</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-risk-high ring-4 ring-risk-high/15" />
            <span className="whitespace-nowrap text-muted-foreground">High <span className="text-foreground/70">(&gt;50mm)</span></span>
          </div>
          <div className="w-px h-4 bg-border hidden sm:block" />
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full" style={{ backgroundColor: disasterColors.Floods }} />
            <span className="whitespace-nowrap text-muted-foreground">Flood <span className="text-foreground/70">(live)</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full" style={{ backgroundColor: disasterColors['Severe Storms'] }} />
            <span className="whitespace-nowrap text-muted-foreground">Storm <span className="text-foreground/70">(live)</span></span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-yellow-500" />
            <span className="whitespace-nowrap text-muted-foreground">Searched city</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
