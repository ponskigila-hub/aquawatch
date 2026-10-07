import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { aqiDescription, fetchAirQuality, fetchWeather, weatherDescription, weatherGlyph } from '../services/environmental';
import { colors, type AirQualitySnapshot, type Coordinates, type WeatherDay, type WeatherSnapshot } from '../theme';
import { Panel, SectionTitle } from '../components/Ui';
import { WeatherMetrics } from '../components/WeatherMetrics';

const value = (number: number | null | undefined, suffix = '') => number === null || number === undefined ? '—' : `${Math.round(number)}${suffix}`;
const oneDecimal = (number: number | null | undefined, suffix = '') => number === null || number === undefined ? '—' : `${number.toFixed(1)}${suffix}`;
const timeOfDay = (time: string | null) => time ? time.slice(11, 16) : '—';
const hoursMinutes = (seconds: number | null) => seconds == null ? '—' : `${Math.floor(seconds / 3600)} hr ${Math.round(seconds % 3600 / 60)} min`;

function lunarPhase(date: string) {
  const epoch = Date.UTC(2000, 0, 6, 18, 14);
  const synodicMonth = 29.530588853;
  const timestamp = new Date(`${date}T12:00:00Z`).getTime();
  const fraction = ((timestamp - epoch) / 86_400_000 / synodicMonth % 1 + 1) % 1;
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return { name: names[Math.round(fraction * 8) % 8], illumination: Math.round((1 - Math.cos(2 * Math.PI * fraction)) * 50) };
}

