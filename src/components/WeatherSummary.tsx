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
  const isSunny = weather.weatherCode !== null && weather.weatherCode <= 2;
  const metrics = [
    { label: 'Wind now', value: numberText(weather.windKph, ' km/h'), icon: Wind },
    { label: 'Humidity', value: numberText(weather.humidityPercent, '%'), icon: Droplets },
    { label: 'Rain chance', value: numberText(weather.rainChancePercent, '%'), icon: CloudRain },
    { label: 'Feels like', value: numberText(weather.feelsLikeC, '°C'), icon: Thermometer },
    { label: 'Rain today', value: weather.rainfallTodayMm === null ? '—' : `${weather.rainfallTodayMm.toFixed(1)} mm`, icon: Droplets },
  ];

  return (
    <div className="space-y-3">
      <div className="weather-now-hero relative flex items-center gap-4 overflow-hidden rounded-2xl p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-6 -top-10 h-32 w-32 rounded-full bg-amber-300/10 blur-2xl" />
        <ConditionIcon className={`relative h-14 w-14 shrink-0 sm:h-20 sm:w-20 ${isSunny ? 'text-amber-300 drop-shadow-[0_0_18px_rgba(255,196,47,0.45)]' : 'text-sky-300 drop-shadow-[0_0_16px_rgba(76,180,255,0.3)]'}`} strokeWidth={1.25} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="text-5xl font-light tracking-[-0.06em] text-foreground sm:text-6xl">{numberText(weather.temperatureC, '°')}</span>
            <span className="text-sm font-medium text-sky-100/90">{weatherDescription(weather.weatherCode)}</span>
          </div>
          <p className="mt-1 text-xs text-sky-100/65">Today · High {numberText(weather.highC, '°')} · Low {numberText(weather.lowC, '°')} · Celsius</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {metrics.map(({ label, value, icon: Icon }) => (
          <div key={label} className="weather-metric rounded-xl border px-2.5 py-2.5">
            <p className="flex items-center gap-1 truncate text-[10px] text-muted-foreground sm:text-[11px]"><Icon className="h-3 w-3 shrink-0 text-sky-300" />{label}</p>
            <p className="mt-1 truncate text-sm font-semibold text-foreground sm:text-base">{value}</p>
          </div>
        ))}
      </div>

      {weather.hourlyForecast.length > 0 && (
        <div className="rounded-2xl border border-primary/15 bg-background/30 p-2.5 sm:p-3">
          <p className="mb-2 text-xs font-semibold text-foreground/80">Today · next few hours</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {weather.hourlyForecast.slice(0, compact ? 4 : 6).map((hour) => {
              const HourIcon = iconForCode(hour.weatherCode);
              const sunnyHour = hour.weatherCode !== null && hour.weatherCode <= 2;
              return <div key={hour.time} className="weather-hour-tile min-w-[58px] flex-1 rounded-xl px-2 py-2 text-center">
                <p className="text-[10px] text-muted-foreground">{hour.time.slice(11, 16)}</p>
                <HourIcon className={`mx-auto my-1 h-4 w-4 ${sunnyHour ? 'text-amber-300' : 'text-sky-300'}`} />
                <p className="text-xs font-semibold">{numberText(hour.temperatureC, '°C')}</p>
                {hour.rainChancePercent !== null && <p className="mt-0.5 text-[10px] text-sky-200/65">{Math.round(hour.rainChancePercent)}% rain</p>}
              </div>;
            })}
          </div>
        </div>
      )}
    </div>
  );
};
