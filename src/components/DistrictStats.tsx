import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RiskBadge } from './RiskBadge';
import { Droplets, Waves, AlertTriangle, MapPin } from 'lucide-react';
import type { LiveRegionWeather } from '@/lib/globalWeather';

interface DistrictStatsProps {
  data?: LiveRegionWeather;
  isLoading?: boolean;
  regionLabel: string;
}

const riskBarColor: Record<string, string> = {
  safe: 'bg-risk-safe',
  medium: 'bg-risk-medium',
  high: 'bg-risk-high',
};

export const DistrictStats = ({ data, isLoading = false, regionLabel }: DistrictStatsProps) => {
  const areas = [...(data?.areas ?? [])].sort((a, b) => (b.latestDailyRainfallMm ?? -1) - (a.latestDailyRainfallMm ?? -1));
  const maxRainfall = Math.max(1, ...areas.map((area) => area.latestDailyRainfallMm ?? 0));
  const jakartaContext = regionLabel === 'Jakarta, Indonesia';

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{jakartaContext ? 'Jakarta District Status' : 'Nearby City & Area Status'}</CardTitle>
        <CardDescription>{regionLabel} · today’s rain, temperature, and nearby river flow</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {areas.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {isLoading ? 'Loading live area data…' : 'Live area data is unavailable. Try again shortly.'}
          </div>
        ) : areas.map((area) => (
          <div key={area.id} className="block p-3 rounded-lg border bg-card">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {area.riskLevel === 'high'
                  ? <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-risk-high shrink-0" />
                  : <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-primary shrink-0" />}
                <div className="min-w-0">
                  <h4 className="font-medium text-sm truncate">{area.name}</h4>
                  <p className="text-xs text-muted-foreground truncate">
                    {area.admin1 ? `${area.admin1}, ` : ''}{area.country}{area.distanceKm ? ` · ~${area.distanceKm} km` : ''}
                    {area.kind === 'nearby_grid' ? ' · nearby forecast point' : ''}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Droplets className="w-3 h-3" />{area.latestDailyRainfallMm === null ? 'Rain n/a' : `${area.latestDailyRainfallMm.toFixed(1)} mm/day`}</span>
                    <span className="flex items-center gap-1"><Waves className="w-3 h-3" />{area.latestDischargeM3s === null ? 'Flow n/a' : `${area.latestDischargeM3s.toFixed(1)} m³/s`}</span>
                    {area.temperatureC !== null && <span>{Math.round(area.temperatureC)}°C</span>}
                  </div>
                </div>
              </div>
              <RiskBadge level={area.riskLevel} showIcon={false} />
            </div>
            <div className="mt-2.5 h-1.5 rounded-full bg-muted overflow-hidden" title="Relative to 50 mm daily rain threshold">
              <div className={`h-full rounded-full ${riskBarColor[area.riskLevel]} transition-all`} style={{ width: `${Math.min(100, ((area.latestDailyRainfallMm ?? 0) / maxRainfall) * 100)}%` }} />
            </div>
          </div>
        ))}
          <p className="text-[11px] leading-relaxed text-muted-foreground pt-1">
          Rain and river flow are estimates. River flow is not water height; m³/s is how much water passes each second. The estimate may be from a nearby river.
        </p>
      </CardContent>
    </Card>
  );
};
