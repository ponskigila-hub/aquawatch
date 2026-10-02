import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wind, RefreshCw, TriangleAlert } from 'lucide-react';
import { FeaturePageLayout } from '@/components/FeaturePageLayout';
import { EnvironmentalMap, type EnvironmentalPoint } from '@/components/EnvironmentalMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { fetchGlobalAirQuality, type AirQualityPoint } from '@/lib/environmentalLayers';

type AirMetric = 'usAqi' | 'pm25' | 'pm10' | 'no2' | 'so2';
const metrics: Array<{ key: AirMetric; label: string; unit: string }> = [
  { key: 'usAqi', label: 'Air quality index', unit: 'AQI' },
  { key: 'pm25', label: 'Fine particles (PM2.5)', unit: 'µg/m³' },
  { key: 'pm10', label: 'Particles (PM10)', unit: 'µg/m³' },
  { key: 'no2', label: 'Nitrogen dioxide (NO₂)', unit: 'µg/m³' },
  { key: 'so2', label: 'Sulfur dioxide (SO₂)', unit: 'µg/m³' },
];
const aqiColor = (value: number | null) => value === null ? '#94a3b8' : value <= 50 ? '#16a34a' : value <= 100 ? '#eab308' : value <= 150 ? '#f97316' : value <= 200 ? '#dc2626' : '#7e22ce';
const pollutantColor = (value: number | null) => value === null ? '#94a3b8' : value < 10 ? '#0ea5e9' : value < 25 ? '#eab308' : value < 50 ? '#f97316' : '#dc2626';
const metricValue = (point: AirQualityPoint, metric: AirMetric) => point[metric];

const AirQualityPage = () => {
  const [metric, setMetric] = useState<AirMetric>('usAqi');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['global-air-quality', 'city-reference-points'], queryFn: fetchGlobalAirQuality, staleTime: 15 * 60 * 1000, refetchInterval: 30 * 60 * 1000, retry: 1 });
  const points = useMemo<EnvironmentalPoint[]>(() => (query.data ?? []).map((point) => {
    const value = metricValue(point, metric);
    const unit = metrics.find((item) => item.key === metric)?.unit ?? '';
    const color = metric === 'usAqi' ? aqiColor(value) : pollutantColor(value);
    return { id: point.id, lat: point.lat, lng: point.lng, label: `${point.name}, ${point.country}`, detail: `AQI ${point.usAqi ?? '—'} · PM2.5 ${point.pm25?.toFixed(1) ?? '—'} · PM10 ${point.pm10?.toFixed(1) ?? '—'} · NO₂ ${point.no2?.toFixed(1) ?? '—'} · SO₂ ${point.so2?.toFixed(1) ?? '—'}`, value: value === null ? 'No value' : `${value.toFixed(metric === 'usAqi' ? 0 : 1)} ${unit}`, color };
  }), [metric, query.data]);
  const selected = query.data?.find((point) => point.id === selectedId) ?? query.data?.[0] ?? null;
  const activeMetric = metrics.find((item) => item.key === metric)!;

  return <FeaturePageLayout eyebrow="Air & atmosphere" title="Air quality around the world" description="Compare estimated air-quality index and common air pollutants at reference cities. Choose a pollutant to update the map and details.">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Global air snapshot</h2><p className="text-sm text-muted-foreground">{query.data?.length ?? 0} reference locations · refreshed every 30 minutes</p></div><Button variant="outline" size="sm" className="gap-2" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={`h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} />Refresh</Button></div>
        <div className="flex flex-wrap gap-2">{metrics.map((item) => <Button key={item.key} variant={metric === item.key ? 'default' : 'outline'} size="sm" onClick={() => setMetric(item.key)}>{item.label}</Button>)}</div>
        {query.isLoading ? <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading air-quality estimates…</CardContent></Card> : query.isError ? <Card><CardContent className="p-5 text-sm text-muted-foreground">Air-quality data is temporarily unavailable. Please try again later.</CardContent></Card> : <EnvironmentalMap points={points} height={500} emptyLabel="No air-quality points available." onPointClick={(point) => setSelectedId(point.id)} />}
      </section>
      <aside className="space-y-4"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wind className="h-4 w-4 text-primary" />{activeMetric.label}</CardTitle><CardDescription>Select a dot on the map for a location.</CardDescription></CardHeader><CardContent>
        {selected ? <><p className="text-lg font-semibold">{selected.name}, {selected.country}</p><div className="mt-4 grid grid-cols-2 gap-2">{metrics.map((item) => <div key={item.key} className="rounded-xl border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-lg font-bold">{selected[item.key] === null ? '—' : `${selected[item.key]?.toFixed(item.key === 'usAqi' ? 0 : 1)} ${item.unit}`}</p></div>)}</div><p className="mt-3 text-xs text-muted-foreground">Forecast timestamp: {selected.time ?? 'not reported'} (UTC)</p></> : <p className="text-sm text-muted-foreground">No air-quality readings are available.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">How to read this map</CardTitle></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>For the index, green is lower, yellow is moderate, orange/red/purple are higher. Pollutant colors show lower-to-higher readings, not a separate health warning.</p><p><TriangleAlert className="mr-1 inline h-3.5 w-3.5" />These are model-based surface estimates at selected city points. They are not direct sensor readings or a continuous satellite image.</p><p>Copernicus Sentinel-5P column products are not connected in this version. Adding them requires server-side Copernicus Data Space credentials; atmospheric column amounts are not the same as ground-level AQI.</p><p>Satellite products can have cloud gaps, processing delays, and different units; compare each only with its own source notes.</p><p>Source: <a className="font-medium text-primary underline" href="https://open-meteo.com/en/docs/air-quality-api" target="_blank" rel="noreferrer">Open-Meteo Air Quality API</a> · CC BY 4.0 attribution applies. <a className="font-medium text-primary underline" href="https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-5p" target="_blank" rel="noreferrer">Copernicus Sentinel-5P</a>.</p></CardContent></Card></aside>
    </div>
  </FeaturePageLayout>;
};
export default AirQualityPage;
