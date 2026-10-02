import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BellRing, Camera, LocateFixed, MapPin, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { FeaturePageLayout } from '@/components/FeaturePageLayout';
import { EnvironmentalMap, type EnvironmentalPoint } from '@/components/EnvironmentalMap';
import { CitySearch } from '@/components/CitySearch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CitySearchResult } from '@/lib/openMeteo';
import { compressPhoto, readAlertRules, readObservations, removeObservation, saveObservation, writeAlertRules, type AlertRule, type GroundObservation, type ObservationKind } from '@/lib/communityStorage';

interface ThresholdReading { rain3hMm: number | null; gustKmh: number | null; checkedAt: string; }
const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast';

async function readThresholdWeather(rule: AlertRule): Promise<ThresholdReading> {
  const params = new URLSearchParams({
    latitude: String(rule.lat), longitude: String(rule.lng),
    hourly: 'precipitation,wind_gusts_10m', forecast_hours: '3', timezone: 'auto',
  });
  const response = await fetch(`${WEATHER_URL}?${params}`);
  if (!response.ok) throw new Error(`Weather check failed (${response.status}).`);
  const payload = await response.json();
  const precipitation: Array<number | null> = payload.hourly?.precipitation ?? [];
  const gusts: Array<number | null> = payload.hourly?.wind_gusts_10m ?? [];
  const validRain = precipitation.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const validGust = gusts.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return { rain3hMm: validRain.length ? validRain.reduce((sum, value) => sum + value, 0) : null, gustKmh: validGust.length ? Math.max(...validGust) : null, checkedAt: new Date().toISOString() };
}

const inputClass = 'h-10 w-full rounded-lg border bg-background px-3 text-sm';

