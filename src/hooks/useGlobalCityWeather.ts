import { useQuery } from '@tanstack/react-query';
import { fetchGlobalCityWeather } from '@/lib/globalWeather';

export function useGlobalCityWeather() {
  return useQuery({
    queryKey: ['global-city-weather'],
    queryFn: fetchGlobalCityWeather,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  });
}
