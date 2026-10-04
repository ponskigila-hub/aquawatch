import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Anchor, ArrowDownToLine, Compass, Globe2, Map, MapPin, RefreshCw, Thermometer, Timer, Waves } from 'lucide-react';
import { FeaturePageLayout } from '@/components/FeaturePageLayout';
import { CitySearch } from '@/components/CitySearch';
import { EnvironmentalMap, type EnvironmentalPoint } from '@/components/EnvironmentalMap';
import { OceanGlobe } from '@/components/OceanGlobe';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { fetchGlobalMarineConditions, fetchMarinePointForecast, fetchOisstAt, type MarinePoint, type OisstPoint } from '@/lib/environmentalLayers';
import { buildMarineHeatmap, buildOceanFlowPaths, type MarineVisualMetric } from '@/lib/marineVisuals';
import type { CitySearchResult } from '@/lib/openMeteo';
import { useUserLocation } from '@/hooks/useUserLocation';

type OceanMetric = 'waveHeightM' | 'swellHeightM' | 'currentKmh' | 'seaSurfaceC' | 'anomalyC';
type OceanPoint = MarinePoint & Pick<OisstPoint, 'seaSurfaceC' | 'anomalyC'> & { sstTime: string | null };
type MapMode = '2d' | '3d';
type LocationChoice = { id: string; name: string; lat: number; lng: number };

const oceanMetrics: Array<{ key: OceanMetric; label: string; unit: string }> = [
  { key: 'waveHeightM', label: 'Wave height', unit: 'm' },
  { key: 'swellHeightM', label: 'Swell height', unit: 'm' },
  { key: 'currentKmh', label: 'Current speed', unit: 'km/h' },
  { key: 'seaSurfaceC', label: 'Sea-surface temperature', unit: '°C' },
  { key: 'anomalyC', label: 'SST anomaly', unit: '°C' },
];

const presets = [6, 12, 24, 72];
const hourValue = (point: MarinePoint, key: 'waveHeightM' | 'swellHeightM' | 'currentKmh' | 'wavePeriodS' | 'currentDirectionDeg' | 'swellDirectionDeg', hour: number): number | null => {
  const selectedHour = point.forecast[Math.min(Math.max(0, hour), Math.max(0, point.forecast.length - 1))];
  return selectedHour?.[key] ?? point[key];
};

function valueAt(point: OceanPoint, metric: OceanMetric, hour: number): number | null {
  if (metric === 'seaSurfaceC') return point.seaSurfaceC;
  if (metric === 'anomalyC') return point.anomalyC;
  return hourValue(point, metric, hour);
}

function colorFor(value: number | null, metric: OceanMetric): string {
  if (value === null) return '#94A3B8';
  if (metric === 'anomalyC') return value <= -1.5 ? '#55C1FF' : value < -0.5 ? '#5887FF' : value < 0.5 ? '#A682FF' : value < 1.5 ? '#F8D252' : value < 2.5 ? '#F28C44' : '#DC4256';
  if (metric === 'seaSurfaceC') return value < 8 ? '#102E4A' : value < 16 ? '#5887FF' : value < 22 ? '#55C1FF' : value < 26 ? '#F8D252' : value < 30 ? '#F28C44' : '#DC4256';
  if (metric === 'currentKmh') return value < 0.5 ? '#55C1FF' : value < 1.5 ? '#48C6A3' : value < 3 ? '#F3D453' : value < 5 ? '#F28C44' : '#DC4256';
  return value < 2 ? '#55C1FF' : value < 4 ? '#48C6A3' : value < 6 ? '#F3D453' : value < 8 ? '#F28C44' : '#DC4256';
}

function displayValue(value: number | null, metric: OceanMetric): string {
  if (value === null) return 'No reading';
  const unit = oceanMetrics.find((item) => item.key === metric)?.unit ?? '';
  return `${metric === 'anomalyC' && value > 0 ? '+' : ''}${value.toFixed(1)} ${unit}`;
}

