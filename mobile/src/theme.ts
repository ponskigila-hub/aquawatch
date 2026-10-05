export const colors = {
  periwinkle: '#A682FF',
  slateBlue: '#715AFF',
  cornflower: '#5887FF',
  maya: '#55C1FF',
  deep: '#102E4A',
  deepRaised: '#173B5B',
  panel: '#1A4568',
  panelSoft: '#204F75',
  text: '#F6F7FF',
  muted: '#B7C6DA',
  line: 'rgba(255,255,255,0.12)',
  amber: '#F4B544',
  green: '#44D19A',
  red: '#FF7180',
  white: '#FFFFFF',
} as const;

export type ScreenKey = 'overview' | 'map' | 'forecast' | 'hazards' | 'hazards-web' | 'ocean' | 'ocean-web' | 'more' | 'air-quality' | 'history' | 'community' | 'tools';
export interface Coordinates { latitude: number; longitude: number; }
export interface WeatherHour {
  time: string;
  temperatureC: number | null;
  rainChance: number | null;
  weatherCode: number | null;
  windKph: number | null;
  humidity: number | null;
}
export interface WeatherSnapshot {
  temperatureC: number | null;
  feelsLikeC: number | null;
  humidity: number | null;
  windKph: number | null;
  precipitationMm: number | null;
  weatherCode: number | null;
  highC: number | null;
  lowC: number | null;
  rainChance: number | null;
  rainTodayMm: number | null;
  hourly: WeatherHour[];
  daily: Array<{ date: string; highC: number | null; lowC: number | null; rainMm: number | null; rainChance: number | null; weatherCode: number | null }>;
}
export interface Earthquake { id: string; place: string; magnitude: number; depthKm: number; occurredAt: string; url: string; }
export interface MarineSnapshot {
  time: string;
  waveHeightM: number | null;
  swellHeightM: number | null;
  currentKmh: number | null;
  waveDirection: number | null;
  swellDirection: number | null;
  currentDirection: number | null;
  seaSurfaceC?: number | null;
  anomalyC?: number | null;
  sstDate?: string | null;
}
