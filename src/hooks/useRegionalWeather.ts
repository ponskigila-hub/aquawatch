import { useQuery } from '@tanstack/react-query';
import { fetchRegionalWeather, getRegionalLocations } from '@/lib/globalWeather';
import type { CitySearchResult } from '@/lib/openMeteo';

export function useRegionalWeather(city?: CitySearchResult | null) {
  const locations = getRegionalLocations(city);
  const isJakarta = city?.name.toLowerCase() === 'jakarta' && city.country.toLowerCase() === 'indonesia';
  const regionKey = city && !isJakarta ? `city-${city.id}-${city.lat.toFixed(3)}-${city.lng.toFixed(3)}` : 'jakarta';

  return useQuery({
    queryKey: ['regional-live-weather', regionKey],
    queryFn: () => fetchRegionalWeather(locations),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    retry: 1,
  });
}
