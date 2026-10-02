import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, Film, MapPin, Moon, Sun, SquareDashedMousePointer } from 'lucide-react';
import { FeaturePageLayout } from '@/components/FeaturePageLayout';
import { EnvironmentalMap, type EnvironmentalPoint } from '@/components/EnvironmentalMap';
import { SolarGlobe, type SolarGlobeHandle } from '@/components/SolarGlobe';
import { CitySearch } from '@/components/CitySearch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchFloodStormEvents, type EonetEvent } from '@/lib/eonet';
import { calculateCelestialSnapshot } from '@/lib/celestial';
import { readObservations, type GroundObservation } from '@/lib/communityStorage';
import type { CitySearchResult } from '@/lib/openMeteo';

interface Bounds { west: number; south: number; east: number; north: number; }
interface ExportPoint { id: string; lat: number; lng: number; label: string; category: string; date: string; note?: string; source: string; }
const DEFAULT_BOUNDS: Bounds = { west: -180, south: -90, east: 180, north: 90 };
const inputClass = 'h-10 w-full rounded-lg border bg-background px-3 text-sm';
const inBounds = (lat: number, lng: number, box: Bounds) => lng >= box.west && lng <= box.east && lat >= box.south && lat <= box.north;
const saveJson = (filename: string, payload: unknown) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/geo+json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a'); anchor.href = href; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
};
const saveCsv = (filename: string, rows: string[][]) => {
  const csv = rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')).join('\n');
  const href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = href; anchor.download = filename; anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
};

