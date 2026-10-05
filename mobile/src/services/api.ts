import axios from 'axios';

const trimBaseUrl = (value: string | undefined) => (value ?? '').trim().replace(/\/+$/, '');
export const envApiBaseUrl = trimBaseUrl(process.env.EXPO_PUBLIC_API_URL);
export const envWebAppBaseUrl = trimBaseUrl(process.env.EXPO_PUBLIC_WEB_APP_URL);

export const api = axios.create({
  baseURL: envApiBaseUrl || undefined,
  timeout: 15_000,
  headers: { Accept: 'application/json' },
});

export function setApiBaseUrl(value: string) {
  api.defaults.baseURL = trimBaseUrl(value) || undefined;
}

export function setWebAppBaseUrl(value: string) {
  return trimBaseUrl(value);
}

export const normalizeBaseUrl = trimBaseUrl;
export const isApiConfigured = () => Boolean(api.defaults.baseURL);
