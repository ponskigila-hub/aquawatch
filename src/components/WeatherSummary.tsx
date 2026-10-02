import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, Sun, Thermometer, Wind } from 'lucide-react';
import type { CityWeather } from '@/lib/openMeteo';
import { weatherDescription } from '@/lib/openMeteo';

interface WeatherSummaryProps {
  weather: CityWeather;
  compact?: boolean;
}

const numberText = (value: number | null, suffix = '') => value === null ? '—' : `${Math.round(value)}${suffix}`;

const iconForCode = (code: number | null) => {
  if (code === 0) return Sun;
  if (code === 1 || code === 2) return CloudSun;
  if (code === 3) return Cloud;
  if (code === 45 || code === 48) return CloudFog;
  if ([51, 53, 55, 56, 57].includes(code ?? -1)) return CloudDrizzle;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code ?? -1)) return CloudRain;
  if ([71, 73, 75, 77, 85, 86].includes(code ?? -1)) return CloudSnow;
  if ([95, 96, 99].includes(code ?? -1)) return CloudLightning;
  return Cloud;
};

export const WeatherSummary = ({ weather, compact = false }: WeatherSummaryProps) => {
  const ConditionIcon = iconForCode(weather.weatherCode);
  const metrics = [
    { label: 'Feels like', value: numberText(weather.feelsLikeC, '°C'), icon: Thermometer },
    { label: 'Rain today', value: weather.rainfallTodayMm === null ? '—' : `${weather.rainfallTodayMm.toFixed(1)} mm`, icon: Droplets },
    { label: 'Rain chance', value: numberText(weather.rainChancePercent, '%'), icon: CloudRain },
    { label: 'Wind', value: numberText(weather.windKph, ' km/h'), icon: Wind },
    { label: 'Humidity', value: numberText(weather.humidityPercent, '%'), icon: Droplets },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl bg-gradient-to-br from-sky-500/15 via-primary/10 to-indigo-500/10 p-3 sm:p-4">
        <ConditionIcon className="h-9 w-9 shrink-0 text-sky-500 sm:h-11 sm:w-11" strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-4xl font-light tracking-tight text-foreground">{numberText(weather.temperatureC, '°C')}</span>
            <span className="text-sm font-medium text-foreground/80">{weatherDescription(weather.weatherCode)}</span>
          </div>
          <p className="text-xs text-muted-foreground">Today · High {numberText(weather.highC, '°C')} · Low {numberText(weather.lowC, '°C')}</p>
        </div>
      </div>

      <div className={`grid gap-2 ${compact ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border bg-background/70 px-2.5 py-2">
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Icon className="h-3 w-3" />{label}</p>
            <p className="mt-0.5 text-sm font-semibold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {weather.hourlyForecast.length > 0 && (
        <div className="rounded-xl border bg-background/70 p-2.5">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Next few hours</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {weather.hourlyForecast.slice(0, compact ? 4 : 6).map((hour) => {
              const HourIcon = iconForCode(hour.weatherCode);
              return <div key={hour.time} className="min-w-[54px] flex-1 rounded-lg bg-muted/50 px-2 py-2 text-center">
                <p className="text-[10px] text-muted-foreground">{hour.time.slice(11, 16)}</p>
                <HourIcon className="mx-auto my-1 h-4 w-4 text-sky-500" />
                <p className="text-xs font-semibold">{numberText(hour.temperatureC, '°C')}</p>
                {hour.rainChancePercent !== null && <p className="mt-0.5 text-[10px] text-muted-foreground">{Math.round(hour.rainChancePercent)}% rain</p>}
              </div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
};