function formatTime(value: string | null | undefined): string {
  if (!value) return 'Not reported';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} UTC`;
}

function getBasinName(lng: number): string {
  if (lng < -70 || lng > 130) return 'Pacific Ocean';
  if (lng < 15) return 'Atlantic Ocean';
  return 'Indian Ocean';
}

function Sparkline({ values, color = '#5887FF' }: { values: Array<number | null>; color?: string }) {
  const clean = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (clean.length < 2) return <span className="text-[10px] text-muted-foreground">Trend unavailable</span>;
  const min = Math.min(...clean);
  const range = Math.max(0.1, Math.max(...clean) - min);
  const points = values.flatMap((value, index) => value === null ? [] : [[
    (index / Math.max(1, values.length - 1)) * 72,
    23 - ((value - min) / range) * 20,
  ] as [number, number]]);
  const path = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  return <svg width="76" height="28" viewBox="0 0 72 26" role="img" aria-label={`${clean.length}-point trend`} className="overflow-visible">
    <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    {points.length > 0 && <circle cx={points[points.length - 1][0]} cy={points[points.length - 1][1]} r="2.2" fill={color} />}
  </svg>;
}

function legendFor(metric: OceanMetric) {
  if (metric === 'anomalyC') return { title: 'Daily SST anomaly', min: '−3 °C', max: '+3 °C', gradient: 'linear-gradient(90deg,#55C1FF,#5887FF,#A682FF,#F8D252,#F28C44,#DC4256)' };
  if (metric === 'seaSurfaceC') return { title: 'Sea-surface temperature', min: '0 °C', max: '32 °C+', gradient: 'linear-gradient(90deg,#102E4A,#5887FF,#55C1FF,#F8D252,#F28C44,#DC4256)' };
  if (metric === 'currentKmh') return { title: 'Current speed', min: '0 km/h', max: '5+ km/h', gradient: 'linear-gradient(90deg,#55C1FF,#48C6A3,#F3D453,#F28C44,#DC4256)' };
  return { title: metric === 'swellHeightM' ? 'Swell height' : 'Wave height', min: '0 m', max: '10+ m', gradient: 'linear-gradient(90deg,#55C1FF,#48C6A3,#F3D453,#F28C44,#DC4256)' };
}

function exportSnapshot(points: OceanPoint[], hour: number) {
  return points.map((point) => {
    const forecast = point.forecast[Math.min(hour, Math.max(0, point.forecast.length - 1))];
    return {
      name: point.name,
      latitude: point.lat,
      longitude: point.lng,
      marine_forecast_time_utc: forecast?.time ?? point.time,
      wave_height_m: forecast?.waveHeightM ?? point.waveHeightM,
      wave_direction_from_deg: forecast?.waveDirectionDeg ?? point.waveDirectionDeg,
      swell_height_m: forecast?.swellHeightM ?? point.swellHeightM,
      swell_direction_from_deg: forecast?.swellDirectionDeg ?? point.swellDirectionDeg,
      current_speed_kmh: forecast?.currentKmh ?? point.currentKmh,
      current_direction_toward_deg: forecast?.currentDirectionDeg ?? point.currentDirectionDeg,
      wave_period_s: forecast?.wavePeriodS ?? point.wavePeriodS,
      sea_surface_temperature_c: point.seaSurfaceC,
      sst_anomaly_c: point.anomalyC,
      sst_analysis_time_utc: point.sstTime,
      marine_source: 'Open-Meteo Marine model forecast',
      sst_source: 'NOAA NCEI OISST v2.1 daily analysis',
    };
  });
}

function downloadFile(name: string, content: string, mime: string) {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const OceanPage = () => {
  const { location: userPosition } = useUserLocation();
  const userLat = userPosition?.lat;
  const userLng = userPosition?.lng;
  const [metric, setMetric] = useState<OceanMetric>('waveHeightM');
  const [mapMode, setMapMode] = useState<MapMode>('2d');
  const [forecastHour, setForecastHour] = useState(0);
  const [location, setLocation] = useState<LocationChoice | null>(null);
  const [mapCenter, setMapCenter] = useState({ lat: -6.2088, lng: 106.8456 });
  const [latitudeInput, setLatitudeInput] = useState('');
  const [longitudeInput, setLongitudeInput] = useState('');

  const marineQuery = useQuery({ queryKey: ['global-marine-forecast-seven-days'], queryFn: fetchGlobalMarineConditions, staleTime: 20 * 60 * 1000, refetchInterval: 30 * 60 * 1000, retry: 1 });

  const marineData = useMemo(() => marineQuery.data ?? [], [marineQuery.data]);
  const oceanData = useMemo<OceanPoint[]>(() => marineData.map((point) => {
    return { ...point, seaSurfaceC: null, anomalyC: null, sstTime: null };
  }), [marineData]);
  useEffect(() => {
    if (!location && userLat !== undefined && userLng !== undefined) setMapCenter({ lat: userLat, lng: userLng });
  }, [location, userLat, userLng]);

  const selectedChoice = useMemo(() => {
    if (location) return location;
    if (!oceanData.length) return null;
    if (userLat === undefined || userLng === undefined) return { id: oceanData[0].id, name: oceanData[0].name, lat: oceanData[0].lat, lng: oceanData[0].lng };
    const nearest = oceanData.reduce((best, point) => {
      const distance = (candidate: OceanPoint) => {
        const longitudeDelta = ((candidate.lng - userLng + 540) % 360) - 180;
        return (candidate.lat - userLat) ** 2 + (longitudeDelta * Math.cos(userLat * Math.PI / 180)) ** 2;
      };
      return distance(point) < distance(best) ? point : best;
    });
    return { id: nearest.id, name: nearest.name, lat: nearest.lat, lng: nearest.lng };
  }, [location, oceanData, userLat, userLng]);
  const selectedGridPoint = selectedChoice ? oceanData.find((point) => point.id === selectedChoice.id) ?? null : null;
  const extraQuery = useQuery({
    queryKey: ['ocean-selected-detail', selectedChoice?.id, selectedChoice?.lat, selectedChoice?.lng],
    queryFn: async () => {
      const gridPoint = marineData.find((point) => point.id === selectedChoice?.id);
      const [marine, sst] = await Promise.all([
        gridPoint ? Promise.resolve(gridPoint) : fetchMarinePointForecast(selectedChoice!.lat, selectedChoice!.lng, selectedChoice!.name),
        fetchOisstAt(selectedChoice!.lat, selectedChoice!.lng),
      ]);
      return { marine, sst };
    },
    enabled: Boolean(selectedChoice),
    staleTime: 20 * 60 * 1000,
    retry: 1,
  });
  const selectedSst = extraQuery.data?.sst ?? null;
  const selectedMarine = selectedGridPoint ?? extraQuery.data?.marine ?? null;
  const selectedOcean = useMemo<OceanPoint | null>(() => selectedMarine ? {
    ...selectedMarine,
    seaSurfaceC: selectedSst?.seaSurfaceC ?? null,
    anomalyC: selectedSst?.anomalyC ?? null,
    sstTime: selectedSst?.time ?? null,
  } : null, [selectedMarine, selectedSst]);

  const marineRasterMetric = metric === 'waveHeightM' || metric === 'swellHeightM' || metric === 'currentKmh';
  const rasterSamples = useMemo(() => marineData.map((point) => ({ lat: point.lat, lng: point.lng, value: metric === 'currentKmh' ? hourValue(point, 'currentKmh', forecastHour) : metric === 'swellHeightM' ? hourValue(point, 'swellHeightM', forecastHour) : hourValue(point, 'waveHeightM', forecastHour) })), [marineData, metric, forecastHour]);
  const heatmapQuery = useQuery({
    queryKey: ['ocean-interpolated-raster', metric, forecastHour, marineQuery.dataUpdatedAt],
    queryFn: () => buildMarineHeatmap(rasterSamples, metric as MarineVisualMetric),
    enabled: marineRasterMetric && marineData.length > 0,
    staleTime: 60 * 60 * 1000,
    retry: 0,
  });

  const mapPoints = useMemo<EnvironmentalPoint[]>(() => {
    const base = oceanData.flatMap((point) => {
      const activePoint = selectedOcean?.id === point.id ? { ...point, seaSurfaceC: selectedOcean.seaSurfaceC, anomalyC: selectedOcean.anomalyC, sstTime: selectedOcean.sstTime } : point;
      const value = valueAt(activePoint, metric, forecastHour);
      if ((metric === 'anomalyC' || metric === 'seaSurfaceC') && value === null) return [];
      const forecast = activePoint.forecast[Math.min(forecastHour, activePoint.forecast.length - 1)];
      const detail = `Wave ${forecast?.waveHeightM?.toFixed(1) ?? '—'} m · Swell ${forecast?.swellHeightM?.toFixed(1) ?? '—'} m · Current ${forecast?.currentKmh?.toFixed(1) ?? '—'} km/h`;
      return [{ id: point.id, lat: point.lat, lng: point.lng, label: point.name, detail, value: displayValue(value, metric), color: colorFor(value, metric), radius: 8 }];
    });
    if (location && !marineData.some((point) => point.id === location.id)) {
      const value = selectedOcean ? valueAt(selectedOcean, metric, forecastHour) : null;
      base.push({ id: location.id, lat: location.lat, lng: location.lng, label: location.name, detail: selectedOcean ? `Wave ${hourValue(selectedOcean, 'waveHeightM', forecastHour)?.toFixed(1) ?? '—'} m · Current ${hourValue(selectedOcean, 'currentKmh', forecastHour)?.toFixed(1) ?? '—'} km/h` : 'Loading marine forecast…', value: selectedOcean ? displayValue(value, metric) : 'Loading…', color: selectedOcean ? colorFor(value, metric) : '#A682FF', radius: 10 });
    }
    return base;
  }, [oceanData, metric, forecastHour, location, marineData, selectedOcean]);

  const flowPaths = useMemo(() => metric === 'currentKmh' || metric === 'swellHeightM'
    ? buildOceanFlowPaths(marineData, metric, forecastHour)
    : [], [marineData, metric, forecastHour]);
  const rasterUrl = metric === 'anomalyC'
    ? '/api/ocean/oisst/raster?metric=anomaly'
    : metric === 'seaSurfaceC'
      ? '/api/ocean/oisst/raster?metric=sst'
      : heatmapQuery.data ?? null;
  const legend = legendFor(metric);
  const refreshing = marineQuery.isFetching || extraQuery.isFetching;
  const selectedForecast = selectedOcean?.forecast[Math.min(forecastHour, Math.max(0, (selectedOcean?.forecast.length ?? 1) - 1))];
  const forecastTime = selectedForecast?.time ?? selectedOcean?.time;
  const timeLabel = forecastHour === 0 ? 'Now' : `+${forecastHour} hours`;

  const chooseLocation = (choice: LocationChoice) => {
    setLocation(choice);
    setMapCenter({ lat: choice.lat, lng: choice.lng });
  };
  const handleCitySelect = (city: CitySearchResult) => chooseLocation({ id: 'pinned-location', name: `${city.name}, ${city.country}`, lat: city.lat, lng: city.lng });
  const handleCoordinateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const lat = Number(latitudeInput);
    const lng = Number(longitudeInput);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -89.8 || lat > 89.8 || lng < -180 || lng > 180) return;
    chooseLocation({ id: 'pinned-location', name: `Pinned location · ${lat.toFixed(2)}, ${lng.toFixed(2)}`, lat, lng });
  };
  const handleMapPin = ({ lat, lng }: { lat: number; lng: number }) => chooseLocation({ id: 'pinned-location', name: `Pinned location · ${lat.toFixed(2)}, ${lng.toFixed(2)}`, lat, lng });
  const handleMarkerClick = (point: EnvironmentalPoint) => chooseLocation({ id: point.id, name: point.label, lat: point.lat, lng: point.lng });
  const handleRefresh = () => {
    void marineQuery.refetch();
    if (selectedChoice) void extraQuery.refetch();
  };

  const currentWave = selectedOcean ? hourValue(selectedOcean, 'waveHeightM', forecastHour) : null;
  const currentSwell = selectedOcean ? hourValue(selectedOcean, 'swellHeightM', forecastHour) : null;
  const currentFlow = selectedOcean ? hourValue(selectedOcean, 'currentKmh', forecastHour) : null;
  const waveTrend = selectedOcean ? selectedOcean.forecast.filter((_, index) => index % 6 === 0).map((hour) => hour.waveHeightM) : [];
  const swellTrend = selectedOcean ? selectedOcean.forecast.filter((_, index) => index % 6 === 0).map((hour) => hour.swellHeightM) : [];
  const currentTrend = selectedOcean ? selectedOcean.forecast.filter((_, index) => index % 6 === 0).map((hour) => hour.currentKmh) : [];

  const exportRows = useMemo(() => {
    const exportCenter = location ?? (userLat !== undefined && userLng !== undefined ? { lat: userLat, lng: userLng } : null);
    if (!exportCenter) return oceanData;
    const nearby = oceanData.filter((point) => {
      const longitudeDelta = Math.abs(((point.lng - exportCenter.lng + 540) % 360) - 180);
      return Math.abs(point.lat - exportCenter.lat) <= 30 && longitudeDelta <= 30;
    });
    if (selectedOcean && !nearby.some((point) => point.id === selectedOcean.id)) nearby.push(selectedOcean);
    return nearby.length ? nearby : selectedOcean ? [selectedOcean] : oceanData;
  }, [location, oceanData, selectedOcean, userLat, userLng]);

  const exportData = (format: 'geojson' | 'csv') => {
    const rows = exportSnapshot(exportRows, forecastHour);
    const timeTag = new Date().toISOString().slice(0, 10);
    if (format === 'geojson') {
      const collection = {
        type: 'FeatureCollection',
        features: exportRows.map((point, index) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [point.lng, point.lat] },
          properties: rows[index],
        })),
      };
      downloadFile(`aquawatch-marine-region-${timeTag}.geojson`, JSON.stringify(collection, null, 2), 'application/geo+json');
      return;
    }
    const headers = Object.keys(rows[0] ?? {});
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => {
      const value = row[header as keyof typeof row];
      const text = value === null || value === undefined ? '' : String(value);
      return `"${text.replace(/"/g, '""')}"`;
    }).join(','))].join('\n');
    downloadFile(`aquawatch-marine-region-${timeTag}.csv`, csv, 'text/csv;charset=utf-8');
  };

  const statusBadges: Array<{ label: string; note: string; tone: string }> = [];
  if (selectedOcean?.anomalyC !== null && selectedOcean?.anomalyC !== undefined && selectedOcean.anomalyC >= 1.5) {
    statusBadges.push({ label: 'Moderate Marine Heatwave Alert', note: `Daily anomaly +${selectedOcean.anomalyC.toFixed(1)} °C · informational threshold only`, tone: 'border-orange-400/40 bg-orange-500/10 text-orange-700 dark:text-orange-300' });
  }
  if ((currentSwell ?? 0) >= 4 || (currentWave ?? 0) >= 6) {
    statusBadges.push({ label: 'High Swell Risk', note: `Model forecast · ${currentSwell?.toFixed(1) ?? '—'} m swell`, tone: 'border-red-400/40 bg-red-500/10 text-red-700 dark:text-red-300' });
  }

  const marineRegion = oceanData.slice(0, 12);
  const mapView = mapMode === '2d'
    ? <EnvironmentalMap points={mapPoints} paths={flowPaths} rasterUrl={rasterUrl} rasterOpacity={0.78} height={500} center={mapCenter} zoom={location || userPosition ? 4.5 : 2} onMapClick={handleMapPin} onPointClick={handleMarkerClick} emptyLabel="No marine data is available right now." />
    : <OceanGlobe points={mapPoints} paths={flowPaths} center={location ?? userPosition ?? selectedChoice ?? mapCenter} zoomed={Boolean(location)} onPointClick={handleMarkerClick} onGlobeClick={handleMapPin} />;

  return <FeaturePageLayout eyebrow="Marine & ocean" title="Ocean conditions" description="Explore global marine forecasts beside NOAA’s daily gridded sea-surface temperature analysis.">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(310px,0.65fr)]">
      <section className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold">Global marine map</h2><p className="text-sm text-muted-foreground">{oceanData.length || 56} ocean model locations · up to seven days ahead</p></div>
          <Button variant="outline" size="sm" className="gap-2" onClick={handleRefresh} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>

        <Card className="weather-panel"><CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border bg-background/70 p-1" aria-label="Map view mode">
              <Button variant={mapMode === '2d' ? 'default' : 'ghost'} size="sm" className="gap-1.5" onClick={() => setMapMode('2d')}><Map className="h-4 w-4" />2D map</Button>
              <Button variant={mapMode === '3d' ? 'default' : 'ghost'} size="sm" className="gap-1.5" onClick={() => setMapMode('3d')}><Globe2 className="h-4 w-4" />3D globe</Button>
            </div>
            <div className="flex flex-wrap gap-1.5">{oceanMetrics.map((item) => <Button key={item.key} variant={metric === item.key ? 'default' : 'outline'} size="sm" onClick={() => setMetric(item.key)}>{item.label}</Button>)}</div>
          </div>

          <div className="grid gap-2 lg:grid-cols-[minmax(200px,1fr)_minmax(220px,1fr)_auto]">
            <CitySearch onSelect={handleCitySelect} placeholder="Search a city or port…" />
            <select aria-label="Jump to an ocean basin" className="h-10 rounded-md border bg-background px-3 text-sm" value={location && marineRegion.some((point) => point.id === location.id) ? location.id : ''} onChange={(event) => { const point = marineData.find((item) => item.id === event.target.value); if (point) handleMarkerClick({ id: point.id, lat: point.lat, lng: point.lng, label: point.name, color: '#5887FF', radius: 8 }); }}>
              <option value="">Jump to an ocean basin…</option>{marineRegion.map((point) => <option key={point.id} value={point.id}>{point.name}</option>)}
            </select>
            <form className="flex gap-1.5" onSubmit={handleCoordinateSubmit} aria-label="Pin by coordinates">
              <Input className="h-10 w-[82px]" type="number" step="any" min="-89.8" max="89.8" placeholder="Lat" value={latitudeInput} onChange={(event) => setLatitudeInput(event.target.value)} aria-label="Latitude" />
              <Input className="h-10 w-[88px]" type="number" step="any" min="-180" max="180" placeholder="Long" value={longitudeInput} onChange={(event) => setLongitudeInput(event.target.value)} aria-label="Longitude" />
              <Button type="submit" size="sm" variant="outline" className="gap-1 px-2" aria-label="Pin coordinates"><MapPin className="h-4 w-4" />Go</Button>
            </form>
          </div>

          {marineQuery.isLoading ? <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">Loading seven-day wave, swell, and current forecasts…</CardContent></Card>
            : marineQuery.isError ? <Card><CardContent className="p-6 text-sm text-muted-foreground">Global marine data is temporarily unavailable. Try refresh in a moment.</CardContent></Card>
              : <div className="relative overflow-hidden rounded-2xl border bg-[#102E4A]">
                {mapView}
                <div className="pointer-events-none absolute bottom-3 left-3 z-[650] w-[min(290px,80%)] rounded-xl border border-white/20 bg-[#102E4A]/90 p-3 text-white shadow-xl backdrop-blur">
                  <p className="mb-1 text-[11px] font-semibold tracking-wide text-white/90">{legend.title}</p>
                  <div className="h-2.5 rounded-full" style={{ background: legend.gradient }} />
                  <div className="mt-1 flex justify-between text-[10px] text-white/80"><span>{legend.min}</span><span>{legend.max}</span></div>
                </div>
                {marineRasterMetric && heatmapQuery.isFetching && <div className="pointer-events-none absolute right-3 top-3 z-[650] rounded-lg bg-[#102E4A]/90 px-2.5 py-1.5 text-[11px] text-white">Preparing ocean heatmap…</div>}
                {marineRasterMetric && heatmapQuery.data === null && !heatmapQuery.isFetching && <div className="pointer-events-none absolute right-3 top-3 z-[650] rounded-lg bg-[#102E4A]/90 px-2.5 py-1.5 text-[11px] text-white">Heatmap unavailable; showing model sample points</div>}
              </div>}

          <div className="rounded-xl border bg-background/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-medium"><Timer className="h-4 w-4 text-primary" />Forecast timeline <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">{timeLabel}</span></div><span className="text-xs text-muted-foreground">{formatTime(forecastTime)}</span></div>
            <input type="range" min="0" max="72" step="1" value={forecastHour} onChange={(event) => setForecastHour(Number(event.target.value))} className="mt-3 h-2 w-full cursor-pointer accent-primary" aria-label="Scrub hourly ocean forecast" />
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-muted-foreground">Hourly model steps · 0 to +72 h</span><div className="flex gap-1.5">{presets.map((hour) => <Button key={hour} size="sm" variant={forecastHour === hour ? 'default' : 'outline'} className="h-7 px-2.5 text-xs" onClick={() => setForecastHour(hour)}>+{hour} h</Button>)}</div></div>
            {(metric === 'anomalyC' || metric === 'seaSurfaceC') && <p className="mt-2 text-[11px] text-muted-foreground">NOAA SST is a daily analysis and stays on its source date while the marine forecast timeline moves.</p>}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Wave, swell, and current colors are interpolated for display between hourly Open-Meteo marine model samples and masked to NOAA ocean cells; they are not a provider-native NOAA wave raster. SST and anomaly colors come from NOAA’s daily 0.25° OISST preliminary analysis; the source date is shown in the inspector and can lag the current day. All model layers are estimates, not buoy measurements.</p>
        </CardContent></Card>
      </section>

      <aside className="space-y-4">
        <Card className="weather-panel"><CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><Waves className="h-4 w-4 text-primary" />{selectedChoice?.name ?? 'Ocean details'}</CardTitle><CardDescription>{selectedChoice ? `${selectedChoice.lat.toFixed(2)}°, ${selectedChoice.lng.toFixed(2)}° · ${formatTime(forecastTime)}` : 'Choose a marker, search a city, or pin coordinates.'}</CardDescription></CardHeader><CardContent className="space-y-3">
          {selectedOcean ? <>
            <div className="grid gap-2">
              {[
                { key: 'waveHeightM' as const, label: 'Wave height', unit: 'm', value: currentWave, trend: waveTrend, color: '#55C1FF', icon: Waves },
                { key: 'swellHeightM' as const, label: 'Swell height', unit: 'm', value: currentSwell, trend: swellTrend, color: '#A682FF', icon: Waves },
                { key: 'currentKmh' as const, label: 'Current speed', unit: 'km/h', value: currentFlow, trend: currentTrend, color: '#5887FF', icon: Compass },
              ].map((item) => <div key={item.key} className="flex items-center justify-between gap-2 rounded-xl border bg-muted/30 p-3"><span className="flex items-center gap-2 text-sm text-muted-foreground"><item.icon className="h-4 w-4 text-primary" />{item.label}</span><Sparkline values={item.trend} color={item.color} /><strong className="min-w-[72px] text-right">{item.value === null ? '—' : `${item.value.toFixed(1)} ${item.unit}`}</strong></div>)}
              <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-3 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><Timer className="h-4 w-4 text-primary" />Wave period</span><strong>{hourValue(selectedOcean, 'wavePeriodS', forecastHour)?.toFixed(1) ?? '—'} s</strong></div>
              <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-3 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><Thermometer className="h-4 w-4 text-primary" />Sea-surface temperature</span><strong>{displayValue(selectedOcean.seaSurfaceC, 'seaSurfaceC')}</strong></div>
              <div className="flex items-center justify-between rounded-xl border bg-muted/30 p-3 text-sm"><span className="flex items-center gap-2 text-muted-foreground"><Thermometer className="h-4 w-4 text-primary" />Daily SST anomaly</span><strong>{displayValue(selectedOcean.anomalyC, 'anomalyC')}</strong></div>
            </div>
            <p className="text-[11px] text-muted-foreground">Micro-charts show a seven-day forecast sampled every six hours. NOAA analysis: {selectedOcean.sstTime ?? 'not available'}.</p>
            {extraQuery.isFetching && <p className="text-xs text-muted-foreground">Loading this location’s SST sample…</p>}
            {extraQuery.isError && <p className="text-xs text-muted-foreground">This point’s NOAA SST sample is temporarily unavailable; the global raster may still be shown.</p>}
          </> : <p className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">Choose a map point or search/pin a location to load its marine forecast.</p>}

          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" />Local status</div>
            {statusBadges.length ? statusBadges.map((badge) => <div key={badge.label} className={`rounded-xl border p-3 ${badge.tone}`}><div className="text-sm font-semibold">{badge.label}</div><div className="mt-0.5 text-[11px] opacity-80">{badge.note}</div></div>) : <div className="rounded-xl border bg-muted/25 p-3 text-sm text-muted-foreground">No local threshold flags at this point.</div>}
            <p className="text-[10px] leading-relaxed text-muted-foreground">Thresholds are informational heuristics, not official warnings. A single-day NOAA anomaly cannot establish a formal marine heatwave, which requires sustained percentile-based conditions.</p>
          </div>

          <div className="space-y-2 border-t pt-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"><ArrowDownToLine className="h-3.5 w-3.5" />Export region data</div>
            <p className="text-[11px] text-muted-foreground">{location || userPosition ? `${exportRows.length} nearby sample locations around ${location ? 'the selected point' : 'your position'}.` : `${exportRows.length} global marine sample locations.`}</p>
            <div className="grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={() => exportData('geojson')}>Download GeoJSON</Button><Button variant="outline" size="sm" onClick={() => exportData('csv')}>Download CSV</Button></div>
          </div>
        </CardContent></Card>

        <Card className="weather-panel"><CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-base"><Anchor className="h-4 w-4 text-primary" />How to read the map</CardTitle></CardHeader><CardContent className="space-y-2 text-xs leading-relaxed text-muted-foreground"><p>Significant wave height describes the average of the highest third of waves. Swell height is the longer-period wave component. Current bearings point toward the flow; wave and swell bearings point from where waves arrive.</p><p>NOAA anomaly compares daily sea temperature with its 1971–2000 reference. The map legend shows the display range; values outside the range use the end color.</p><p>Model values are for general awareness only—not navigation, rescue, or safety advice. Follow official local marine warnings. No coordinates are sent to a server controlled by AquaWatch beyond the public weather data request itself.</p><p>Sources: <a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" rel="noreferrer" className="font-medium text-primary underline">Open-Meteo Marine API</a> (CC BY 4.0) · <a href="https://www.ncei.noaa.gov/products/optimum-interpolation-sst" target="_blank" rel="noreferrer" className="font-medium text-primary underline">NOAA NCEI OISST</a>.</p></CardContent></Card>
      </aside>
    </div>
  </FeaturePageLayout>;
};

export default OceanPage;
