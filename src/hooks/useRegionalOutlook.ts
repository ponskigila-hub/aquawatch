import { useQuery } from '@tanstack/react-query';
import { fetchRegionalOutlook, getRegionalLocations } from '@/lib/globalWeather';
import type { CitySearchResult } from '@/lib/openMeteo';

export function useRegionalOutlook(city?: CitySearchResult | null) {
  const locations = getRegionalLocations(city);
  const isJakarta = city?.name.toLowerCase() === 'jakarta' && city.country.toLowerCase() === 'indonesia';
  const regionKey = city && !isJakarta ? `city-${city.id}-${city.lat.toFixed(3)}-${city.lng.toFixed(3)}` : 'jakarta';

  return useQuery({
    queryKey: ['regional-weather-outlook', regionKey],
    queryFn: () => fetchRegionalOutlook(locations),
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  });
}
