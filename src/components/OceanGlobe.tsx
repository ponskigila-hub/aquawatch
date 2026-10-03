import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import type { EnvironmentalPath, EnvironmentalPoint } from '@/components/EnvironmentalMap';

interface OceanGlobeProps {
  points: EnvironmentalPoint[];
  paths: EnvironmentalPath[];
  center: { lat: number; lng: number };
  zoomed: boolean;
  onPointClick: (point: EnvironmentalPoint) => void;
  onGlobeClick: (coordinate: { lat: number; lng: number }) => void;
}

interface GlobeArc {
  id: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: string;
}

export const OceanGlobe = ({ points, paths, center, zoomed, onPointClick, onGlobeClick }: OceanGlobeProps) => {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 600, height: 520 });
  const [ready, setReady] = useState(false);

  const arcs = useMemo<GlobeArc[]>(() => paths.flatMap((path) => {
    if (path.positions.length < 2) return [];
    const [start, end] = path.positions;
    return [{ id: path.id, startLat: start[0], startLng: start[1], endLat: end[0], endLng: end[1], color: path.color ?? '#55C1FF' }];
  }), [paths]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const resize = () => setSize({ width: element.clientWidth || 600, height: window.innerWidth < 640 ? 380 : 520 });
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    window.addEventListener('resize', resize);
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, []);

  useEffect(() => {
    if (!ready || !globeRef.current) return;
    globeRef.current.pointOfView({ lat: center.lat, lng: center.lng, altitude: zoomed ? 0.82 : 1.75 }, 900);
  }, [center.lat, center.lng, zoomed, ready]);

  const handlePointClick = useCallback((raw: object) => onPointClick(raw as EnvironmentalPoint), [onPointClick]);

  return <div ref={containerRef} className="relative overflow-hidden rounded-2xl border bg-[#102E4A]" style={{ height: size.height }} aria-label="Interactive 3D ocean globe">
    {!ready && <div className="absolute inset-0 z-10 flex items-center justify-center bg-[#102E4A] text-sm text-white/75">Loading 3D globe…</div>}
    <Globe
      ref={globeRef}
      width={size.width}
      height={size.height}
      backgroundColor="#102E4A"
      globeImageUrl="/globe/earth-day.jpg"
      bumpImageUrl="/globe/earth-topology.png"
      atmosphereColor="#55C1FF"
      atmosphereAltitude={0.24}
      onGlobeReady={() => setReady(true)}
      onGlobeClick={(coordinate) => onGlobeClick({ lat: coordinate.lat, lng: coordinate.lng })}
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointColor={(raw: object) => (raw as EnvironmentalPoint).color ?? '#715AFF'}
      pointRadius={(raw: object) => Math.max(0.035, Math.min(0.07, ((raw as EnvironmentalPoint).radius ?? 6) / 120))}
      pointAltitude={0.012}
      pointLabel={(raw: object) => {
        const point = raw as EnvironmentalPoint;
        return point.value ? `${point.label} · ${point.value}${point.detail ? ` · ${point.detail}` : ''}` : `${point.label}${point.detail ? ` · ${point.detail}` : ''}`;
      }}
      onPointClick={handlePointClick}
      arcsData={arcs}
      arcStartLat="startLat"
      arcStartLng="startLng"
      arcEndLat="endLat"
      arcEndLng="endLng"
      arcColor={(raw: object) => [(raw as GlobeArc).color, (raw as GlobeArc).color]}
      arcDashLength={0.32}
      arcDashGap={0.12}
      arcDashInitialGap={(raw: object) => (arcs.findIndex((arc) => arc.id === (raw as GlobeArc).id) % 8) / 8}
      arcDashAnimateTime={1800}
      arcStroke={0.7}
      arcsTransitionDuration={250}
    />
    <div className="pointer-events-none absolute bottom-3 left-3 rounded-lg border border-white/15 bg-[#102E4A]/85 px-3 py-2 text-xs text-white/80 shadow-lg">
      {arcs.length ? 'Animated ocean-flow traces · click the globe to pin a location' : 'Click the globe to pin a location'}
    </div>
  </div>;
};
