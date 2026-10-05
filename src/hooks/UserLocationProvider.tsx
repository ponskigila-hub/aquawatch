/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { CitySearchResult } from '@/lib/openMeteo';

export interface UserLocation {
  lat: number;
  lng: number;
  accuracyMeters: number | null;
  timestamp: number;
}

export type UserLocationStatus = 'locating' | 'available' | 'denied' | 'unavailable' | 'unsupported';

interface UserLocationValue {
  location: UserLocation | null;
  status: UserLocationStatus;
  statusMessage: string | null;
  requestLocation: () => void;
}

const UserLocationContext = createContext<UserLocationValue>({
  location: null,
  status: 'locating',
  statusMessage: null,
  requestLocation: () => undefined,
});

export function browserLocationAsCity(location: UserLocation | null): CitySearchResult | null {
  if (!location) return null;
  return {
    id: -1,
    name: 'Your location',
    country: '',
    lat: location.lat,
    lng: location.lng,
  };
}

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const initialAppPosition = useRef<UserLocation | null>(null);
  if (initialAppPosition.current === null && typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    const lat = Number(params.get('aw_position_lat'));
    const lng = Number(params.get('aw_position_lng'));
    if (Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lng) && lng >= -180 && lng <= 180 && params.has('aw_position_lat') && params.has('aw_position_lng')) {
      initialAppPosition.current = { lat, lng, accuracyMeters: null, timestamp: Date.now() };
    }
  }
  const [state, setState] = useState<Omit<UserLocationValue, 'requestLocation'>>(() => ({
    location: initialAppPosition.current,
    status: initialAppPosition.current ? 'available' : 'locating',
    statusMessage: null,
  }));
  const autoRequestStarted = useRef(false);

  const requestLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState((previous) => ({
        ...previous,
        status: previous.location ? 'available' : 'unsupported',
        statusMessage: 'This browser does not provide device location. Using the app’s fallback area.',
      }));
      return;
    }

    setState((previous) => ({ ...previous, status: 'locating', statusMessage: null }));
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          setState((previous) => ({
            ...previous,
            status: previous.location ? 'available' : 'unavailable',
            statusMessage: 'The browser returned invalid coordinates. Using the app’s fallback area.',
          }));
          return;
        }
        setState({
          location: {
            lat,
            lng,
            accuracyMeters: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
            timestamp: position.timestamp || Date.now(),
          },
          status: 'available',
          statusMessage: null,
        });
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        setState((previous) => ({
          ...previous,
          status: previous.location ? 'available' : denied ? 'denied' : 'unavailable',
          statusMessage: previous.location
            ? 'Could not refresh the saved-in-memory position; continuing to use the last fix.'
            : denied
              ? 'Location permission was not granted. Using the app’s fallback area; you can change permission in browser settings.'
              : 'The browser could not determine your position. Using the app’s fallback area.',
        }));
      },
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  useEffect(() => {
    if (autoRequestStarted.current) return;
    autoRequestStarted.current = true;
    if (initialAppPosition.current) return;
    requestLocation();
  }, [requestLocation]);

  return (
    <UserLocationContext.Provider value={{ ...state, requestLocation }}>
      {children}
    </UserLocationContext.Provider>
  );
}

export function useUserLocation(): UserLocationValue {
  return useContext(UserLocationContext);
}
