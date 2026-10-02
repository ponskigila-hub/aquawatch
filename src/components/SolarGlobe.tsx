import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import * as THREE from 'three';
import type { CelestialSnapshot } from '@/lib/celestial';

export interface SolarGlobeHandle {
  getCanvas: () => HTMLCanvasElement | null;
  setView: (view: { lat: number; lng: number; altitude: number }, durationMs?: number) => void;
}
interface SolarGlobeProps { celestial: CelestialSnapshot; }

export const SolarGlobe = forwardRef<SolarGlobeHandle, SolarGlobeProps>(({ celestial }, forwardedRef) => {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 360, height: 420 });
  const points = [
    { lat: celestial.sun.latitude, lng: celestial.sun.longitude, label: 'Sun directly overhead', color: '#fbbf24', size: 0.18 },
    { lat: celestial.moon.latitude, lng: celestial.moon.longitude, label: `Moon · ${celestial.moonPhase}`, color: '#dbeafe', size: 0.12 },
  ];

  useImperativeHandle(forwardedRef, () => ({
    getCanvas: () => globeRef.current?.renderer().domElement ?? null,
    setView: (view, durationMs = 200) => globeRef.current?.pointOfView(view, durationMs),
  }), []);

  useEffect(() => {
    const resize = () => {
      const width = containerRef.current?.getBoundingClientRect().width ?? 360;
      setSize({ width, height: window.innerWidth < 640 ? 340 : 420 });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    const globe = globeRef.current;
    if (!globe) return;
    const sunLight = new THREE.DirectionalLight(0xfff2cc, 2.0);
    const ambientLight = new THREE.AmbientLight(0x47658f, 0.34);
    const sunPosition = globe.getCoords(celestial.sun.latitude, celestial.sun.longitude, 3.5);
    sunLight.position.set(sunPosition.x, sunPosition.y, sunPosition.z);
    sunLight.target.position.set(0, 0, 0);
    globe.lights([ambientLight, sunLight]);
    globe.pointOfView({ lat: 10, lng: celestial.sun.longitude, altitude: 1.8 }, 700);
  }, [celestial.sun.latitude, celestial.sun.longitude]);

  return <div ref={containerRef} className="solar-globe overflow-hidden rounded-2xl border bg-[#06162d] shadow-lg shadow-sky-950/10" style={{ height: size.height }}>
    <Globe
      ref={globeRef}
      width={size.width}
      height={size.height}
      backgroundColor="#06162d"
      globeImageUrl="/globe/earth-day.jpg"
      bumpImageUrl="/globe/earth-topology.png"
      showAtmosphere
      atmosphereColor="#65c9ff"
      atmosphereAltitude={0.22}
      pointsData={points}
      pointLat="lat"
      pointLng="lng"
      pointColor={(point: object) => (point as { color: string }).color}
      pointAltitude={0.025}
      pointRadius={(point: object) => (point as { size: number }).size}
      pointLabel={(point: object) => (point as { label: string }).label}
      ringsData={[points[0]]}
      ringLat="lat"
      ringLng="lng"
      ringColor={() => (t: number) => `rgba(251,191,36,${1 - t})`}
      ringMaxRadius={2.4}
      ringPropagationSpeed={0.7}
      ringRepeatPeriod={2200}
    />
  </div>;
});
SolarGlobe.displayName = 'SolarGlobe';
