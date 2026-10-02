import { TrendChart } from '@/components/TrendChart';
import type { LiveRegionWeather } from '@/lib/globalWeather';

interface WaterLevelChartProps {
  data?: LiveRegionWeather;
  regionLabel: string;
}

export const WaterLevelChart = ({ data, regionLabel }: WaterLevelChartProps) => {
  const last7Days = (data?.dischargeTrend ?? []).slice(-7)
    .filter((entry) => entry.value !== null)
    .map((entry) => ({ date: entry.date, discharge: entry.value as number }));

  return (
    <TrendChart
      data={last7Days}
      title="7-Day River Flow"
      description={data?.dischargeAvailable
        ? `Estimated daily flow in nearby rivers for ${regionLabel}. m³/s shows water passing each second, not water height.`
        : `No nearby river-flow estimate is available for ${regionLabel}.`}
      dataKey="discharge"
      yAxisLabel="River flow (m³/s)"
      tooltipLabel=" m³/s"
      chartColor="hsl(var(--chart-2))"
    />
  );
};