export function ForecastScreen({ location, locationLabel }: { location: Coordinates; locationLabel: string }) {
  const [data, setData] = useState<WeatherSnapshot | null>(null);
  const [airQuality, setAirQuality] = useState<AirQualitySnapshot | null>(null);
  const [error, setError] = useState('');
  const [section, setSection] = useState<'Now' | 'Hourly' | 'Daily' | 'Sun & Moon'>('Now');
  const latitude = location.latitude;
  const longitude = location.longitude;
  useEffect(() => {
    let active = true;
    setError('');
    fetchWeather({ latitude, longitude }).then((item) => { if (active) setData(item); }).catch(() => { if (active) setError('Forecast service is temporarily unavailable.'); });
    fetchAirQuality({ latitude, longitude }).then((item) => { if (active) setAirQuality(item); }).catch(() => { if (active) setAirQuality(null); });
    return () => { active = false; };
  }, [latitude, longitude]);

  const sections: Array<typeof section> = ['Now', 'Hourly', 'Daily', 'Sun & Moon'];
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>WEATHER OUTLOOK</Text><Text style={styles.title}>{locationLabel}</Text><Text style={styles.subtitle}>Local forecast · values update for your device location.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {sections.map((item) => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: section === item }} onPress={() => setSection(item)} style={[styles.tab, section === item && styles.tabActive]}><Text style={[styles.tabText, section === item && styles.tabTextActive]}>{item}</Text></Pressable>)}
    </ScrollView>
    {!data && !error ? <ActivityIndicator color={colors.maya} style={{ margin: 28 }} /> : null}
    {error ? <Panel><Text style={styles.subtitle}>{error}</Text></Panel> : null}

    {section === 'Now' && data ? <>
      <SectionTitle title="Right now" detail={data.time ? `Model update ${new Date(data.time).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Current local conditions'} />
      <Panel style={styles.nowCard}><Text style={styles.nowGlyph}>{weatherGlyph(data.weatherCode)}</Text><View style={{ flex: 1 }}><Text style={styles.nowTemp}>{value(data.temperatureC, '°C')}</Text><Text style={styles.nowCondition}>{weatherDescription(data.weatherCode)}</Text><Text style={styles.small}>Feels like {value(data.feelsLikeC, '°C')} · high {value(data.highC, '°')} / low {value(data.lowC, '°')}</Text></View></Panel>
      <WeatherMetrics weather={data} airQuality={airQuality} />
    </> : null}

    {section === 'Hourly' && data ? <>
      <SectionTitle title="Next 12 hours" detail="Local time · temperature, rain chance, wind, humidity and UV" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>
        {data.hourly.map((hour) => <Panel key={hour.time} style={styles.hour}><Text style={styles.time}>{timeOfDay(hour.time)}</Text><Text style={styles.glyph}>{weatherGlyph(hour.weatherCode)}</Text><Text style={styles.value}>{value(hour.temperatureC, '°')}</Text><Text style={styles.rain}>{value(hour.rainChance, '%')} rain</Text><View style={styles.hourDivider} /><Text style={styles.small}>{oneDecimal(hour.windKph, ' km/h')} wind</Text><Text style={styles.small}>{value(hour.humidity, '%')} humidity</Text><Text style={styles.small}>Cloud {value(hour.cloudCoverPct, '%')}</Text><Text style={styles.small}>UV {oneDecimal(hour.uvIndex)}</Text></Panel>)}
      </ScrollView>
      <Text style={styles.source}>Source: Open-Meteo global weather model. Local conditions can differ.</Text>
    </> : null}

    {section === 'Daily' && data ? <>
      <SectionTitle title="7-day outlook" detail="Daily high/low, rain chance, rain amount and UV peak" />
      {data.daily.map((day, index) => <DayRow key={day.date} day={day} index={index} />)}
      <Text style={styles.source}>Forecast values are model estimates, not warnings.</Text>
    </> : null}

    {section === 'Sun & Moon' && data ? <SunMoon day={data.daily[0]} /> : null}
  </ScrollView>;
}

function DayRow({ day, index }: { day: WeatherDay; index: number }) {
  return <Panel style={styles.day}>
    <View style={{ flex: 1 }}><Text style={styles.dayName}>{index === 0 ? 'Today' : new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</Text><Text style={styles.small}>{weatherDescription(day.weatherCode)} · {value(day.rainChance, '%')} rain chance</Text><Text style={styles.small}>UV peak {oneDecimal(day.uvMax)}</Text></View>
    <Text style={styles.glyphSmall}>{weatherGlyph(day.weatherCode)}</Text><View style={styles.temps}><Text style={styles.value}>{value(day.highC, '°')}</Text><Text style={styles.small}>{value(day.lowC, '°')}</Text></View>
    <View style={styles.rainPill}><Ionicons name="rainy-outline" size={13} color={colors.maya} /><Text style={styles.rain}>{oneDecimal(day.rainMm, ' mm')}</Text></View>
  </Panel>;
}

function SunMoon({ day }: { day: WeatherDay | undefined }) {
  if (!day) return <Panel><Text style={styles.subtitle}>Sun and moon data are unavailable right now.</Text></Panel>;
  const moon = lunarPhase(day.date);
  return <>
    <SectionTitle title="Sun & Moon" detail={new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} />
    <Panel style={styles.celestial}><View style={styles.celestialTitle}><Ionicons name="sunny" size={20} color={colors.amber} /><Text style={styles.cardTitle}>Sun</Text></View>
      <InfoRow label="Sunrise" value={timeOfDay(day.sunrise)} /><InfoRow label="Sunset" value={timeOfDay(day.sunset)} /><InfoRow label="Daylight" value={hoursMinutes(day.daylightSeconds)} /><InfoRow label="Bright sunshine (modelled)" value={hoursMinutes(day.sunshineSeconds)} /><InfoRow label="UV peak" value={oneDecimal(day.uvMax)} />
    </Panel>
    <Panel style={styles.celestial}><View style={styles.celestialTitle}><Ionicons name="moon" size={20} color={colors.periwinkle} /><Text style={styles.cardTitle}>Moon</Text></View>
      <InfoRow label="Phase" value={moon.name} /><InfoRow label="Illuminated" value={`${moon.illumination}%`} /><Text style={styles.small}>Phase and illumination are calculated from the date; exact moonrise and moonset are not provided by this weather feed.</Text>
    </Panel>
    <Text style={styles.source}>Sunrise, sunset, daylight, sunshine and UV are Open-Meteo model fields. Times use the forecast location's local timezone.</Text>
  </>;
}
function InfoRow({ label, value: rowValue }: { label: string; value: string }) { return <View style={styles.infoRow}><Text style={styles.infoLabel}>{label}</Text><Text style={styles.infoValue}>{rowValue}</Text></View>; }

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 30 }, eyebrow: { color: colors.maya, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' }, title: { color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 5 }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 5, lineHeight: 18 },
  tabs: { gap: 8, paddingVertical: 15 }, tab: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderColor: colors.line, borderWidth: 1, backgroundColor: '#FFFFFF08' }, tabActive: { backgroundColor: '#55C1FF20', borderColor: '#55C1FF66' }, tabText: { color: colors.muted, fontSize: 11, fontWeight: '700' }, tabTextActive: { color: colors.maya },
  horizontal: { gap: 9, paddingBottom: 4 }, nowCard: { flexDirection: 'row', alignItems: 'center', gap: 16 }, nowGlyph: { color: colors.amber, fontSize: 42 }, nowTemp: { color: colors.text, fontSize: 30, fontWeight: '900' }, nowCondition: { color: colors.text, fontSize: 13, fontWeight: '700', marginTop: 2 },
  hour: { width: 124, alignItems: 'center', padding: 10, marginBottom: 0 }, time: { color: colors.muted, fontSize: 11 }, glyph: { color: colors.amber, fontSize: 22, marginVertical: 6 }, value: { color: colors.text, fontSize: 15, fontWeight: '800' }, rain: { color: colors.maya, fontSize: 10, marginTop: 3 }, small: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }, hourDivider: { height: 1, backgroundColor: colors.line, width: '100%', marginVertical: 7 },
  day: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, marginBottom: 8 }, dayName: { color: colors.text, fontSize: 13, fontWeight: '700' }, glyphSmall: { fontSize: 20, color: colors.amber }, temps: { alignItems: 'flex-end', minWidth: 42 }, rainPill: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 50, justifyContent: 'flex-end' }, source: { color: colors.muted, textAlign: 'center', fontSize: 10, lineHeight: 15, marginTop: 9 },
  celestial: { borderColor: '#A682FF33' }, celestialTitle: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 10 }, cardTitle: { color: colors.text, fontSize: 15, fontWeight: '800' }, infoRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: colors.line }, infoLabel: { flex: 1, color: colors.muted, fontSize: 11 }, infoValue: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'right' },
});
