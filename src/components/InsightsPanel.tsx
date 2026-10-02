import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react';
import { averageValues, type LiveRegionWeather } from '@/lib/globalWeather';

interface InsightsPanelProps {
  data?: LiveRegionWeather;
  isLoading?: boolean;
  regionLabel: string;
}

export const InsightsPanel = ({ data, isLoading = false, regionLabel }: InsightsPanelProps) => {
  const areas = data?.areas ?? [];
  const ranked = [...areas].filter((area) => area.latestDailyRainfallMm !== null)
    .sort((a, b) => (b.latestDailyRainfallMm ?? 0) - (a.latestDailyRainfallMm ?? 0));
  const mostAtRisk = ranked[0];
  const safest = ranked.at(-1);
  const values = data?.rainfallTrend.map((entry) => entry.value) ?? [];
  const recentWeek = averageValues(values.slice(-7));
  const previousWeek = averageValues(values.slice(-14, -7));
  const weeklyChange = recentWeek !== null && previousWeek !== null && previousWeek > 0
    ? Math.round(((recentWeek - previousWeek) / previousWeek) * 100)
    : null;
  const isRising = weeklyChange !== null && weeklyChange > 0;
  const unavailable = isLoading ? 'Loading weather…' : 'Weather data unavailable right now';

  return (
    <div className="grid gap-3 sm:gap-4 sm:grid-cols-3">
      <Card className="border-2 border-risk-high/20 bg-risk-high/[0.03]">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-risk-high/15 text-risk-high flex items-center justify-center shrink-0"><AlertTriangle className="w-4 h-4" /></div>
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Needs Attention</p>
          </div>
          {mostAtRisk ? (
            <p className="text-sm text-foreground/90 leading-relaxed">
              <span className="font-bold">{mostAtRisk.name}</span> ({mostAtRisk.country}) has the most expected rain today: <span className="font-bold">{mostAtRisk.latestDailyRainfallMm?.toFixed(1)} mm</span>.
            </p>
          ) : <p className="text-sm text-muted-foreground">{unavailable}</p>}
          <p className="text-xs text-foreground/50 mt-2">Rain estimate for {regionLabel}</p>
        </CardContent>
      </Card>

      <Card className={`border-2 ${isRising ? 'border-risk-medium/20 bg-risk-medium/[0.03]' : 'border-risk-safe/20 bg-risk-safe/[0.03]'}`}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isRising ? 'bg-risk-medium/15 text-risk-medium' : 'bg-risk-safe/15 text-risk-safe'}`}>
              {isRising ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            </div>
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Weekly Trend</p>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {weeklyChange === null ? unavailable : <>Rain is <span className="font-bold">{isRising ? 'up' : 'down'} {Math.abs(weeklyChange)}%</span> compared with the previous week.</>}
          </p>
          <p className="text-xs text-foreground/50 mt-2">Average daily rain · last 7 days vs. previous 7</p>
        </CardContent>
      </Card>

      <Card className="border-2 border-risk-safe/20 bg-risk-safe/[0.03]">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-risk-safe/15 text-risk-safe flex items-center justify-center shrink-0"><ShieldCheck className="w-4 h-4" /></div>
            <p className="text-xs font-semibold text-foreground/70 uppercase tracking-wide">Lowest Rain Today</p>
          </div>
          {safest ? (
            <p className="text-sm text-foreground/90 leading-relaxed">
              <span className="font-bold">{safest.name}</span> ({safest.country}) has the least expected rain today: <span className="font-bold">{safest.latestDailyRainfallMm?.toFixed(1)} mm</span>.
            </p>
          ) : <p className="text-sm text-muted-foreground">{unavailable}</p>}
          <p className="text-xs text-foreground/50 mt-2">Compared with other places in {regionLabel}</p>
        </CardContent>
      </Card>
    </div>
  );
};
