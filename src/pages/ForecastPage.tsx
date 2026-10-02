import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CitySearch } from '@/components/CitySearch';
import { ThemeToggle } from '@/components/ThemeToggle';
import { WeatherSummary } from '@/components/WeatherSummary';
import { useRegionalOutlook } from '@/hooks/useRegionalOutlook';
import { getRegionLabel } from '@/lib/globalWeather';
import { fetchCityWeather, weatherDescription, weatherVisualState, type CitySearchResult } from '@/lib/openMeteo';
import { ArrowLeft, ChevronDown, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Droplets, Loader2, RefreshCw, Sun, Waves } from 'lucide-react';

const JAKARTA = { lat: -6.2088, lng: 106.8456 };

const getInitialCity = (params: URLSearchParams): CitySearchResult | null => {
  const lat = Number(params.get('lat'));
  const lng = Number(params.get('lng'));
  const name = params.get('name');
  const country = params.get('country');
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !name || !country || !params.has('lat') || !params.has('lng')) return null;
  return { id: Number(params.get('id')) || -1, name, country, admin1: params.get('admin1') || undefined, lat, lng };
};

const iconForWeather = (code: number | null) => {
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

const riskStyle: Record<string, string> = {
  Low: 'border-risk-safe/30 bg-risk-safe/10 text-risk-safe',
  Watch: 'border-risk-medium/30 bg-risk-medium/10 text-risk-medium',
  High: 'border-risk-high/30 bg-risk-high/10 text-risk-high',
  Unavailable: 'border-border bg-muted text-muted-foreground',
};

const formatHour = (localTime: string) => new Intl.DateTimeFormat(undefined, {
  hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC',
}).format(new Date(`${localTime}:00Z`));

const ForecastPage = () => {
  const [searchParams] = useSearchParams();
  const [city, setCity] = useState<CitySearchResult | null>(() => getInitialCity(searchParams));
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const regionLabel = getRegionLabel(city);
  const lat = city?.lat ?? JAKARTA.lat;
  const lng = city?.lng ?? JAKARTA.lng;
  const outlookQuery = useRegionalOutlook(city);
  const currentQuery = useQuery({
    queryKey: ['forecast-current-city-weather', city?.id ?? 'jakarta', lat, lng],
    queryFn: () => fetchCityWeather(lat, lng),
    staleTime: 10 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
    retry: 1,
  });
  const current = currentQuery.data;
  const today = outlookQuery.data?.days[0];

  return (
    <div className="weather-shell">
      <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur-md">
        <div className="container mx-auto flex items-center justify-between gap-3 px-4 py-3 sm:py-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground"><CloudRain className="h-5 w-5" /></div>
            <div><h1 className="font-bold leading-tight">Weather &amp; Flood Forecast</h1><p className="hidden text-xs text-muted-foreground sm:block">A simple outlook for your area</p></div>
          </div>
          <div className="flex items-center gap-2"><Button variant="outline" size="sm" asChild><Link to="/" className="gap-1.5"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Dashboard</span><span className="sm:hidden">Back</span></Link></Button><ThemeToggle /></div>
        </div>
      </header>

      <main className="container mx-auto space-y-5 px-4 py-5 sm:space-y-7 sm:py-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">7-day outlook</p><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{regionLabel}</h2><p className="mt-1 text-sm text-muted-foreground">Today’s weather and the week ahead, in one place.</p></div>
          <div className="flex w-full gap-2 sm:w-auto"><CitySearch onSelect={(location) => { setCity(location); setSelectedDate(null); }} onReset={() => { setCity(null); setSelectedDate(null); }} placeholder="Search for a city…" /><Button variant="outline" size="icon" aria-label="Refresh forecast" onClick={() => { void outlookQuery.refetch(); void currentQuery.refetch(); }} disabled={outlookQuery.isFetching || currentQuery.isFetching}><RefreshCw className={`h-4 w-4 ${outlookQuery.isFetching || currentQuery.isFetching ? 'animate-spin' : ''}`} /></Button></div>
        </section>

        <Card className="overflow-hidden border-sky-500/15 bg-gradient-to-br from-sky-500/[0.07] via-card to-indigo-500/[0.06]">
          <CardHeader className="pb-2"><CardTitle className="text-base">Today in {city?.name ?? 'Jakarta'}</CardTitle><CardDescription>{regionLabel}</CardDescription></CardHeader>
          <CardContent>
          {currentQuery.isLoading ? <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading today’s weather…</div>
              : current ? <WeatherSummary weather={current} compact />
                : <p className="py-8 text-center text-sm text-muted-foreground">Couldn’t load the weather just now. Check your connection and try again.</p>}
          </CardContent>
        </Card>

        <section>
          <div className="mb-3"><h3 className="text-lg font-semibold">Today’s area forecast</h3><p className="text-sm text-muted-foreground">Average for {regionLabel} and nearby locations.</p></div>
          {outlookQuery.isError && <Card className="mb-3 border-risk-medium/30"><CardContent className="p-4 text-sm text-muted-foreground">Couldn’t load the area forecast. Please check your connection and try again.</CardContent></Card>}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Area Avg. Rainfall</p><p className="mt-1 text-2xl font-bold">{today?.rainfallMm === null || today?.rainfallMm === undefined ? '—' : `${today.rainfallMm.toFixed(1)} mm`}</p><p className="mt-1 text-xs text-muted-foreground">Expected today</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Average River Flow</p><p className="mt-1 text-2xl font-bold">{today?.riverDischargeM3s === null || today?.riverDischargeM3s === undefined ? '—' : `${today.riverDischargeM3s.toFixed(1)} m³/s`}</p><p className="mt-1 text-xs text-muted-foreground">Nearby rivers</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Flood Risk Estimate</p><p className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-sm font-semibold ${riskStyle[today?.floodRisk ?? 'Unavailable']}`}>{today?.floodRisk ?? (outlookQuery.isLoading ? 'Loading…' : 'Unavailable')}</p><p className="mt-1 text-xs text-muted-foreground">A simple rain-based guide</p></CardContent></Card>
            <Card><CardContent className="p-4"><p className="text-xs font-medium text-muted-foreground">Temperature</p><p className="mt-1 text-2xl font-bold">{today?.temperatureHighC === null || today?.temperatureHighC === undefined ? '—' : `${Math.round(today.temperatureHighC)}°`} <span className="text-sm font-normal text-muted-foreground">/ {today?.temperatureLowC === null || today?.temperatureLowC === undefined ? '—' : `${Math.round(today.temperatureLowC)}°`}</span></p><p className="mt-1 text-xs text-muted-foreground">High / low today</p></CardContent></Card>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">Low / Watch / High is a rain-based guide, not a true flood probability or official warning. River flow is not water height; m³/s means water passing each second.</p>
        </section>

        <section>
          <div className="mb-3"><h3 className="text-lg font-semibold">Next 7 days</h3><p className="text-sm text-muted-foreground">Choose a day to see its full 24-hour forecast.</p></div>
          {outlookQuery.isLoading ? <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading the week ahead…</div>
            : outlookQuery.data?.days.length ? <div className="space-y-2">{outlookQuery.data.days.map((day, index) => {
              const DayIcon = iconForWeather(day.weatherCode);
              const visualState = weatherVisualState(day.weatherCode);
              const dayLabel = index === 0 ? 'Today' : new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${day.date}T12:00:00Z`));
              const expanded = selectedDate === day.date;
              const hourlyRows = current?.hourlyForecastByDate[day.date] ?? [];
              return <Card key={day.date} className={`overflow-hidden transition-colors ${expanded ? 'border-primary/45 shadow-md shadow-primary/5' : 'hover:border-primary/30'}`}>
                <button type="button" className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" aria-expanded={expanded} aria-controls={`hourly-details-${day.date}`} onClick={() => setSelectedDate(expanded ? null : day.date)}>
                  <CardContent className="grid grid-cols-2 items-center gap-x-3 gap-y-3 p-3 sm:grid-cols-[minmax(130px,1.3fr)_1fr_1fr_1fr_1fr_auto] sm:gap-4 sm:p-4">
                    <div className="flex min-w-0 items-center gap-2"><DayIcon className={`weather-symbol-${visualState} h-6 w-6 shrink-0 text-sky-600 dark:text-sky-300`} /><div className="min-w-0"><p className="truncate text-sm font-semibold">{dayLabel}</p><p className="truncate text-xs text-muted-foreground">{weatherDescription(day.weatherCode)}</p></div></div>
                    <div><p className="text-[11px] text-muted-foreground">High / low</p><p className="text-sm font-semibold">{day.temperatureHighC === null ? '—' : `${Math.round(day.temperatureHighC)}°`} / {day.temperatureLowC === null ? '—' : `${Math.round(day.temperatureLowC)}°`}</p></div>
                    <div><p className="text-[11px] text-muted-foreground">Area rain</p><p className="flex items-center gap-1 text-sm font-semibold"><Droplets className="h-3.5 w-3.5 text-sky-600 dark:text-sky-300" />{day.rainfallMm === null ? '—' : `${day.rainfallMm.toFixed(1)} mm`}</p></div>
                    <div><p className="text-[11px] text-muted-foreground">Rain chance</p><p className="text-sm font-semibold">{day.rainChancePercent === null ? '—' : `${Math.round(day.rainChancePercent)}%`}</p></div>
                    <div><p className="text-[11px] text-muted-foreground">River flow</p><p className="flex items-center gap-1 text-sm font-semibold"><Waves className="h-3.5 w-3.5 text-primary" />{day.riverDischargeM3s === null ? '—' : `${day.riverDischargeM3s.toFixed(1)} m³/s`}</p></div>
                    <div className="col-span-2 flex items-center justify-between gap-2 sm:col-span-1 sm:justify-self-end"><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${riskStyle[day.floodRisk]}`}>Flood risk: {day.floodRisk}</span><span className="flex items-center gap-1 text-[11px] font-medium text-primary sm:hidden">{expanded ? 'Hide' : '24 hours'}<ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`} /></span><ChevronDown className={`hidden h-4 w-4 text-muted-foreground transition-transform sm:block ${expanded ? 'rotate-180' : ''}`} /></div>
                  </CardContent>
                </button>
                {expanded && <div id={`hourly-details-${day.date}`} role="region" aria-label={`${dayLabel} hourly forecast`} className="border-t border-primary/10 bg-muted/20 p-3 sm:p-4">
                  <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2"><div><h4 className="text-sm font-semibold">Hourly forecast · {dayLabel}</h4><p className="text-xs text-muted-foreground">All available hours in local time</p></div><span className="text-[11px] text-muted-foreground">{hourlyRows.length} hours</span></div>
                  {currentQuery.isLoading ? <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Loading hourly details…</div>
                    : hourlyRows.length ? <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">{hourlyRows.map((hour) => {
                      const HourIcon = iconForWeather(hour.weatherCode);
                      const hourState = weatherVisualState(hour.weatherCode);
                      return <div key={hour.time} className="weather-hour-detail rounded-xl p-3">
                        <div className="flex items-center justify-between gap-1"><p className="text-xs font-semibold">{formatHour(hour.time)}</p><HourIcon className={`weather-symbol-${hourState} h-4 w-4 text-sky-600 dark:text-sky-300`} /></div>
                        <p className="mt-1 text-xl font-semibold tracking-tight">{hour.temperatureC === null ? '—' : `${Math.round(hour.temperatureC)}°`}<span className="ml-0.5 text-xs font-normal text-muted-foreground">C</span></p>
                        <p className="truncate text-[11px] text-muted-foreground">{weatherDescription(hour.weatherCode)}</p>
                        <div className="mt-2 space-y-1 border-t border-primary/10 pt-2 text-[10px] text-muted-foreground"><p>Rain chance <strong className="text-foreground">{hour.rainChancePercent === null ? '—' : `${Math.round(hour.rainChancePercent)}%`}</strong></p><p>Wind <strong className="text-foreground">{hour.windKph === null ? '—' : `${Math.round(hour.windKph)} km/h`}</strong></p><p>Humidity <strong className="text-foreground">{hour.humidityPercent === null ? '—' : `${Math.round(hour.humidityPercent)}%`}</strong></p></div>
                      </div>;
                    })}</div> : <p className="py-4 text-sm text-muted-foreground">Hourly details are not available for this date. Refresh the forecast or choose another day.</p>}
                </div>}
              </Card>;
            })}</div> : <Card><CardContent className="p-4 text-sm text-muted-foreground">The seven-day outlook is unavailable for this location right now.</CardContent></Card>}
        </section>

        <div className="rounded-xl border bg-muted/30 px-4 py-3 text-xs leading-relaxed text-muted-foreground">Forecasts are estimates and can change. Flood risk is a guide, not an official warning. Follow local emergency services for safety advice.</div>
      </main>
    </div>
  );
};

export default ForecastPage;
