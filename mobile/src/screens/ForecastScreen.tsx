import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchWeather, weatherDescription, weatherGlyph } from '../services/environmental';
import { colors, type Coordinates, type WeatherSnapshot } from '../theme';
import { Panel, SectionTitle } from '../components/Ui';

const value = (number: number | null, suffix = '') => number === null ? '—' : `${Math.round(number)}${suffix}`;
export function ForecastScreen({ location, locationLabel }: { location: Coordinates; locationLabel: string }) {
  const [data, setData] = useState<WeatherSnapshot | null>(null);
  const [error, setError] = useState('');
  const latitude = location.latitude;
  const longitude = location.longitude;
  useEffect(() => { let active = true; setError(''); fetchWeather({ latitude, longitude }).then((item) => { if (active) setData(item); }).catch(() => { if (active) setError('Forecast service is temporarily unavailable.'); }); return () => { active = false; }; }, [latitude, longitude]);
  return <ScrollView contentContainerStyle={styles.content}>
    <Text style={styles.eyebrow}>WEATHER OUTLOOK</Text><Text style={styles.title}>{locationLabel}</Text><Text style={styles.subtitle}>Hourly detail and the next 7 days.</Text>
    <SectionTitle title="Next 12 hours" detail="Local time · temperature and chance of rain" />
    {!data && !error ? <ActivityIndicator color={colors.maya} style={{ margin: 28 }} /> : null}
    {error ? <Panel><Text style={styles.subtitle}>{error}</Text></Panel> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingBottom: 6 }}>
      {(data?.hourly ?? []).map((hour) => <Panel key={hour.time} style={styles.hour}><Text style={styles.time}>{new Date(hour.time).toLocaleTimeString([], { hour: 'numeric' })}</Text><Text style={styles.glyph}>{weatherGlyph(hour.weatherCode)}</Text><Text style={styles.value}>{value(hour.temperatureC, '°')}</Text><Text style={styles.rain}>{value(hour.rainChance, '%')} rain</Text><Text style={styles.small}>{value(hour.windKph, ' km/h')}</Text></Panel>)}
    </ScrollView>
    <SectionTitle title="7-day outlook" detail="Forecast values are estimates, not warnings." />
    {(data?.daily ?? []).map((day, index) => <Panel key={day.date} style={styles.day}><View style={{ flex: 1 }}><Text style={styles.dayName}>{index === 0 ? 'Today' : new Date(`${day.date}T12:00:00`).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</Text><Text style={styles.small}>{weatherDescription(day.weatherCode)} · {value(day.rainChance, '%')} rain chance</Text></View><Text style={styles.glyphSmall}>{weatherGlyph(day.weatherCode)}</Text><View style={styles.temps}><Text style={styles.value}>{value(day.highC, '°')}</Text><Text style={styles.small}>{value(day.lowC, '°')}</Text></View><View style={styles.rainPill}><Ionicons name="rainy-outline" size={13} color={colors.maya} /><Text style={styles.rain}>{value(day.rainMm, ' mm')}</Text></View></Panel>)}
    <Text style={styles.disclaimer}>Source: Open-Meteo global weather model. Local conditions can differ.</Text>
  </ScrollView>;
}
const styles = StyleSheet.create({ content: { padding: 16, paddingBottom: 30 }, eyebrow: { color: colors.maya, fontSize: 10, letterSpacing: 1.5, fontWeight: '800' }, title: { color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 5 }, subtitle: { color: colors.muted, fontSize: 12, marginTop: 5, lineHeight: 18 }, hour: { width: 92, alignItems: 'center', padding: 10, marginBottom: 0 }, time: { color: colors.muted, fontSize: 11 }, glyph: { color: colors.amber, fontSize: 22, marginVertical: 6 }, value: { color: colors.text, fontSize: 15, fontWeight: '800' }, rain: { color: colors.maya, fontSize: 10, marginTop: 3 }, small: { color: colors.muted, fontSize: 10, marginTop: 3 }, day: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, marginBottom: 8 }, dayName: { color: colors.text, fontSize: 13, fontWeight: '700' }, glyphSmall: { fontSize: 20, color: colors.amber }, temps: { alignItems: 'flex-end', minWidth: 44 }, rainPill: { flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 52, justifyContent: 'flex-end' }, disclaimer: { color: colors.muted, textAlign: 'center', fontSize: 10, lineHeight: 16, marginTop: 8 } });
