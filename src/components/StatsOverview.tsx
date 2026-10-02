import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Droplets, MapPin, Waves } from 'lucide-react';
import { averageValues, type LiveRegionWeather } from '@/lib/globalWeather';

interface StatsOverviewProps {
  data?: LiveRegionWeather;
  isLoading?: boolean;
  regionLabel: string;
}

export const StatsOverview = ({ data, isLoading = false, regionLabel }: StatsOverviewProps) => {
  const areas = data?.areas ?? [];
  const highRiskCount = areas.filter((area) => area.riskLevel === 'high').length;
  const averageRainfall = averageValues(areas.map((area) => area.latestDailyRainfallMm));
  const averageDischarge = averageValues(areas.map((area) => area.latestDischargeM3s));
  const stats = [
    {
      label: 'Heavy Rain Areas',
      value: areas.length ? highRiskCount : '—',
      total: areas.length || undefined,
      icon: AlertTriangle,
      tone: 'high',
      subtitle: areas.length ? 'Places with the most rain today' : isLoading ? 'Loading live weather…' : 'Live data unavailable',
    },
    {
      label: 'Area Avg. Rainfall',
      value: averageRainfall === null ? '—' : `${averageRainfall.toFixed(1)} mm`,
      icon: Droplets,
      tone: 'accent',
      subtitle: 'Average rain expected today',
    },
    {
      label: 'Average River Flow',
      value: averageDischarge === null ? '—' : `${averageDischarge.toFixed(1)} m³/s`,
      icon: Waves,
      tone: 'primary',
      subtitle: data?.dischargeAvailable ? 'How quickly nearby river water moves' : 'No nearby river estimate',
    },
    {
      label: 'Nearby Places',
      value: areas.length || (isLoading ? '…' : '—'),
      icon: MapPin,
      tone: 'medium',
      subtitle: regionLabel,
    },
  ];

  const toneStyles: Record<string, string> = {
    high: 'bg-risk-high/10 text-risk-high',
    medium: 'bg-risk-medium/10 text-risk-medium',
    primary: 'bg-primary/10 text-primary',
    accent: 'bg-accent/10 text-accent',
  };

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.label} className="transition-all hover:shadow-md hover:-translate-y-0.5 duration-200">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-muted-foreground leading-snug">{stat.label}</p>
                <h3 className="text-xl sm:text-3xl font-bold mt-1 sm:mt-1.5 tracking-tight">
                  {stat.value}
                  {stat.total !== undefined && <span className="text-sm sm:text-lg text-muted-foreground font-medium">/{stat.total}</span>}
                </h3>
                <p className="text-[11px] sm:text-xs text-muted-foreground mt-1 truncate">{stat.subtitle}</p>
              </div>
              <div className={`w-9 h-9 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center shrink-0 ${toneStyles[stat.tone]}`}>
                <stat.icon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
