import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface EnvironmentalPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  detail?: string;
  value?: string;
  color?: string;
  radius?: number;
}

export interface EnvironmentalPath {
  id: string;
  positions: Array<[number, number]>;
  color?: string;
  label?: string;
}

interface EnvironmentalMapProps {
  points: EnvironmentalPoint[];
  paths?: EnvironmentalPath[];
  height?: number;
  center?: { lat: number; lng: number };
  zoom?: number;
  onMapClick?: (point: { lat: number; lng: number }) => void;
  onPointClick?: (point: EnvironmentalPoint) => void;
  emptyLabel?: string;
}

const safeText = (value: string) => value.replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character] ?? character));

export const EnvironmentalMap = ({ points, paths = [], height = 430, center = { lat: 15, lng: 0 }, zoom = 2, onMapClick, onPointClick, emptyLabel = 'No layer data is available right now.' }: EnvironmentalMapProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const pathsRef = useRef<L.LayerGroup | null>(null);
  const clickRef = useRef(onMapClick);
  const pointClickRef = useRef(onPointClick);

  useEffect(() => { clickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { pointClickRef.current = onPointClick; }, [onPointClick]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { worldCopyJump: true, zoomControl: true, preferCanvas: true }).setView([center.lat, center.lng], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors', maxZoom: 18, noWrap: false,
    }).addTo(map);
    markersRef.current = L.layerGroup().addTo(map);
    pathsRef.current = L.layerGroup().addTo(map);
    map.on('click', (event: L.LeafletMouseEvent) => clickRef.current?.({ lat: event.latlng.lat, lng: event.latlng.lng }));
    mapRef.current = map;
    const resize = () => map.invalidateSize();
    window.addEventListener('resize', resize);
    const timer = window.setTimeout(resize, 80);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', resize);
      map.remove();
      mapRef.current = null;
      markersRef.current = null;
      pathsRef.current = null;
    };
    // This component initializes the map once; controlled center changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.setView([center.lat, center.lng], zoom, { animate: true });
  }, [center.lat, center.lng, zoom]);

  useEffect(() => {
    const group = markersRef.current;
    if (!group) return;
    group.clearLayers();
    for (const point of points) {
      if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) continue;
      const marker = L.circleMarker([point.lat, point.lng], {
        radius: point.radius ?? 7,
        color: '#ffffff',
        fillColor: point.color ?? '#0284c7',
        fillOpacity: 0.88,
        weight: 1.5,
      }).addTo(group);
      marker.bindTooltip(safeText(point.label), { direction: 'top', opacity: 0.96 });
      if (point.detail || point.value) {
        marker.bindPopup(`<strong>${safeText(point.label)}</strong>${point.detail ? `<br/>${safeText(point.detail)}` : ''}${point.value ? `<br/><b>${safeText(point.value)}</b>` : ''}`, { maxWidth: 280 });
      }
      marker.on('click', () => pointClickRef.current?.(point));
    }
  }, [points]);

  useEffect(() => {
    const group = pathsRef.current;
    if (!group) return;
    group.clearLayers();
    for (const path of paths) {
      const positions = path.positions.filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
      if (positions.length < 2) continue;
      const line = L.polyline(positions, { color: path.color ?? '#f59e0b', weight: 3, opacity: 0.88, lineCap: 'round' }).addTo(group);
      if (path.label) line.bindTooltip(safeText(path.label));
    }
  }, [paths]);

  return <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
    <div ref={containerRef} style={{ height }} className="z-0 w-full" aria-label="Interactive global environmental map" />
    {!points.length && !paths.length && <div className="pointer-events-none absolute bottom-3 left-1/2 z-[400] -translate-x-1/2 rounded-full border bg-background/95 px-3 py-1.5 text-xs text-muted-foreground shadow">{emptyLabel}</div>}
  </div>;
};
