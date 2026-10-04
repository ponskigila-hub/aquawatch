import { useEffect, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import type { DownwindEstimate, EarthquakePoint, ThermalDetection } from '@/lib/environmentalLayers';

interface HazardGlobeProps { earthquakes: EarthquakePoint[]; fires: ThermalDetection[]; initialCenter?: { lat: number; lng: number }; windVectors?: DownwindEstimate[]; onEarthquakeClick?: (event: EarthquakePoint) => void; }
const escape = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char));
const magColor = (magnitude: number) => magnitude >= 5 ? '#ef4444' : magnitude >= 3 ? '#f97316' : '#facc15';

export const HazardGlobe = ({ earthquakes, fires, initialCenter, windVectors = [], onEarthquakeClick }: HazardGlobeProps) => {
  const ref = useRef<GlobeMethods | undefined>(undefined);
  const container = useRef<HTMLDivElement>(null);
  const initialLat = initialCenter?.lat;
  const initialLng = initialCenter?.lng;
  const [size, setSize] = useState({ width: 480, height: 470 });
  const quakePoints = earthquakes.slice(0, 160).map((event) => ({ ...event, kind: 'earthquake' as const }));
  const firePoints = fires.slice(0, 320).map((event) => ({ ...event, kind: 'thermal' as const, magnitude: 0, place: 'Satellite heat detection' }));
  const points = [...quakePoints, ...firePoints];
  const majorQuakes = quakePoints.filter((event) => event.magnitude >= 3.5).slice(0, 40);

  useEffect(() => {
    const resize = () => setSize({ width: container.current?.getBoundingClientRect().width ?? 480, height: window.innerWidth < 640 ? 360 : 470 });
    resize(); window.addEventListener('resize', resize); return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    if (initialLat === undefined || initialLng === undefined) return;
    ref.current?.pointOfView({ lat: initialLat, lng: initialLng, altitude: 1.8 }, 700);
  }, [initialLat, initialLng]);

  return <div ref={container} className="overflow-hidden rounded-2xl border bg-[#06162d] shadow-lg shadow-sky-950/10" style={{ height: size.height }}>
    <Globe
      ref={ref}
      width={size.width}
      height={size.height}
      backgroundColor="#06162d"
      globeImageUrl="/globe/earth-day.jpg"
      bumpImageUrl="/globe/earth-topology.png"
      atmosphereColor="#65c9ff"
      atmosphereAltitude={0.2}
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointColor={(point: object) => { const item = point as { kind: string; magnitude: number }; return item.kind === 'thermal' ? '#fb923c' : magColor(item.magnitude); }}
      pointRadius={(point: object) => { const item = point as { kind: string; magnitude: number }; return item.kind === 'thermal' ? 0.045 : 0.025 + Math.max(0, item.magnitude) * 0.014; }}
      pointAltitude={(point: object) => (point as { kind: string }).kind === 'thermal' ? 0.008 : 0.015}
      pointLabel={(point: object) => { const item = point as EarthquakePoint & { kind: string; fireRadiativePower?: number | null; brightness?: number | null }; return item.kind === 'thermal' ? `<b>Heat detected by satellite</b><br/>Brightness ${item.brightness ?? '—'} · Fire power ${item.fireRadiativePower ?? '—'} MW` : `<b>M${item.magnitude.toFixed(1)} earthquake</b><br/>${escape(item.place)}<br/>Depth ${item.depthKm.toFixed(1)} km`; }}
      arcsData={windVectors}
      arcStartLat="lat"
      arcStartLng="lng"
      arcEndLat="endLat"
      arcEndLng="endLng"
      arcColor={() => ['rgba(251,146,60,0.85)', 'rgba(251,146,60,0.18)']}
      arcStroke={0.35}
      arcDashLength={0.32}
      arcDashGap={0.24}
      arcDashAnimateTime={1500}
      ringsData={majorQuakes}
      ringLat="lat"
      ringLng="lng"
      ringColor={(quake: object) => { const color = magColor((quake as EarthquakePoint).magnitude); return (t: number) => `${color}${Math.round((1 - t) * 255).toString(16).padStart(2, '0')}`; }}
      ringMaxRadius={(quake: object) => Math.min(4, 1.2 + (quake as EarthquakePoint).magnitude * 0.35)}
      ringPropagationSpeed={(quake: object) => 0.4 + (quake as EarthquakePoint).magnitude * 0.08}
      ringRepeatPeriod={1800}
      onPointClick={(point: object) => { const item = point as EarthquakePoint & { kind: string }; if (item.kind === 'earthquake') onEarthquakeClick?.(item); }}
    />
  </div>;
};
