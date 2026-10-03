import type { EnvironmentalPath } from '@/components/EnvironmentalMap';
import type { MarinePoint } from '@/lib/environmentalLayers';

export type MarineVisualMetric = 'waveHeightM' | 'swellHeightM' | 'currentKmh';

type RasterSample = { lat: number; lng: number; value: number | null };
type ColorStop = { value: number; color: string };

const WIDTH = 360;
const HEIGHT = 180;
const MAX_DISTANCE_DEG = 26;
const WATER_MASK_URL = '/api/ocean/oisst/raster?metric=sst';
let waterMaskPromise: Promise<Uint8Array | null> | null = null;

const colorStops: Record<MarineVisualMetric, ColorStop[]> = {
  waveHeightM: [
    { value: 0, color: '#55C1FF' }, { value: 2, color: '#48C6A3' },
    { value: 4, color: '#F3D453' }, { value: 7, color: '#F28C44' }, { value: 10, color: '#DC4256' },
  ],
  swellHeightM: [
    { value: 0, color: '#55C1FF' }, { value: 2, color: '#48C6A3' },
    { value: 4, color: '#F3D453' }, { value: 7, color: '#F28C44' }, { value: 10, color: '#DC4256' },
  ],
  currentKmh: [
    { value: 0, color: '#55C1FF' }, { value: 0.5, color: '#48C6A3' },
    { value: 1.5, color: '#F3D453' }, { value: 3, color: '#F28C44' }, { value: 5, color: '#DC4256' },
  ],
};

function hexRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];
}

function colorAt(value: number, stops: ColorStop[]): [number, number, number] {
  const bounded = Math.max(stops[0].value, Math.min(stops[stops.length - 1].value, value));
  const upperIndex = stops.findIndex((stop) => stop.value >= bounded);
  const upper = upperIndex <= 0 ? stops[0] : stops[upperIndex];
  const lower = upperIndex <= 0 ? stops[0] : stops[upperIndex - 1];
  const lowerRgb = hexRgb(lower.color);
  const upperRgb = hexRgb(upper.color);
  const portion = upper.value === lower.value ? 0 : (bounded - lower.value) / (upper.value - lower.value);
  return lowerRgb.map((channel, index) => Math.round(channel + (upperRgb[index] - channel) * portion)) as [number, number, number];
}

async function loadNoaaWaterMask(): Promise<Uint8Array | null> {
  if (!waterMaskPromise) {
    waterMaskPromise = (async () => {
      const response = await fetch(WATER_MASK_URL, { headers: { Accept: 'image/png' } });
      if (!response.ok) throw new Error('NOAA ocean mask is unavailable.');
      const image = new Image();
      const objectUrl = URL.createObjectURL(await response.blob());
      try {
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error('NOAA ocean mask could not be decoded.'));
          image.src = objectUrl;
        });
        const canvas = document.createElement('canvas');
        canvas.width = WIDTH;
        canvas.height = HEIGHT;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas is unavailable.');
        context.drawImage(image, 0, 0, WIDTH, HEIGHT);
        const pixels = context.getImageData(0, 0, WIDTH, HEIGHT).data;
        const mask = new Uint8Array(WIDTH * HEIGHT);
        for (let pixel = 0; pixel < mask.length; pixel += 1) mask[pixel] = pixels[pixel * 4 + 3];
        if (!mask.some((alpha) => alpha > 0)) throw new Error('NOAA ocean mask contained no water cells.');
        return mask;
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    })().catch(() => {
      waterMaskPromise = null;
      return null;
    });
  }
  return waterMaskPromise;
}

