import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fetchWeather, weatherDescription, weatherGlyph } from '../services/environmental';
import { colors, type Coordinates, type WeatherSnapshot } from '../theme';
import { MetricTile, Panel, SectionTitle } from '../components/Ui';

const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric' });
const value = (number: number | null | undefined, suffix = '') => number === null || number === undefined ? '—' : `${Math.round(number)}${suffix}`;

export function OverviewScreen({ location, locationLabel, onOpenMap }: { location: Coordinates; locationLabel: string; onOpenMap: () => void }) {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const latitude = location.latitude;
  const longitude = location.longitude;

  useEffect(() => {
    let active = true;
    setBusy(true); setError('');
    fetchWeather({ latitude, longitude }).then((result) => { if (active) setWeather(result); })
      .catch(() => { if (active) setError('Live forecast could not be loaded. Check your internet connection and try again.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [latitude, longitude, refreshKey]);

  return <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => setRefreshKey((key) => key + 1)} tintColor={colors.maya} />}>
    <View style={styles.heading}><View><Text style={styles.eyebrow}>LOCAL WEATHER</Text><Text style={styles.location}>{locationLabel}</Text><Text style={styles.coordinate}>{location.latitude.toFixed(2)}°, {location.longitude.toFixed(2)}°</Text></View><Ionicons name="navigate-circle" size={34} color={colors.maya} /></View>
    <Panel style={styles.hero}>
      <View style={styles.heroTop}><View><Text style={styles.heroLabel}>Current conditions</Text><Text style={styles.heroPlace}>{locationLabel}</Text></View><Text style={styles.glyph}>{weatherGlyph(weather?.weatherCode ?? null)}</Text></View>
      {busy && !weather ? <ActivityIndicator color={colors.maya} style={{ marginVertical: 28 }} /> : error && !weather ? <Text style={styles.error}>{error}</Text> : <>
        <View style={styles.temperatureRow}><Text style={styles.temperature}>{value(weather?.temperatureC, '°')}</Text><View style={styles.condition}><Text style={styles.conditionText}>{weatherDescription(weather?.weatherCode ?? null)}</Text><Text style={styles.heroHint}>Feels like {value(weather?.feelsLikeC, '°')} · High {value(weather?.highC, '°')} / Low {value(weather?.lowC, '°')}</Text></View></View>
        <Text style={styles.heroHint}>Weather estimates · refreshed when you pull down</Text>
      </>}
    </Panel>
    <View style={styles.metricRow}>
      <MetricTile icon={<Ionicons name="rainy-outline" size={17} color={colors.maya} />} label="Rain today" value={value(weather?.rainTodayMm, ' mm')} tone={colors.maya} />
      <MetricTile icon={<Ionicons name="water-outline" size={17} color={colors.cornflower} />} label="Rain chance" value={value(weather?.rainChance, '%')} tone={colors.cornflower} />
      <MetricTile icon={<Ionicons name="speedometer-outline" size={17} color={colors.amber} />} label="Wind" value={value(weather?.windKph, ' km/h')} tone={colors.amber} />
    </View>
    <View style={styles.metricRow}>
      <MetricTile icon={<Ionicons name="thermometer-outline" size={17} color={colors.periwinkle} />} label="Feels like" value={value(weather?.feelsLikeC, '°')} tone={colors.periwinkle} />
      <MetricTile icon={<Ionicons name="water-outline" size={17} color={colors.maya} />} label="Humidity" value={value(weather?.humidity, '%')} tone={colors.maya} />
    </View>
    <SectionTitle title="Next 12 hours" detail="Local forecast · tap Forecast for the 7-day view" />
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9, paddingBottom: 5 }}>
      {(weather?.hourly ?? []).map((hour) => <View key={hour.time} style={styles.hourCard}><Text style={styles.hourTime}>{timeLabel(hour.time)}</Text><Text style={styles.hourGlyph}>{weatherGlyph(hour.weatherCode)}</Text><Text style={styles.hourTemp}>{value(hour.temperatureC, '°')}</Text><Text style={styles.hourRain}>{value(hour.rainChance, '%')} rain</Text></View>)}
    </ScrollView>
    <Panel style={styles.mapCta}><View style={{ flex: 1 }}><Text style={styles.mapTitle}>Explore the live risk globe</Text><Text style={styles.heroHint}>Open the interactive 3D map and global weather markers.</Text></View><Ionicons name="arrow-forward-circle" size={30} color={colors.maya} onPress={onOpenMap} /></Panel>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Text style={styles.disclaimer}>General awareness only. Model estimates are not official emergency alerts.</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 28 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  eyebrow: { color: colors.maya, letterSpacing: 1.6, fontSize: 10, fontWeight: '800' },
  location: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 4 },
  coordinate: { color: colors.muted, fontSize: 11, marginTop: 3 },
  hero: { padding: 18, backgroundColor: '#173B5B', borderColor: '#55C1FF33' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroLabel: { color: colors.muted, fontSize: 12 }, heroPlace: { color: colors.text, fontWeight: '700', fontSize: 14, marginTop: 4 }, glyph: { color: colors.amber, fontSize: 40 },
  temperatureRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 12, marginBottom: 6 },
  temperature: { color: colors.text, fontSize: 56, fontWeight: '800', letterSpacing: -2 },
  condition: { flex: 1 }, conditionText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  heroHint: { color: colors.muted, fontSize: 11, lineHeight: 17, marginTop: 3 },
  metricRow: { flexDirection: 'row', gap: 9, marginBottom: 9 },
  hourCard: { width: 82, backgroundColor: colors.deepRaised, borderColor: colors.line, borderWidth: 1, borderRadius: 15, alignItems: 'center', paddingVertical: 11, paddingHorizontal: 7 },
  hourTime: { color: colors.muted, fontSize: 11 }, hourGlyph: { color: colors.amber, fontSize: 20, marginTop: 8 }, hourTemp: { color: colors.text, fontWeight: '800', fontSize: 14, marginTop: 5 }, hourRain: { color: colors.maya, fontSize: 9, marginTop: 4 },
  mapCta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18 }, mapTitle: { color: colors.text, fontSize: 14, fontWeight: '700' },
  error: { color: '#FFD6DC', fontSize: 12, lineHeight: 18, marginVertical: 8 }, disclaimer: { color: colors.muted, fontSize: 10, marginTop: 15, textAlign: 'center', lineHeight: 16 },
});
