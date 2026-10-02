import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RiskBadge } from '@/components/RiskBadge';
import { WeatherSummary } from '@/components/WeatherSummary';
import { useGlobalCityWeather } from '@/hooks/useGlobalCityWeather';
import { fetchFloodStormEvents, type EonetEvent } from '@/lib/eonet';
import { fetchCityWeather, weatherDescription, type CitySearchResult } from '@/lib/openMeteo';
import type { GlobalCityWeather, LiveAreaWeather, LiveRegionWeather } from '@/lib/globalWeather';
import { ExternalLink, Loader2, MapPin, X } from 'lucide-react';

const riskColors: Record<string, string> = { safe: '#22c55e', medium: '#f59e0b', high: '#ef4444' };
const disasterColors: Record<string, string> = { Floods: '#38bdf8', 'Severe Storms': '#a855f7' };
const disasterColor = (category: string) => disasterColors[category] ?? '#fb923c';
const popupStyles = `
  .weather-popup .leaflet-popup-content-wrapper { border-radius: 10px; }
  .weather-popup .leaflet-popup-content { margin: 12px 14px; }
  .leaflet-interactive { cursor: pointer; }
`;

interface RiskMap2DProps {
  searchedCity?: CitySearchResult | null;
  initialCenter?: { lat: number; lng: number } | null;
  regionWeather?: LiveRegionWeather;
  regionLabel?: string;
}

type SelectedMapPoint =
  | { kind: 'city'; city: GlobalCityWeather }
  | { kind: 'area'; area: LiveAreaWeather }
  | { kind: 'searched'; city: CitySearchResult }
  | { kind: 'event'; event: EonetEvent };

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] ?? character));

const cityPopup = (city: GlobalCityWeather) => `
  <div style="min-width:210px;font-family:inherit;line-height:1.55">
    <strong style="font-size:15px">${escapeHtml(city.name)}</strong><br/>
    <span style="color:#64748b">${escapeHtml(city.admin1 ? `${city.admin1}, ` : '')}${escapeHtml(city.country)}</span>
    <div style="margin-top:6px;font-size:14px"><strong>${city.temperatureC === null ? '—' : `${Math.round(city.temperatureC)}°C`}</strong> · ${escapeHtml(weatherDescription(city.weatherCode))}</div>
    <div style="font-size:12px">High ${city.todayHighC === null ? '—' : `${Math.round(city.todayHighC)}°C`} · Low ${city.todayLowC === null ? '—' : `${Math.round(city.todayLowC)}°C`}</div>
    <div style="margin-top:5px;font-size:12px">Rain today ${city.dailyRainfallMm === null ? '—' : `${city.dailyRainfallMm.toFixed(1)} mm`} · ${city.rainChancePercent === null ? '—' : `${Math.round(city.rainChancePercent)}% chance`}</div>
    <div style="font-size:12px">Wind ${city.windKph === null ? '—' : `${Math.round(city.windKph)} km/h`} · Humidity ${city.humidityPercent === null ? '—' : `${Math.round(city.humidityPercent)}%`}</div>
    <span style="display:inline-block;margin-top:6px;border-radius:999px;padding:1px 8px;background:${riskColors[city.riskLevel]};color:white;font-size:11px">${city.riskLevel === 'safe' ? 'Low rain' : city.riskLevel === 'medium' ? 'Rain watch' : 'Heavy rain'}</span>
  </div>`;

const areaPopup = (area: LiveAreaWeather) => `
  <div style="min-width:200px;font-family:inherit;line-height:1.55">
    <strong style="font-size:15px">${escapeHtml(area.name)}</strong><br/>
    <span style="color:#64748b">${escapeHtml(area.admin1 ? `${area.admin1}, ` : '')}${escapeHtml(area.country)}</span>
    <div style="margin-top:6px;font-size:13px">${area.temperatureC === null ? '—' : `${Math.round(area.temperatureC)}°C`} · ${escapeHtml(weatherDescription(area.weatherCode))}</div>
    <div style="font-size:12px">Today ${area.latestDailyRainfallMm === null ? '—' : `${area.latestDailyRainfallMm.toFixed(1)} mm rain`}</div>
    <div style="font-size:12px">High ${area.todayHighC === null ? '—' : `${Math.round(area.todayHighC)}°C`} · Low ${area.todayLowC === null ? '—' : `${Math.round(area.todayLowC)}°C`}</div>
    <div style="font-size:12px">Rain chance ${area.rainChancePercent === null ? '—' : `${Math.round(area.rainChancePercent)}%`} · Wind ${area.windKph === null ? '—' : `${Math.round(area.windKph)} km/h`}</div>
    <span style="display:inline-block;margin-top:6px;border-radius:999px;padding:1px 8px;background:${riskColors[area.riskLevel]};color:white;font-size:11px">${area.riskLevel === 'safe' ? 'Low rain' : area.riskLevel === 'medium' ? 'Rain watch' : 'Heavy rain'}</span>
  </div>`;

