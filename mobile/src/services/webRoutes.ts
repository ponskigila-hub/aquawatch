import type { Coordinates, ScreenKey } from '../theme';

const paths: Partial<Record<ScreenKey, string>> = {
  'air-quality': '/air-quality', history: '/history', community: '/community', tools: '/tools', hazards: '/hazards', ocean: '/ocean', forecast: '/forecast',
};

export function buildMapUrl(base: string, location: Coordinates, mode: '2d' | '3d', refresh = 0) {
  if (!base) return '';
  const query = new URLSearchParams({ lat: String(location.latitude), lng: String(location.longitude), mode, refresh: String(refresh), aw_position_lat: String(location.latitude), aw_position_lng: String(location.longitude) });
  return `${base.replace(/\/+$/, '')}/mobile-map?${query.toString()}`;
}

export function buildFeatureUrl(base: string, route: ScreenKey, location: Coordinates) {
  if (!base) return '';
  const query = new URLSearchParams({ aw_position_lat: String(location.latitude), aw_position_lng: String(location.longitude) });
  return `${base.replace(/\/+$/, '')}${paths[route] ?? '/'}?${query.toString()}`;
}
