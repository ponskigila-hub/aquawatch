import { useQuery } from '@tanstack/react-query';
import { fetchRegionalOutlook, getRegionalLocations } from '@/lib/globalWeather';
import type { CitySearchResult } from '@/lib/openMeteo';

export function useRegionalOutlook(city?: CitySearchResult | null) {
  const locations = getRegionalLocations(city);
  const regionKey = city && !(city.name.toLowerCase() === 'jakarta' && city.country.toLowerCase() === 'indonesia')
    ? `city-${city.id}`
    : 'jakarta';

  return useQuery({
    queryKey: ['regional-weather-outlook', regionKey],
    queryFn: () => fetchRegionalOutlook(locations),
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  });
}