const CommunityPage = () => {
  const [rules, setRules] = useState<AlertRule[]>(() => readAlertRules());
  const [reports, setReports] = useState<GroundObservation[]>([]);
  const [selectedCity, setSelectedCity] = useState<CitySearchResult | null>(null);
  const [ruleRain, setRuleRain] = useState('35');
  const [ruleWind, setRuleWind] = useState('60');
  const [pin, setPin] = useState({ lat: -6.2088, lng: 106.8456 });
  const [reportKind, setReportKind] = useState<ObservationKind>('street flooding');
  const [note, setNote] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | undefined>();
  const [savingReport, setSavingReport] = useState(false);
  const [notificationState, setNotificationState] = useState<NotificationPermission | 'unsupported'>(() => typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
  const [loadError, setLoadError] = useState('');

  useEffect(() => { void readObservations().then(setReports).catch(() => setLoadError('This browser could not open local observation storage.')); }, []);
  useEffect(() => { writeAlertRules(rules); }, [rules]);

  const activeRules = useMemo(() => rules.filter((rule) => rule.enabled), [rules]);
  const monitor = useQuery({
    queryKey: ['community-threshold-checks', activeRules.map(({ id, lat, lng, rainfall3hMm, windGustKmh }) => [id, lat, lng, rainfall3hMm, windGustKmh])],
    queryFn: () => Promise.all(activeRules.map(async (rule) => ({ ruleId: rule.id, reading: await readThresholdWeather(rule) }))),
    enabled: activeRules.length > 0,
    staleTime: 0,
    refetchInterval: 5 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    if (notificationState !== 'granted' || !monitor.data) return;
    for (const { ruleId, reading } of monitor.data) {
      const rule = activeRules.find((item) => item.id === ruleId);
      if (!rule) continue;
      const rainHit = reading.rain3hMm !== null && reading.rain3hMm >= rule.rainfall3hMm;
      const windHit = reading.gustKmh !== null && reading.gustKmh >= rule.windGustKmh;
      if (!rainHit && !windHit) continue;
      const hourKey = new Date().toISOString().slice(0, 13);
      const noticeKey = `aquawatch.notice.${rule.id}.${hourKey}`;
      if (localStorage.getItem(noticeKey)) continue;
      const trigger = rainHit ? `${reading.rain3hMm?.toFixed(1)} mm rain in 3 hours` : `${Math.round(reading.gustKmh ?? 0)} km/h wind gusts`;
      new Notification(`Weather threshold reached near ${rule.name}`, { body: `${trigger}. Your saved limit has been reached.`, tag: noticeKey });
      localStorage.setItem(noticeKey, '1');
    }
  }, [activeRules, monitor.data, notificationState]);

  const mapPoints = useMemo<EnvironmentalPoint[]>(() => reports.map((report) => ({
    id: report.id, lat: report.lat, lng: report.lng, label: report.kind,
    detail: `${report.note} · community report · ${new Date(report.observedAt).toLocaleString()}`,
    color: '#d97706', radius: 8,
  })), [reports]);
  const handleMapClick = useCallback((point: { lat: number; lng: number }) => setPin(point), []);

  const addRule = () => {
    if (!selectedCity) { toast.error('Search for a city first.'); return; }
    const rainfall3hMm = Number(ruleRain), windGustKmh = Number(ruleWind);
    if (!Number.isFinite(rainfall3hMm) || rainfall3hMm <= 0 || !Number.isFinite(windGustKmh) || windGustKmh <= 0) { toast.error('Enter positive rainfall and wind limits.'); return; }
    setRules((current) => [{ id: crypto.randomUUID(), name: `${selectedCity.name}, ${selectedCity.country}`, lat: selectedCity.lat, lng: selectedCity.lng, rainfall3hMm, windGustKmh, enabled: true }, ...current]);
    toast.success('Weather watch saved on this device.');
    setSelectedCity(null);
  };

  const addObservation = async () => {
    if (!note.trim()) { toast.error('Add a short description first.'); return; }
    setSavingReport(true);
    try {
      const report: GroundObservation = { id: crypto.randomUUID(), kind: reportKind, note: note.trim(), lat: pin.lat, lng: pin.lng, observedAt: new Date().toISOString(), photoDataUrl };
      await saveObservation(report);
      setReports((current) => [report, ...current]);
      setNote(''); setPhotoDataUrl(undefined);
      toast.success('Observation saved in this browser. It has not been shared.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save this observation.');
    } finally { setSavingReport(false); }
  };

  const removeReport = async (id: string) => {
    try { await removeObservation(id); setReports((current) => current.filter((item) => item.id !== id)); }
    catch { toast.error('Could not remove the saved observation.'); }
  };

  const enableNotifications = async () => {
    if (typeof Notification === 'undefined') { setNotificationState('unsupported'); return; }
    const permission = await Notification.requestPermission();
    setNotificationState(permission);
    if (permission === 'granted') toast.success('Browser notifications enabled while this page is open.');
  };

  return <FeaturePageLayout eyebrow="Local tools" title="Community & personal alerts" description="Set rain and wind limits for places you care about, and save local observations on the map. These records stay in this browser; they are not sent to a shared public feed.">
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Observation map</h2><p className="text-sm text-muted-foreground">Click the map to place a report pin.</p></div><Button variant="outline" size="sm" className="gap-2" onClick={() => navigator.geolocation?.getCurrentPosition((position) => setPin({ lat: position.coords.latitude, lng: position.coords.longitude }), () => toast.error('Could not access your location.'))}><LocateFixed className="h-4 w-4" />Use my location</Button></div>
        <EnvironmentalMap points={mapPoints} height={420} center={reports[0] ? { lat: reports[0].lat, lng: reports[0].lng } : { lat: 15, lng: 0 }} zoom={reports.length ? 4 : 2} onMapClick={handleMapClick} emptyLabel="No saved reports yet. Add one below." />
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><MapPin className="h-4 w-4 text-primary" />Add an observation</CardTitle><CardDescription>Pin flooding, outages, hail, or strong winds. Adding a photo is optional.</CardDescription></CardHeader><CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">Pin: {pin.lat.toFixed(4)}, {pin.lng.toFixed(4)}</p>
          <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1.5"><Label htmlFor="report-kind">What happened?</Label><select id="report-kind" className={inputClass} value={reportKind} onChange={(event) => setReportKind(event.target.value as ObservationKind)}><option>street flooding</option><option>power outage</option><option>hail</option><option>strong wind</option><option>other</option></select></div><div className="space-y-1.5"><Label htmlFor="report-photo">Photo (optional)</Label><Input id="report-photo" type="file" accept="image/*" className="h-10 text-xs" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { setPhotoDataUrl(await compressPhoto(file)); } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not use that photo.'); } }} /></div></div>
          {photoDataUrl && <img src={photoDataUrl} alt="Preview of the local observation" className="max-h-40 rounded-lg border object-cover" />}
          <Label htmlFor="report-note">Short description</Label><textarea id="report-note" value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={300} placeholder="What did you see? Avoid including personal details." className="w-full rounded-lg border bg-background px-3 py-2 text-sm" />
          <Button onClick={() => void addObservation()} disabled={savingReport} className="gap-2"><Plus className="h-4 w-4" />{savingReport ? 'Saving…' : 'Save this pin'}</Button>
          {loadError && <p className="text-xs text-destructive">{loadError}</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Saved observations ({reports.length})</CardTitle><CardDescription>Only visible in this browser profile. These reports are not verified.</CardDescription></CardHeader><CardContent className="space-y-3">
          {!reports.length ? <p className="text-sm text-muted-foreground">Your saved pins will appear here.</p> : reports.map((report) => <div key={report.id} className="flex items-start gap-3 rounded-xl border p-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold capitalize">{report.kind}</p><p className="text-sm text-muted-foreground">{report.note}</p><p className="mt-1 text-[11px] text-muted-foreground">{report.lat.toFixed(3)}, {report.lng.toFixed(3)} · {new Date(report.observedAt).toLocaleString()}</p>{report.photoDataUrl && <img src={report.photoDataUrl} alt="User-provided observation" loading="lazy" className="mt-2 max-h-40 rounded-lg object-cover" />}</div><Button variant="ghost" size="icon" aria-label="Delete local observation" onClick={() => void removeReport(report.id)}><Trash2 className="h-4 w-4" /></Button></div>)}
        </CardContent></Card>
      </section>

      <aside className="space-y-4">
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><BellRing className="h-4 w-4 text-primary" />Personal weather watches</CardTitle><CardDescription>Check forecast rain and wind near saved places every five minutes while this page is open.</CardDescription></CardHeader><CardContent className="space-y-4">
          <div className="space-y-2"><Label>Choose a place</Label><CitySearch onSelect={setSelectedCity} onReset={() => setSelectedCity(null)} placeholder="Search city worldwide…" /></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label htmlFor="rain-limit">Rain in next 3 hours (mm)</Label><Input id="rain-limit" type="number" min="1" value={ruleRain} onChange={(event) => setRuleRain(event.target.value)} /></div><div className="space-y-1.5"><Label htmlFor="wind-limit">Wind gust (km/h)</Label><Input id="wind-limit" type="number" min="1" value={ruleWind} onChange={(event) => setRuleWind(event.target.value)} /></div></div>
          <Button onClick={addRule} disabled={!selectedCity} className="w-full gap-2"><Plus className="h-4 w-4" />Save place &amp; limits</Button>
          <Button variant="outline" onClick={() => void enableNotifications()} disabled={notificationState === 'unsupported' || notificationState === 'granted'} className="w-full gap-2"><BellRing className="h-4 w-4" />{notificationState === 'granted' ? 'Browser alerts are on' : notificationState === 'denied' ? 'Notifications are blocked in browser settings' : notificationState === 'unsupported' ? 'Browser notifications unavailable' : 'Enable browser alerts'}</Button>
          <div className="rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground"><TriangleAlert className="mr-1 inline h-3.5 w-3.5" />These are forecast-based personal reminders, not official warnings. Keep this page open for checks; a server-side background alert service is not configured.</div>
        </CardContent></Card>
        <Card><CardHeader><CardTitle className="text-base">Your saved places ({rules.length})</CardTitle></CardHeader><CardContent className="space-y-2">
          {!rules.length ? <p className="text-sm text-muted-foreground">Save a city and choose the limits that matter to you.</p> : rules.map((rule) => {
            const result = monitor.data?.find((item) => item.ruleId === rule.id)?.reading;
            const rainHit = result?.rain3hMm !== null && result?.rain3hMm !== undefined && result.rain3hMm >= rule.rainfall3hMm;
            const windHit = result?.gustKmh !== null && result?.gustKmh !== undefined && result.gustKmh >= rule.windGustKmh;
            return <div key={rule.id} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{rule.name}</p><p className="mt-1 text-xs text-muted-foreground">Alert at {rule.rainfall3hMm} mm rain / 3 hr or {rule.windGustKmh} km/h gust</p></div><Button variant="ghost" size="icon" aria-label={`Remove watch for ${rule.name}`} onClick={() => setRules((current) => current.filter((item) => item.id !== rule.id))}><Trash2 className="h-4 w-4" /></Button></div><p className={`mt-2 text-xs ${rainHit || windHit ? 'font-semibold text-risk-high' : 'text-muted-foreground'}`}>{monitor.isLoading ? 'Checking forecast…' : monitor.isError ? 'Could not check right now; will retry.' : result ? `Next 3 hr rain ${result.rain3hMm?.toFixed(1) ?? '—'} mm · strongest gust ${result.gustKmh?.toFixed(0) ?? '—'} km/h${rainHit || windHit ? ' · Your limit was reached' : ''}` : 'Waiting for next forecast check'}</p></div>;
          })}
        </CardContent></Card>
      </aside>
    </div>
  </FeaturePageLayout>;
};

export default CommunityPage;
