import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface ReferenceLineConfig {
  value: number;
  color: string;
  label: string;
}

interface TrendChartProps {
  data: Array<Record<string, unknown> & { date: string }>;
  title: string;
  description: string;
  dataKey: string;
  yAxisLabel: string;
  tooltipLabel: string;
  chartColor: string;
  referenceLines?: ReferenceLineConfig[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value?: unknown }>;
  label?: string | number;
  tooltipLabel: string;
  chartColor: string;
}

const CustomTooltip = ({ active, payload, label, tooltipLabel, chartColor }: CustomTooltipProps) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-card/95 backdrop-blur-sm px-3 py-2 shadow-lg text-xs sm:text-sm">
      <p className="text-muted-foreground mb-1">
        {new Date(String(label ?? '')).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
      </p>
      <p className="font-semibold flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chartColor }} />
        {typeof payload[0].value === 'number' || typeof payload[0].value === 'string' ? payload[0].value : '—'}
        {tooltipLabel}
      </p>
    </div>
  );
};

export const TrendChart = ({
  data,
  title,
  description,
  dataKey,
  yAxisLabel,
  tooltipLabel,
  chartColor,
  referenceLines = [],
}: TrendChartProps) => {
  const gradientId = `gradient-${dataKey}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data} margin={{ top: 10, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={chartColor} stopOpacity={0.35} />
                <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              className="text-muted-foreground"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: 'hsl(var(--muted-foreground))' } }}
              className="text-muted-foreground"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              content={<CustomTooltip tooltipLabel={tooltipLabel} chartColor={chartColor} />}
            />
            {referenceLines.map((line, index) => (
              <ReferenceLine
                key={index}
                y={line.value}
                stroke={line.color}
                strokeDasharray="4 4"
                strokeOpacity={0.7}
                label={{ value: line.label, fontSize: 10, fill: line.color, position: 'insideTopRight' }}
              />
            ))}
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={chartColor}
              strokeWidth={2.5}
              fill={`url(#${gradientId})`}
              dot={{ fill: chartColor, r: 3, strokeWidth: 0 }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: 'hsl(var(--card))' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
};
