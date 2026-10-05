import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { Coordinates } from '../theme';

export const FALLBACK_LOCATION: Coordinates = { latitude: -6.2088, longitude: 106.8456 };

export function useDeviceLocation() {
  const [location, setLocation] = useState<Coordinates>(FALLBACK_LOCATION);
  const [usingDeviceLocation, setUsingDeviceLocation] = useState(false);
  const [status, setStatus] = useState<'loading' | 'available' | 'denied' | 'unavailable'>('loading');

  const requestLocation = useCallback(async () => {
    setStatus('loading');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setUsingDeviceLocation(false);
        setLocation(FALLBACK_LOCATION);
        setStatus('denied');
        return;
      }
      const last = await Location.getLastKnownPositionAsync();
      if (last) {
        setLocation({ latitude: last.coords.latitude, longitude: last.coords.longitude });
        setUsingDeviceLocation(true);
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
      setUsingDeviceLocation(true);
      setStatus('available');
    } catch {
      setStatus('unavailable');
    }
  }, []);

  useEffect(() => { void requestLocation(); }, [requestLocation]);

  return { location, usingDeviceLocation, status, requestLocation };
}