export const RiskMap2D = ({ searchedCity, initialCenter, regionWeather, regionLabel = 'Jakarta, Indonesia' }: RiskMap2DProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const searchedMarkerRef = useRef<L.CircleMarker | null>(null);
  const [height, setHeight] = useState(420);
  const [selected, setSelected] = useState<SelectedMapPoint | null>(null);
  const { data: globalCities = [], isLoading: globalLoading } = useGlobalCityWeather();
  const { data: disasterEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['eonet-flood-storm-events'], queryFn: fetchFloodStormEvents, staleTime: 15 * 60 * 1000, retry: 1,
  });
  const selectedWeatherLocation = selected?.kind === 'city' ? selected.city
    : selected?.kind === 'area' ? selected.area
      : selected?.kind === 'searched' ? selected.city : null;
  const selectedWeatherQuery = useQuery({
    queryKey: ['selected-map-weather', selectedWeatherLocation?.lat, selectedWeatherLocation?.lng],
    queryFn: () => {
      if (!selectedWeatherLocation) throw new Error('No selected location.');
      return fetchCityWeather(selectedWeatherLocation.lat, selectedWeatherLocation.lng);
    },
    enabled: !!selectedWeatherLocation,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    const updateHeight = () => setHeight(window.innerWidth < 640 ? 340 : window.innerWidth < 1024 ? 420 : 500);
    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  useEffect(() => {
    if (!map.current) return;
    const timer = window.setTimeout(() => map.current?.invalidateSize(), 0);
    return () => window.clearTimeout(timer);
  }, [height]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;
    if (!document.getElementById('weather-popup-style')) {
      const style = document.createElement('style');
      style.id = 'weather-popup-style';
      style.textContent = popupStyles;
      document.head.appendChild(style);
    }
    const start = initialCenter ?? (searchedCity ? { lat: searchedCity.lat, lng: searchedCity.lng } : null);
    map.current = L.map(mapContainer.current, { worldCopyJump: true })
      .setView(start ? [start.lat, start.lng] : [18, 8], start ? (initialCenter ? 11 : 7) : 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18, noWrap: false,
    }).addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
    // The map is initialized once; later selection changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!map.current || !initialCenter) return;
    map.current.flyTo([initialCenter.lat, initialCenter.lng], 12, { duration: 0.8 });
  }, [initialCenter]);

  useEffect(() => {
    if (!map.current) return;
    const layer = L.layerGroup().addTo(map.current);
    globalCities.forEach((city) => {
      if (city.temperatureC === null && city.dailyRainfallMm === null) return;
      const color = riskColors[city.riskLevel] ?? riskColors.safe;
      const marker = L.circleMarker([city.lat, city.lng], { radius: 6, color, fillColor: color, fillOpacity: 0.85, weight: 1.5 }).addTo(layer);
      marker.bindTooltip(`${city.name}, ${city.country}`, { direction: 'top', opacity: 0.95 });
      marker.bindPopup(cityPopup(city), { className: 'weather-popup', maxWidth: 280 });
      marker.on('click', () => {
        setSelected({ kind: 'city', city });
        map.current?.flyTo([city.lat, city.lng], Math.max(map.current.getZoom(), 6), { duration: 0.65 });
      });
    });
    return () => { layer.remove(); };
  }, [globalCities]);

  useEffect(() => {
    if (!map.current) return;
    const layer = L.layerGroup().addTo(map.current);
    (regionWeather?.areas ?? []).forEach((area) => {
      const color = riskColors[area.riskLevel] ?? riskColors.safe;
      const marker = L.circleMarker([area.lat, area.lng], { radius: 9, color: '#fff', fillColor: color, fillOpacity: 0.95, weight: 2 }).addTo(layer);
      marker.bindTooltip(area.name, { direction: 'top', opacity: 0.95 });
      marker.bindPopup(areaPopup(area), { className: 'weather-popup', maxWidth: 280 });
      marker.on('click', () => setSelected({ kind: 'area', area }));
    });
    return () => { layer.remove(); };
  }, [regionWeather]);

  useEffect(() => {
    if (!map.current) return;
    const layer = L.layerGroup().addTo(map.current);
    disasterEvents.forEach((event) => {
      const color = disasterColor(event.category);
      const marker = L.circleMarker([event.lat, event.lng], { radius: 7, color, fillColor: color, fillOpacity: 0.8, weight: 2 }).addTo(layer);
      marker.bindTooltip(event.title, { direction: 'top', opacity: 0.95 });
      marker.bindPopup(`<div style="min-width:180px"><strong>${escapeHtml(event.title)}</strong><br/><span>${escapeHtml(event.category)}</span><br/><a href="${escapeHtml(event.link)}" target="_blank" rel="noopener noreferrer">View event source</a></div>`, { className: 'weather-popup' });
      marker.on('click', () => setSelected({ kind: 'event', event }));
    });
    return () => { layer.remove(); };
  }, [disasterEvents]);

  useEffect(() => {
    if (!map.current) return;
    searchedMarkerRef.current?.remove();
    searchedMarkerRef.current = null;
    if (!searchedCity) {
      setSelected((previous) => previous?.kind === 'searched' ? null : previous);
      return;
    }
    if (!initialCenter) map.current.flyTo([searchedCity.lat, searchedCity.lng], 7, { duration: 0.8 });
    const marker = L.circleMarker([searchedCity.lat, searchedCity.lng], { radius: 11, color: '#fff', fillColor: '#0ea5e9', fillOpacity: 1, weight: 3 }).addTo(map.current);
    marker.bindTooltip(`${searchedCity.name}, ${searchedCity.country}`, { direction: 'top' });
    marker.bindPopup(`<strong>${escapeHtml(searchedCity.name)}</strong><br/>${escapeHtml(searchedCity.country)}<br/>Loading local weather…`, { className: 'weather-popup' });
    marker.on('click', () => setSelected({ kind: 'searched', city: searchedCity }));
    searchedMarkerRef.current = marker;
    setSelected({ kind: 'searched', city: searchedCity });
    return () => { marker.remove(); };
  }, [searchedCity, initialCenter]);

  return (
    <div className="space-y-3">
      <Card className="overflow-hidden">
        <div ref={mapContainer} className="w-full" style={{ height }} />
        <CardContent className="space-y-2 border-t bg-muted/40 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: riskColors.safe }} />Low rain</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: riskColors.medium }} />Rain watch</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: riskColors.high }} />Heavy rain</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: disasterColors.Floods }} />Flood event</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: disasterColors['Severe Storms'] }} />Storm</span>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">{globalLoading ? 'Loading weather for cities around the world…' : `${globalCities.length} cities across many countries`} · {eventsLoading ? 'Loading events…' : `${disasterEvents.length} live flood and storm events`} · Click a city for details.</p>
        </CardContent>
      </Card>

      {selected && <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
          <div className="flex min-w-0 items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><div className="min-w-0"><CardTitle className="text-base">{selected.kind === 'city' ? selected.city.name : selected.kind === 'area' ? selected.area.name : selected.kind === 'searched' ? selected.city.name : selected.event.title}</CardTitle><CardDescription>{selected.kind === 'city' ? selected.city.country : selected.kind === 'area' ? `${selected.area.admin1 ? `${selected.area.admin1}, ` : ''}${selected.area.country}` : selected.kind === 'searched' ? `${selected.city.admin1 ? `${selected.city.admin1}, ` : ''}${selected.city.country}` : selected.event.category}</CardDescription></div></div>
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Close location details" onClick={() => setSelected(null)}><X className="h-4 w-4" /></Button>
        </CardHeader>
        <CardContent className="pt-0">
          {selected.kind === 'event' ? <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">A reported {selected.event.category.toLowerCase()} event from NASA.</p>{selected.event.link && <Button asChild variant="outline" size="sm" className="gap-1.5"><a href={selected.event.link} target="_blank" rel="noopener noreferrer">View event <ExternalLink className="h-3.5 w-3.5" /></a></Button>}</div>
            : selectedWeatherQuery.isLoading ? <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading local weather…</div>
              : selectedWeatherQuery.data ? <WeatherSummary weather={selectedWeatherQuery.data} />
                : <p className="py-4 text-sm text-muted-foreground">Weather details are temporarily unavailable.</p>}
          {(selected.kind === 'area' || selected.kind === 'city') && <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><RiskBadge level={selected.kind === 'area' ? selected.area.riskLevel : selected.city.riskLevel} showIcon={false} /><span className="text-muted-foreground">Rain estimate for today · live weather update</span></div>}
          {selected.kind === 'area' && selected.area.latestDischargeM3s !== null && <p className="mt-2 text-xs text-muted-foreground">Nearby river flow: <strong className="text-foreground">{selected.area.latestDischargeM3s.toFixed(1)} m³/s</strong></p>}
        </CardContent>
      </Card>}
      <p className="text-center text-[11px] text-muted-foreground">Weather is estimated. Flood and storm markers are reported events. Map view: {regionLabel}.</p>
    </div>
  );
};