/** Build a smooth display interpolation from observed hourly marine model points. */
export async function buildMarineHeatmap(
  samples: RasterSample[],
  metric: MarineVisualMetric,
): Promise<string | null> {
  const valid = samples.filter((sample) => Number.isFinite(sample.value) && Number.isFinite(sample.lat) && Number.isFinite(sample.lng));
  if (!valid.length) return null;
  const waterMask = await loadNoaaWaterMask();
  if (!waterMask) return null;

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;
  const image = context.createImageData(WIDTH, HEIGHT);
  const stops = colorStops[metric];
  const cosCache = new Float32Array(HEIGHT);
  for (let y = 0; y < HEIGHT; y += 1) {
    const mercatorY = Math.PI * (1 - 2 * (y + 0.5) / HEIGHT);
    const latitude = Math.atan(Math.sinh(mercatorY)) * 180 / Math.PI;
    cosCache[y] = Math.max(0.14, Math.cos(latitude * Math.PI / 180));
  }

  for (let y = 0; y < HEIGHT; y += 1) {
    const mercatorY = Math.PI * (1 - 2 * (y + 0.5) / HEIGHT);
    const latitude = Math.atan(Math.sinh(mercatorY)) * 180 / Math.PI;
    const cosLatitude = cosCache[y];
    for (let x = 0; x < WIDTH; x += 1) {
      const pixelIndex = y * WIDTH + x;
      const waterAlpha = waterMask[pixelIndex];
      if (waterAlpha < 16) continue;
      const longitude = -180 + (x + 0.5) * 360 / WIDTH;
      let weightedSum = 0;
      let weightTotal = 0;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (const sample of valid) {
        const rawDelta = longitude - sample.lng;
        const deltaLongitude = ((rawDelta + 540) % 360) - 180;
        const dx = deltaLongitude * cosLatitude;
        const dy = latitude - sample.lat;
        const squaredDistance = dx * dx + dy * dy;
        const distance = Math.sqrt(squaredDistance);
        if (distance < nearestDistance) nearestDistance = distance;
        const weight = 1 / Math.pow(squaredDistance + 6, 1.25);
        weightedSum += (sample.value as number) * weight;
        weightTotal += weight;
      }
      if (nearestDistance > MAX_DISTANCE_DEG || weightTotal === 0) continue;
      const value = weightedSum / weightTotal;
      const [red, green, blue] = colorAt(value, stops);
      const proximity = Math.max(0.2, 1 - Math.max(0, nearestDistance - 10) / 34);
      const alpha = Math.round(waterAlpha * 0.76 * proximity);
      const offset = pixelIndex * 4;
      image.data[offset] = red;
      image.data[offset + 1] = green;
      image.data[offset + 2] = blue;
      image.data[offset + 3] = alpha;
    }
  }
  context.putImageData(image, 0, 0);
  return canvas.toDataURL('image/png');
}

function activeHour(point: MarinePoint, hour: number) {
  return point.forecast[Math.min(Math.max(0, hour), point.forecast.length - 1)] ?? point;
}

/** Return short, correctly directed paths for map SVGs and WebGL globe arcs. */
export function buildOceanFlowPaths(
  points: MarinePoint[],
  metric: 'currentKmh' | 'swellHeightM',
  hour: number,
): EnvironmentalPath[] {
  const paths: EnvironmentalPath[] = [];
  for (const point of points) {
    const current = activeHour(point, hour);
    const speed = metric === 'currentKmh' ? current.currentKmh : current.swellHeightM;
    const direction = metric === 'currentKmh' ? current.currentDirectionDeg
      : current.swellDirectionDeg === null ? null : (current.swellDirectionDeg + 180) % 360;
    if (speed === null || direction === null || speed <= 0) continue;
    const radians = direction * Math.PI / 180;
    const length = Math.min(7, Math.max(1.8, speed * (metric === 'currentKmh' ? 0.9 : 1.15)));
    const endLat = Math.max(-84.5, Math.min(84.5, point.lat + Math.cos(radians) * length));
    const longitudeScale = Math.max(0.14, Math.cos(point.lat * Math.PI / 180));
    const rawEndLng = point.lng + Math.sin(radians) * length / longitudeScale;
    const endLng = ((rawEndLng + 540) % 360) - 180;
    if (Math.abs(endLng - point.lng) > 180) continue;
    paths.push({
      id: `${point.id}-${metric}`,
      positions: [[point.lat, point.lng], [endLat, endLng]],
      color: metric === 'currentKmh' ? '#55C1FF' : '#A682FF',
      label: metric === 'currentKmh' ? `Current flow · ${point.name}` : `Swell direction · ${point.name}`,
      animated: true,
    });
  }
  return paths;
}
