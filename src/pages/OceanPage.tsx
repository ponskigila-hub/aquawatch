import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Waves, Compass, RefreshCw, Timer, Thermometer } from 'lucide-react';
import { FeaturePageLayout } from '@/components/FeaturePageLayout';
import { EnvironmentalMap, type EnvironmentalPoint } from '@/components/EnvironmentalMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchGlobalMarineConditions, fetchGlobalOisstPoints, type MarinePoint, type OisstPoint } from '@/lib/environmentalLayers';

type OceanMetric = 'waveHeightM' | 'swellHeightM' | 'currentKmh' | 'seaSurfaceC' | 'anomalyC';
type OceanPoint = MarinePoint & Pick<OisstPoint, 'seaSurfaceC' | 'anomalyC'> & { sstTime: string | null };
const oceanMetrics: Array<{ key: OceanMetric; label: string; unit: string }> = [
  { key: 'waveHeightM', label: 'Wave height', unit: 'm' },
  { key: 'swellHeightM', label: 'Swell height', unit: 'm' },
  { key: 'currentKmh', label: 'Current speed', unit: 'km/h' },
  { key: 'seaSurfaceC', label: 'Sea surface temp.', unit: '°C' },
  { key: 'anomalyC', label: 'SST anomaly', unit: '°C' },
];
const colorFor = (value: number | null, metric: OceanMetric) => {
  if (value === null) return '#94a3b8';
  if (metric === 'anomalyC') return value <= -2 ? '#2563eb' : value <= -0.5 ? '#38bdf8' : value < 0.5 ? '#94a3b8' : value < 2 ? '#fb923c' : '#dc2626';
  if (metric === 'seaSurfaceC') return value < 5 ? '#38bdf8' : value < 15 ? '#22c55e' : value < 25 ? '#eab308' : '#ef4444';
  if (metric === 'currentKmh') return value < 0.5 ? '#22c55e' : value < 1.5 ? '#0ea5e9' : value < 3 ? '#f59e0b' : '#ef4444';
  return value < 1 ? '#22c55e' : value < 2.5 ? '#eab308' : value < 4 ? '#f97316' : '#dc2626';
};
const OceanPage = () => {
  const [metric, setMetric] = useState<OceanMetric>('waveHeightM');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const marineQuery = useQuery({ queryKey: ['global-marine-snapshot'], queryFn: fetchGlobalMarineConditions, staleTime: 20 * 60 * 1000, refetchInterval: 30 * 60 * 1000, retry: 1 });
  const sstQuery = useQuery({ queryKey: ['global-oisst-points'], queryFn: fetchGlobalOisstPoints, staleTime: 6 * 60 * 60 * 1000, refetchInterval: 6 * 60 * 60 * 1000, retry: 1 });
  const oceanData = useMemo<OceanPoint[]>(() => (marineQuery.data ?? []).map((point) => {
    const sst = sstQuery.data?.find((item) => item.id === point.id);
    return { ...point, seaSurfaceC: sst?.seaSurfaceC ?? null, anomalyC: sst?.anomalyC ?? null, sstTime: sst?.time ?? null };
  }), [marineQuery.data, sstQuery.data]);
  const points = useMemo<EnvironmentalPoint[]>(() => oceanData.map((point) => {
    const value = point[metric];
    const unit = oceanMetrics.find((item) => item.key === metric)?.unit ?? '';
    const detail = `Waves ${point.waveHeightM?.toFixed(1) ?? '—'} m · Sea surface ${point.seaSurfaceC?.toFixed(1) ?? '—'} °C · Anomaly ${point.anomalyC === null ? '—' : `${point.anomalyC > 0 ? '+' : ''}${point.anomalyC.toFixed(1)} °C`}`;
    return { id: point.id, lat: point.lat, lng: point.lng, label: point.name, detail, value: value === null ? 'No value' : `${metric === 'anomalyC' && value > 0 ? '+' : ''}${value.toFixed(1)} ${unit}`, color: colorFor(value, metric), radius: 8 };
  }), [metric, oceanData]);
  const selected = oceanData.find((point) => point.id === selectedId) ?? oceanData[0] ?? null;
  const refreshing = marineQuery.isFetching || sstQuery.isFetching;

  return <FeaturePageLayout eyebrow="Marine & ocean" title="Ocean conditions" description="Compare model-based wave and current forecasts with NOAA’s daily gridded sea-surface temperature and anomaly analysis.">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Global ocean snapshot</h2><p className="text-sm text-muted-foreground">{oceanData.length || 12} ocean reference locations · daily SST and marine forecast</p></div><Button variant="outline" size="sm" className="gap-2" onClick={() => void Promise.all([marineQuery.refetch(), sstQuery.refetch()])} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />Refresh</Button></div>
        <div className="flex flex-wrap gap-2">{oceanMetrics.map((item) => <Button key={item.key} variant={metric === item.key ? 'default' : 'outline'} size="sm" onClick={() => setMetric(item.key)}>{item.label}</Button>)}</div>
        {marineQuery.isLoading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading ocean conditions…</CardContent></Card> : marineQuery.isError ? <Card><CardContent className="p-5 text-sm text-muted-foreground">Ocean data is temporarily unavailable. Please try again later.</CardContent></Card> : <EnvironmentalMap points={points} height={500} onPointClick={(point) => setSelectedId(point.id)} emptyLabel="No ocean data available." />}
        {metric === 'anomalyC' && <p className="text-xs text-muted-foreground">Blue shows cooler than the 1971–2000 reference; orange/red shows warmer. Gray is closer to that reference. NOAA values are sampled at these ocean locations, not shown as a continuous global raster.</p>}
        {metric === 'anomalyC' && sstQuery.isError && <p className="text-xs text-amber-500">NOAA SST analysis is temporarily unavailable; wave and current data may still load.</p>}
      </section>
      <aside className="space-y-4"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Waves className="h-4 w-4 text-primary" />{selected?.name ?? 'Ocean details'}</CardTitle><CardDescription>Choose a marker on the map to inspect a region.</CardDescription></CardHeader><CardContent>
        {selected ? <div className="grid gap-2">{oceanMetrics.map((item) => { const Icon = item.key === 'currentKmh' ? Compass : item.key === 'seaSurfaceC' || item.key === 'anomalyC' ? Thermometer : Waves; const value = selected[item.key]; return <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{item.label}</span><strong>{value === null ? '—' : `${item.key === 'anomalyC' && value > 0 ? '+' : ''}${value.toFixed(1)} ${item.unit}`}</strong></div>; })}<div className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3"><span className="flex items-center gap-2 text-sm text-muted-foreground"><Timer className="h-4 w-4 text-primary" />Wave period</span><strong>{selected.wavePeriodS === null ? '—' : `${selected.wavePeriodS.toFixed(1)} s`}</strong></div><p className="text-xs text-muted-foreground">Current flows toward {selected.currentDirectionDeg === null ? '—' : `${Math.round(selected.currentDirectionDeg)}°`} · Marine forecast time: {selected.time ?? 'not reported'} UTC</p><p className="text-xs text-muted-foreground">NOAA SST analysis date: {selected.sstTime ?? sstQuery.data?.[0]?.time ?? 'not available'}</p></div> : <p className="text-sm text-muted-foreground">Ocean values unavailable.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">How to read this map</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>Waves are shown as significant wave height; swell is the longer-period component. Current direction describes where the water flows toward.</p><p>Waves and currents are model estimates, not buoy observations; hourly output is not hourly measurement. NOAA OISST is a daily gridded analysis, not an instantaneous station reading. Its anomaly compares sea temperature with its 1971–2000 reference.</p><p>Values are for general awareness only—not navigation, rescue, or safety advice. Follow official local marine warnings.</p><p>Sources: <a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" rel="noreferrer" className="font-medium text-primary underline">Open-Meteo Marine API</a> · CC BY 4.0 attribution, and <a href="https://www.ncei.noaa.gov/products/optimum-interpolation-sst" target="_blank" rel="noreferrer" className="font-medium text-primary underline">NOAA NCEI OISST</a>. <a href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso/roni/" target="_blank" rel="noreferrer" className="font-medium text-primary underline">See NOAA’s monthly ENSO index</a> for regional climate monitoring.</p></CardContent></Card></aside>
    </div>
  </FeaturePageLayout>;
};
export default OceanPage;