const ToolsPage = () => {
  const [now, setNow] = useState(() => new Date());
  const [place, setPlace] = useState<CitySearchResult | null>(null);
  const [bounds, setBounds] = useState<Bounds>(DEFAULT_BOUNDS);
  const [firstCorner, setFirstCorner] = useState<{ lat: number; lng: number } | null>(null);
  const [observations, setObservations] = useState<GroundObservation[]>([]);
  const [includeEvents, setIncludeEvents] = useState(true);
  const [includeObservations, setIncludeObservations] = useState(true);
  const [recording, setRecording] = useState(false);
  const globeRef = useRef<SolarGlobeHandle>(null);
  const [exportError, setExportError] = useState('');
  const [recordingError, setRecordingError] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    void readObservations().then(setObservations).catch(() => undefined);
    return () => window.clearInterval(timer);
  }, []);
  const celestial = useMemo(() => calculateCelestialSnapshot(now, place ? { lat: place.lat, lng: place.lng } : undefined), [now, place]);
  const eventQuery = useQuery({ queryKey: ['tools-reported-events'], queryFn: fetchFloodStormEvents, staleTime: 10 * 60 * 1000, retry: 1 });
  const events = useMemo<EonetEvent[]>(() => eventQuery.data ?? [], [eventQuery.data]);
  const exportPoints = useMemo<ExportPoint[]>(() => [
    ...(includeEvents ? events.filter((event) => inBounds(event.lat, event.lng, bounds)).map((event) => ({ id: event.id, lat: event.lat, lng: event.lng, label: event.title, category: event.category, date: event.date, source: event.link })) : []),
    ...(includeObservations ? observations.filter((item) => inBounds(item.lat, item.lng, bounds)).map((item) => ({ id: item.id, lat: item.lat, lng: item.lng, label: item.kind, category: 'community observation (unverified)', note: item.note, date: item.observedAt, source: 'saved locally in this browser' })) : []),
  ], [bounds, events, includeEvents, includeObservations, observations]);
  const mapPoints = useMemo<EnvironmentalPoint[]>(() => [
    ...events.map((event) => ({ id: `event-${event.id}`, lat: event.lat, lng: event.lng, label: event.title, detail: event.category, color: '#dc2626' })),
    ...observations.map((item) => ({ id: `report-${item.id}`, lat: item.lat, lng: item.lng, label: item.kind, detail: item.note, color: '#d97706' })),
  ], [events, observations]);
  const onMapClick = useCallback((point: { lat: number; lng: number }) => {
    if (!firstCorner) { setFirstCorner(point); toast.message('First corner set. Click the opposite corner to finish the box.'); return; }
    const west = Math.min(firstCorner.lng, point.lng), east = Math.max(firstCorner.lng, point.lng);
    const south = Math.min(firstCorner.lat, point.lat), north = Math.max(firstCorner.lat, point.lat);
    if (west === east || south === north) { toast.error('Choose two different corners.'); return; }
    setBounds({ west, south, east, north }); setFirstCorner(null);
  }, [firstCorner]);

  const exportGeoJson = () => {
    if (bounds.west < -180 || bounds.east > 180 || bounds.south < -90 || bounds.north > 90 || bounds.west >= bounds.east || bounds.south >= bounds.north) { setExportError('Check the box: longitude must be −180 to 180, latitude −90 to 90, and each minimum must be smaller than its maximum.'); return; }
    if (!exportPoints.length) { setExportError('There are no selected events or saved observations inside this box.'); return; }
    setExportError('');
    const featureCollection = {
      type: 'FeatureCollection',
      name: 'AquaWatch environmental points',
      bbox: [bounds.west, bounds.south, bounds.east, bounds.north],
      source_note: 'Point features only. This download does not include a gridded satellite or forecast raster.',
      features: exportPoints.map((point) => ({ type: 'Feature', id: point.id, geometry: { type: 'Point', coordinates: [point.lng, point.lat] }, properties: { ...point } })),
    };
    saveJson('aquawatch-environmental-points.geojson', featureCollection);
  };
  const exportCsv = () => {
    if (!exportPoints.length) { setExportError('There are no selected points to export.'); return; }
    setExportError('');
    saveCsv('aquawatch-environmental-points.csv', [['id', 'latitude', 'longitude', 'name', 'category', 'date', 'details', 'source'], ...exportPoints.map((point) => [point.id, String(point.lat), String(point.lng), point.label, point.category, point.date, point.note ?? '', point.source])]);
  };

  const recordOrbit = () => {
    const canvas = globeRef.current?.getCanvas();
    if (!canvas || !('captureStream' in canvas) || typeof MediaRecorder === 'undefined') { setRecordingError('Video recording is not supported in this browser. Try a current desktop browser.'); return; }
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9' : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : '';
    if (!mimeType) { setRecordingError('This browser cannot create WebM video.'); return; }
    setRecordingError('');
    const stream = canvas.captureStream(30);
    const chunks: BlobPart[] = [];
    let recorder: MediaRecorder;
    try { recorder = new MediaRecorder(stream, { mimeType }); }
    catch { stream.getTracks().forEach((track) => track.stop()); setRecordingError('Could not start the browser video recorder.'); return; }
    const center = place ?? { lat: 0, lng: 0 };
    const startLng = center.lng - 180;
    let interval = 0;
    let timeout = 0;
    const finish = () => {
      window.clearInterval(interval); window.clearTimeout(timeout);
      stream.getTracks().forEach((track) => track.stop()); setRecording(false);
      const blob = new Blob(chunks, { type: 'video/webm' });
      const href = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = href; anchor.download = `aquawatch-orbit-${new Date().toISOString().slice(0, 10)}.webm`; anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(href), 30_000);
      globeRef.current?.setView({ lat: center.lat, lng: center.lng, altitude: 1.8 }, 800);
    };
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = finish;
    globeRef.current?.setView({ lat: center.lat, lng: startLng, altitude: 1.8 }, 0);
    recorder.start(500); setRecording(true);
    let steps = 0;
    interval = window.setInterval(() => { steps += 1; globeRef.current?.setView({ lat: center.lat + Math.sin(steps / 80) * 8, lng: startLng + steps * 3, altitude: 1.8 }, 100); }, 100);
    timeout = window.setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 12_000);
  };

  const center = place ? { lat: place.lat, lng: place.lng } : { lat: 15, lng: 0 };
  return <FeaturePageLayout eyebrow="Explore & export" title="Sunlight, moon & data tools" description="See which side of Earth is facing the Sun, capture a short globe orbit, and export environmental points from a map area.">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-lg font-semibold">Live day and night</h2><p className="text-sm text-muted-foreground">The light side faces the Sun; the dark side is in night.</p></div><div className="w-full sm:max-w-xs"><CitySearch onSelect={setPlace} onReset={() => setPlace(null)} placeholder="Search a city for local daylight…" /></div></div>
        <SolarGlobe ref={globeRef} celestial={celestial} />
        <div className="grid gap-3 sm:grid-cols-3">
          <Card><CardContent className="flex items-center gap-3 p-4"><Sun className="h-5 w-5 text-amber-500" /><div><p className="text-xs text-muted-foreground">Sun overhead</p><p className="text-sm font-semibold">{celestial.sun.latitude.toFixed(1)}° lat · {celestial.sun.longitude.toFixed(1)}° lon</p></div></CardContent></Card>
          <Card><CardContent className="flex items-center gap-3 p-4"><Moon className="h-5 w-5 text-sky-500" /><div><p className="text-xs text-muted-foreground">Moon · {celestial.moonPhase}</p><p className="text-sm font-semibold">About {celestial.moonIlluminationPercent}% lit</p></div></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{place ? `Daylight near ${place.name}` : 'Daylight at the equator'}</p><p className="text-sm font-semibold">{celestial.daylight ? 'Daytime' : 'Nighttime'} · Sun {celestial.solarAltitudeDegrees.toFixed(0)}° above horizon</p></CardContent></Card>
        </div>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Film className="h-4 w-4 text-primary" />Make a globe video</CardTitle><CardDescription>Record a 12-second camera orbit around the selected city or the world and download a WebM clip.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center gap-3"><Button onClick={recordOrbit} disabled={recording} className="gap-2"><Film className="h-4 w-4" />{recording ? 'Recording…' : 'Record globe orbit'}</Button>{recording && <span className="text-sm text-muted-foreground">Keep this tab open; the clip saves when recording finishes.</span>}{recordingError && <p role="alert" className="w-full text-sm text-destructive">{recordingError}</p>}<p className="w-full text-xs text-muted-foreground">The video is generated locally by your browser. Output size and quality depend on your device and browser.</p></CardContent></Card>
      </section>

      <section className="space-y-4">
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><SquareDashedMousePointer className="h-4 w-4 text-primary" />Export points in an area</CardTitle><CardDescription>Click two opposite corners on the map, or enter the box coordinates below.</CardDescription></CardHeader><CardContent className="space-y-4">
          <EnvironmentalMap points={mapPoints} center={center} zoom={place ? 4 : 1} height={300} onMapClick={onMapClick} emptyLabel="Loading reported and saved points…" />
          <p className="text-xs text-muted-foreground">{firstCorner ? `First corner: ${firstCorner.lat.toFixed(2)}, ${firstCorner.lng.toFixed(2)} · click the opposite corner` : 'Choose two map corners to select an area.'} · {events.length} reported events · {observations.length} local pins</p>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1"><Label htmlFor="west">West longitude</Label><Input id="west" type="number" min="-180" max="180" step="0.01" value={bounds.west} onChange={(event) => setBounds((box) => ({ ...box, west: Number(event.target.value) }))} /></div><div className="space-y-1"><Label htmlFor="east">East longitude</Label><Input id="east" type="number" min="-180" max="180" step="0.01" value={bounds.east} onChange={(event) => setBounds((box) => ({ ...box, east: Number(event.target.value) }))} /></div><div className="space-y-1"><Label htmlFor="south">South latitude</Label><Input id="south" type="number" min="-90" max="90" step="0.01" value={bounds.south} onChange={(event) => setBounds((box) => ({ ...box, south: Number(event.target.value) }))} /></div><div className="space-y-1"><Label htmlFor="north">North latitude</Label><Input id="north" type="number" min="-90" max="90" step="0.01" value={bounds.north} onChange={(event) => setBounds((box) => ({ ...box, north: Number(event.target.value) }))} /></div></div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={includeEvents} onChange={(event) => setIncludeEvents(event.target.checked)} />Reported events</label><label className="flex items-center gap-2"><input type="checkbox" checked={includeObservations} onChange={(event) => setIncludeObservations(event.target.checked)} />My local pins</label></div>
          <p className="text-sm">{exportPoints.length} point{exportPoints.length === 1 ? '' : 's'} inside this box</p>
          <div className="flex flex-wrap gap-2"><Button onClick={exportGeoJson} disabled={!exportPoints.length} className="gap-2"><Download className="h-4 w-4" />Download GeoJSON</Button><Button variant="outline" onClick={exportCsv} disabled={!exportPoints.length}>Download CSV</Button></div>
          {exportError && <p role="alert" className="text-sm text-destructive">{exportError}</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">About GIS downloads</CardTitle><CardDescription>GeoJSON and CSV contain point records, not satellite images.</CardDescription></CardHeader><CardContent className="space-y-2 text-sm text-muted-foreground"><p>GeoJSON includes coordinates, event name/type, date, and source where available. Local community pins stay on your device and are included only when selected.</p><p>GeoTIFF and NetCDF downloads are not offered here because the current layers are points, not gridded raster data. Exporting those formats requires a compatible raster source and its licensing/access rules.</p><p className="text-xs">{eventQuery.isError ? 'Live event feed is temporarily unavailable.' : eventQuery.isLoading ? 'Loading reported events…' : 'Reported events are provided by NASA EONET.'}</p></CardContent></Card>
      </section>
    </div>
  </FeaturePageLayout>;
};

export default ToolsPage;
