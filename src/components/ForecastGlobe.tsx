import { useEffect, useRef, useState } from 'react';
import Globe, { type GlobeMethods } from 'react-globe.gl';
import type { ForecastFeature } from '@/lib/forecast';

interface ForecastGlobeProps {
  features: ForecastFeature[];
  center: { lat: number; lng: number };
}

const colorForValue = (value: number) => {
  if (value < 0.25) return '#38bdf8';
  if (value < 0.5) return '#22d3ee';
  if (value < 0.75) return '#facc15';
  return '#fb7185';
};

export const ForecastGlobe = ({ features, center }: ForecastGlobeProps) => {
  const globeRef = useRef<GlobeMethods | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 320, height: 540 });
  const points = features.map((feature) => ({
    lat: feature.geometry.coordinates[1],
    lng: feature.geometry.coordinates[0],
    prediction: feature.properties.prediction,
    row: feature.properties.row,
    column: feature.properties.column,
  }));

  useEffect(() => {
    const resize = () => {
      if (!containerRef.current) return;
      const { width } = containerRef.current.getBoundingClientRect();
      setDimensions({ width, height: window.innerWidth < 640 ? 390 : 540 });
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  useEffect(() => {
    globeRef.current?.pointOfView({ lat: center.lat, lng: center.lng, altitude: 1.6 }, 900);
    const controls = globeRef.current?.controls();
    if (controls) {
      controls.autoRotate = false;
      controls.enableZoom = true;
    }
  }, [center.lat, center.lng]);

  return (
    <div ref={containerRef} className="w-full rounded-xl overflow-hidden bg-[#0a1128]" style={{ height: dimensions.height }}>
      <Globe
        ref={globeRef}
        width={dimensions.width}
        height={dimensions.height}
        backgroundColor="#0a1128"
        globeImageUrl="/globe/earth-day.jpg"
        bumpImageUrl="/globe/earth-topology.png"
        atmosphereColor="#7dd3fc"
        atmosphereAltitude={0.28}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={(point: object) => colorForValue((point as { prediction: number }).prediction)}
        pointAltitude={0.018}
        pointRadius={0.075}
        pointLabel={(point: object) => {
          const value = (point as { prediction: number }).prediction;
          return `<div style="font-family:inherit;background:rgba(15,23,42,.94);color:white;padding:7px 10px;border-radius:7px;font-size:12px"><b>Model output</b><br/>Normalized value ${value.toFixed(3)}</div>`;
        }}
      />
    </div>
  );
};
