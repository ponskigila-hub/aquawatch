import { TrendChart } from '@/components/TrendChart';
import type { LiveRegionWeather } from '@/lib/globalWeather';

interface RainfallChartProps {
  data?: LiveRegionWeather;
  regionLabel: string;
}

export const RainfallChart = ({ data, regionLabel }: RainfallChartProps) => {
  const last7Days = (data?.rainfallTrend ?? []).slice(-7)
    .filter((entry) => entry.value !== null)
    .map((entry) => ({ date: entry.date, rainfall: entry.value as number }));

  return (
    <TrendChart
      data={last7Days}
      title="7-Day Rainfall Trend"
      description={`Average daily rain for ${regionLabel}`}
      dataKey="rainfall"
      yAxisLabel="Rainfall (mm)"
      tooltipLabel=" mm"
      chartColor="hsl(var(--chart-1))"
      referenceLines={[
        { value: 50, color: 'hsl(var(--risk-high))', label: 'Heavy rain' },
        { value: 20, color: 'hsl(var(--risk-medium))', label: 'Moderate' },
      ]}
    />
  );
};
